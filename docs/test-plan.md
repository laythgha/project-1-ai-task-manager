# Test Plan

## Objective

Confirm that the two riskiest parts of this app actually work the way the brief specifies: the permissions matrix (Owner/Admin/Member/Viewer, enforced per module) and the request-authentication layer that makes that matrix meaningful at all. A permission check is worthless if the caller's identity can be spoofed, so authentication and authorization are tested together.

## Scope

**Covered:**
- The `can(role, module, action)` permission-matrix helper (`src/permissions.js`), tested as pure logic against every cell of the matrix in `docs/design.md` / `docs/srs.md`.
- JWT authentication end to end: signup/login issuing a usable token, protected routes rejecting missing/invalid tokens, and confirmation that the previously-real vulnerability (trusting a client-supplied `user_id` with no token at all) is closed.
- Role enforcement across the real hierarchy (workspace → project → task) through the actual Express app and a real Postgres database, not mocks — including the exact scenario the brief calls out by name: a Viewer sending a delete request directly to the API gets a real 403, not a hidden button.
- A regression test for a real bug found during development: a route deriving its permission check from a client-supplied `workspace_id` instead of the resource's actual parent workspace, which would have let a user's legitimate role in one workspace authorize an action on a different workspace's resource.

**Deliberately not covered:**
- The chat agent's natural-language understanding (i.e. whether Claude correctly parses "remind me tomorrow at 3pm"). The agent's tool-calling code path reuses the exact same Prisma calls and `can()` checks already covered by the REST route tests, so the permission-relevant part of the chat agent is covered indirectly. Testing prompt quality would require live LLM calls in CI, which is unnecessary cost/flakiness for what this suite is actually trying to guarantee.
- Real-time Socket.IO delivery (i.e. that a second browser tab actually receives an emitted event). This is a full a WebSocket round trip and is better verified manually (two browser tabs) than with a brittle socket-client-in-a-test-runner setup, given the project's time budget.
- The Gmail send itself (i.e. that an email physically arrives in an inbox). `sendReminderEmail` calls a real third-party service; the reminder *logic* (which reminders are due, who they're addressed to, marking them sent so they don't fire twice) is the part worth automating, not Gmail's delivery.
- Frontend component tests. The brief's quality bar is "core task and permission logic," which lives entirely on the backend in this app.

## Test Environment

- **Unit tests** (`tests/permissions.test.js`): pure Node, no database, no network.
- **Integration tests** (`tests/api.test.js`): the real Express app (`src/index.js`, exported for `require()` rather than started as a server) via `supertest`, against a dedicated `task_manager_test` PostgreSQL database — never the developer's local `task_manager` database. `npm run test:setup` creates/migrates/seeds that database once; `npm test` runs against it from then on.
- Run from the repository root: `npm run test:setup` (once, or after a schema change), then `npm test`.

## Test Cases

| ID | Description | Steps | Expected Result | Status |
|---|---|---|---|---|
| TC-1 | Every role/module/action cell in the permissions matrix | Call `can(role, module, action)` for each combination in the Owner/Admin/Member/Viewer × workspace/member/project/task/reminder matrix | Return value matches the matrix table exactly | Pass |
| TC-2 | Unknown role, module, or action | Call `can(null, ...)`, `can('SuperAdmin', ...)`, `can('Owner', 'not_a_module', ...)`, `can('Owner', 'task', 'not_an_action')` | All return `false` (fail closed, never fail open) | Pass |
| TC-3 | Signup issues a usable token | `POST /signup` with valid name/email/password | 200, response includes both `userId` and a `token` | Pass |
| TC-4 | Login rejects a wrong password | `POST /login` with a real email and wrong password | 401 | Pass |
| TC-5 | Protected route with no `Authorization` header | `POST /workspaces` with no header | 401 | Pass |
| TC-6 | Protected route with a garbage token | `POST /workspaces` with `Authorization: Bearer not-a-real-token` | 401 | Pass |
| TC-7 | The old spoofing hole is closed | `POST /tasks` with `{ user_id: 1 }` in the body and no token | 401 (previously this would have succeeded and acted as user 1) | Pass |
| TC-8 | Workspace creator becomes Owner | `POST /workspaces`, then check the creator's membership row | `role_name` is `"Owner"` | Pass |
| TC-9 | Viewer can read but not create tasks | Viewer token: `GET /projects/:id/tasks` then `POST /tasks` | Read succeeds (200); create is denied (403) | Pass |
| TC-10 | **Viewer sending a delete request directly to the API** (named explicitly in the brief) | Viewer token: `DELETE /tasks/:id` | 403 with a real error message; task still exists afterward | Pass |
| TC-11 | Member can create/delete tasks but not delete a project | Member token: create + delete a task (both succeed), then `DELETE /projects/:id` | Task actions succeed; project delete is 403 | Pass |
| TC-12 | Admin can delete a project but not the workspace | Admin token: delete a project (succeeds), then `DELETE /workspaces/:id` | Project delete succeeds; workspace delete is 403 (Owner-only) | Pass |
| TC-13 | Admin can update but not remove a member | Admin token: `DELETE` a membership (403), then `PATCH` a membership's role (200) | Matches the matrix: Admin has Create/Read/Update but not Delete on workspace members | Pass |
| TC-14 | A user with no membership in a workspace is denied, not just downgraded | Non-member token: `POST /tasks` for a project in a workspace they don't belong to | 403 (role lookup returns `null`, `can(null, ...)` is always `false`) | Pass |
| TC-15 | Permission is derived from the resource's real workspace, not a client-supplied one (regression test) | A user who owns Workspace B tries to `DELETE` a task belonging to Workspace A, while sending `workspace_id` for Workspace B in the request body | 403 — the server resolves the task's actual workspace server-side and ignores the body value | Pass |

## Risks and Known Gaps

- The integration suite runs sequentially against a shared test database rather than each test owning fully isolated fixtures; test data is namespaced with a random per-run suffix to avoid collisions between runs, but tests within a file are not independent of execution order (later tests rely on state set up in `beforeAll`).
- No load/concurrency testing — two simultaneous requests racing to modify the same row (e.g. two admins changing the same member's role at once) aren't covered.
- The Gmail send path, Socket.IO delivery, and chat agent's natural-language parsing are exercised manually (see the Definition of Done walkthrough) rather than by this automated suite, for the reasons given in Scope above.
