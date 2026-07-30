# Design






                         ┌──────────────────────┐
                         │   Google OAuth 2.0   │
                         └──────────┬───────────┘
                                    │ 
┌───────────────┐   HTTPS   ┌──▼───────────────────────┐   SQL   ┌──────────────┐
│  React        │◄──────────────►│  Express API Node.js   │◄───────►│  PostgreSQL  │
│  frontend/    │   WebSocket    │  src/index.js            │ Prisma  │  (Prisma)    │
└───────────────┘◄──────────────►│  + Socket.IO server      │         └──────────────┘
                                  │                          │
                                  │  + permissions.js        │
                                  └───┬───────────┬──────────┘
                                      │           │
                              ┌───────▼──┐   ┌────▼─────────┐
                              │  Claude  │   │ Gmail        │
                              │  (chat)  │   │  reminders   │
                              └──────────┘   └──────────────┘
