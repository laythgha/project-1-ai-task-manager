# Design

## Architecture

```
                         ┌──────────────────────┐
                         │   Google OAuth 2.0   │
                         └──────────┬───────────┘
                                    │ redirect w/ JWT
┌───────────────┐   HTTPS/REST   ┌──▼───────────────────────┐   SQL   ┌──────────────┐
│  React (Vite) │◄──────────────►│  Express API (Node.js)   │◄───────►│  PostgreSQL  │
│  frontend/    │   WebSocket    │  src/index.js            │ Prisma  │  (Prisma)    │
└───────────────┘◄──────────────►│  + Socket.IO server      │         └──────────────┘
                                  │  + auth.js (JWT)         │
                                  │  + permissions.js        │
                                  └───┬───────────┬──────────┘
                                      │           │
                              ┌───────▼──┐   ┌────▼─────────┐
                              │ Anthropic│   │ Gmail (SMTP) │
                              │  (chat)  │   │  reminders   │
                              └──────────┘   └──────────────┘
```

## Main Components

- **Frontend (`frontend/`)** — a React SPA (no router; a single view swaps between `Login` and `Dashboard` based on whether a valid token is present). Talks to the backend over REST (`axios`, `src/api.js`) and a WebSocket (`socket.io-client`).
- **Backend (`src/index.js`)** — a single Express app that serves the REST API, the Socket.IO server, and (optionally, if a frontend build is present) the built frontend itself. Every route that isn't signup/login/OAuth is protected by `authenticate` (`src/auth.js`) and authorized by `can()` (`src/permissions.js`).
- **Database** — PostgreSQL, accessed through Prisma with the `Roles → Users → WorkspaceMembership → Workspaces → Projects → Tasks → Reminders` schema described in `srs.md`.
- **AI chat agent** — Anthropic's Claude, called with an explicit `tools` array (`create_task`, `update_task`, `delete_task`, `create_reminder`). The agent never touches the database directly; every tool call runs through the same Prisma calls and the same `can()` permission check as the equivalent REST route.
- **Reminder mechanism** — a `setInterval` polling job (every 60s) that finds due, unsent reminders and sends real email through Gmail.

## Data Flow

**A request from the frontend:** `axios` attaches `Authorization: Bearer <token>` (an interceptor in `api.js`) → `authenticate` middleware verifies the JWT and sets `req.user_id` → the route looks up `req.user_id`'s role in the relevant workspace (`getUserRoleInWorkspace`) → `can(role, module, action)` allows or 403s → Prisma reads/writes → for writes, `io.to('workspace_<id>').emit(...)` pushes the change to every other open session in that workspace.

**A chat message:** frontend `POST /chat` with the raw text → backend looks up the caller's role once → sends the message plus the fixed `tools` array to Claude with a system prompt that resolves relative dates → if Claude requests a tool, the backend re-checks `can(role, module, action)` for that specific tool before executing it → the resulting task/reminder change goes through the identical Prisma call and socket emit as the REST path, so chat-driven and form-driven changes are indistinguishable downstream.

**A reminder firing:** the polling job finds `Reminders` rows where `reminder_date <= now` and `sent = false` → looks up the reminder's `user_id` (the chosen recipient, not necessarily the creator) → sends via Gmail → marks `sent = true` so it never fires twice.

## Key Decisions

| Decision | Reason | Alternatives Considered |
|---|---|---|
| Cascade delete for Workspace → Project → Task → Reminder (`onDelete: Cascade` in the Prisma schema) | None of these records have meaning independent of their parent, and this project has no trash/restore feature. Leaving orphaned projects/tasks referencing a deleted workspace would also reopen the exact "spoofed workspace_id" class of bug this project already fixed once. | **Soft delete** (a `deleted_at` column) — rejected: every read query would need a `deleted_at IS NULL` filter, for a restore UI that isn't in scope. **Block deletion until children are removed** — rejected: makes deleting a whole workspace tedious (delete every task, then every project, then the workspace) for no real safety benefit here, since this isn't a compliance/audit context. |
| A single JWT issued on signup/login/Google OAuth, used as the auth mechanism for *both* the frontend and any standalone API client | The brief asks for the backend to be independently usable via a token by another client. Rather than building session-cookie auth for the browser and a separate API-key system for everyone else, one Bearer token serves both — a `curl`/Postman client authenticates exactly the way the frontend does. | **express-session cookies for the browser + a separate API-token table for external clients** — rejected as duplicate machinery for what is functionally the same requirement: prove who you are on every request. |
| The permission matrix lives in one pure module (`permissions.js`), and every route calls a single `can(role, module, action)` helper | The original 3-role version of this app checked roles inline per-route (`role !== 'Admin' && role !== 'Editor'`), and these checks had already drifted inconsistently across routes by the time this rewrite happened. Centralizing the matrix means the spec and the enforcement are the same table, and it's unit-testable with zero database setup. | **Inline checks per route** (the original approach) — rejected because it already produced inconsistencies once and offers no single source of truth to test against. |
| `workspace_id` for a permission check is derived from the resource's actual parent record (e.g. `task → project → workspace_id`), never trusted from the request body | Earlier in this project, several routes (delete task, delete project, update task, create reminder) accepted a client-supplied `workspace_id` used only for the permission check, while the resource id (`task_id`, `project_id`) was looked up separately. A client could pair a real resource id from Workspace A with a `workspace_id` for Workspace B where they legitimately hold a high role, and pass the permission check while acting on the wrong workspace's data. Fixed by having the server look up the resource first and resolve its real workspace itself. | **Trust the client-supplied `workspace_id`** (the original implementation) — rejected once identified as a genuine authorization bypass; covered by a regression test in `tests/api.test.js`. |
| Real-time sync is scoped to per-workspace Socket.IO rooms (`workspace_<id>`), not a global broadcast | A global broadcast would send every workspace's task/project/member activity to every connected client, relying on the frontend to filter what it renders — meaning any connected browser tab could read another workspace's events by inspecting socket traffic even without UI for it. | **Broadcast every event to every client, filter client-side** — rejected as an unnecessary data-exposure surface and wasted bandwidth. |
| Reminders fire from a 60-second polling loop rather than per-reminder scheduled jobs | The reminder volume this app needs doesn't justify job-queue infrastructure (e.g. BullMQ + Redis), and a task reminder tolerates up to ~60 seconds of latency without any real user impact. | **A job queue with per-reminder scheduled jobs** — rejected as infrastructure the brief explicitly puts out of scope ("no containerized/multi-environment deployment infrastructure"), and unnecessary for this scale. |
| The chat agent is only ever given a fixed `tools` array and never direct database or code access | This is what makes the AI feature "grounded": every action the model can take is exactly one of four named tools, each of which re-runs the same `can()` permission check as its REST equivalent before doing anything. The model cannot do something on a user's behalf that user isn't allowed to do, because it has no path to the database that skips the permission layer. | **Give the model broader function-calling access (e.g. arbitrary Prisma queries)** — rejected outright; this would make the permission matrix meaningless for anything routed through chat. |
| An additional "reminder" module was added to the permissions matrix, with the same Owner/Admin/Member-full-CRUD, Viewer-read-only shape as "task" | Reminders are always scoped to a single task and only meaningful in that context (see the brief's invitation to "add rows for any additional module you introduce, in this same format"). Giving reminders their own row keeps the matrix table honest about a real, separately-enforced permission check, rather than silently reusing the task check without saying so. | **Fold reminder permissions into the task row without a separate matrix entry** — rejected for documentation honesty; the code enforces it as its own module (`can(role, 'reminder', action)`), so the matrix should say so. |
