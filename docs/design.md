# Design

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
