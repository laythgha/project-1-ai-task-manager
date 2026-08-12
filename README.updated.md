# AI Task Manager

Live: https://project-1-ai-task-manager-1frontt.onrender.com

A workspace / project / task manager with role-based permissions (Owner, Admin, Member, Viewer),
real-time sync, email reminders, and an AI chat agent that can manage tasks for you — scoped to
whatever your role is allowed to do.

**Stack:** React + Vite (frontend), Express + Prisma + PostgreSQL (backend), Socket.IO (real-time),
Google OAuth + JWT (auth), Anthropic API (chat agent), Gmail API (reminders).

## Prerequisites

- Node.js 18+
- PostgreSQL
- A Google Cloud project with an OAuth Client ID and the Gmail API enabled
- An Anthropic API key ([console.anthropic.com](https://console.anthropic.com))

## Setup

```bash
# install
npm install && cd src && npm install && cd ../frontend && npm install && cd ..

# create the database
createdb task_manager
```

Create `src/.env`:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/task_manager"
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
SESSION_SECRET=any-random-string
ANTHROPIC_API_KEY=
GMAIL_USER=
GMAIL_REFRESH_TOKEN=
BACKEND_URL=http://localhost:3000
FRONTEND_URL=http://localhost:5173
```

Create `frontend/.env`:

```bash
VITE_API_URL=http://localhost:3000
```

Set up the database (run from the repo root):

```bash
(cd src && npx prisma generate && npx prisma migrate deploy)
```

The `Roles` table starts empty — seed it once (any Postgres client):

```sql
INSERT INTO "Roles" (role_name) VALUES ('Owner'), ('Admin'), ('Member'), ('Viewer');
```

In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), add
`http://localhost:3000/auth/google/callback` and `http://localhost:3000/oauth2callback` as authorized
redirect URIs, then run this once (from the repo root) to authorize Gmail sending and get
`GMAIL_REFRESH_TOKEN`:

```bash
(cd src && node scripts/get-gmail-refresh-token.js)
```

## Run it

```bash
# backend — http://localhost:3000
node src/index.js

# frontend — http://localhost:5173
cd frontend && npm run dev
```

Sign up or sign in with Google, create a workspace/project/task, try the chat agent, open a second tab
to watch real-time sync, and set a reminder to see a real email arrive.

## Test

```bash
npm run test:setup   # one-time: creates a test database and seeds roles
npm test
```

## Standalone API

The backend works independently of the frontend, authenticated with a bearer token:

```bash
curl -X POST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"yourpassword"}'

curl http://localhost:3000/users/1/workspaces \
  -H "Authorization: Bearer <token>"
```
