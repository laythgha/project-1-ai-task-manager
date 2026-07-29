# Reflection

**Confidence score:** 8/10

## The Traced Bug

This is a real bug hit during deployment, not a synthetic one planted afterward — but the debugging process asked for by the brief (observe the symptom, form a hypothesis, verify it, fix the root cause rather than the symptom) applies identically either way, so it's documented here as that exercise.

### Symptom

After deploying the frontend and backend as separate Render services, every part of the app that touched the database failed silently or with a generic error, but Google sign-in was the strangest case: clicking "Sign in with Google," authenticating with a real Google account, and getting redirected back all worked — and then the browser landed on a page that just said **"Not Found."**

### Investigation

The instinct was to suspect the OAuth setup itself (wrong client ID, wrong authorized redirect URI in Google Cloud Console), since that's usually where Google sign-in breaks. But the fact that Google's own consent screen completed successfully and redirected back to *our* server ruled that out — the failure was happening *after* Google had already handed control back to the app.

That narrowed the search to one line in `src/index.js`:

```js
res.redirect(`${process.env.FRONTEND_URL}?userId=${req.user.id}`);
```

The fix for this only works if `FRONTEND_URL` actually points at the right place. Rather than guess, the next step was to compare the exact URL the browser landed on against the actual deployed frontend URL, character by character:

- Landed on: `https://project-1-ai-task-manager-frontt.onrender.com/?userId=1`
- Actual frontend: `https://project-1-ai-task-manager-1frontt.onrender.com`

### Root Cause

The `FRONTEND_URL` environment variable set on the Render **backend** service was missing a character — `frontt` instead of `1frontt` — so the redirect sent the browser to a domain that had never been provisioned at all. Render's own "domain not found" page rendered as a generic "Not Found," which read like an application bug rather than a one-character typo in a dashboard field.

The same variable is also used for CORS (`origin: process.env.FRONTEND_URL`), which explained a second, seemingly unrelated symptom at the same time: signup requests were failing with a generic "Something went wrong," because the browser's CORS preflight was being rejected by an origin allow-list that didn't match the real frontend origin either. One typo, two different-looking symptoms.

### Fix

Corrected the `FRONTEND_URL` value on the backend service to the frontend's actual URL (with the exact scheme and no trailing slash, since CORS origin matching is exact), then redeployed. Both the OAuth redirect and signup/login started working immediately, confirming the diagnosis rather than just coincidentally fixing something else.

### What this changed about how the app is built

This bug is also why authentication in this project no longer takes *any* identity fields from client-controlled input (see `docs/design.md`) — while investigating this and other early bugs, it became clear the original implementation trusted a `user_id` field sent in plain request bodies with no verification at all, which is a much more serious problem than a typo'd environment variable. That's what motivated the JWT rewrite: real bugs like this one are a good reminder to check assumptions about trust boundaries, not just fix the symptom in front of you.

## What Was Learned

- A generic error message ("Not Found," "Something went wrong") is a symptom, not a diagnosis — the same underlying misconfiguration produced two completely different-looking failures (OAuth redirect and CORS rejection) because they shared one root cause (`FRONTEND_URL`).
- Authorization is only as strong as the identity it's checking. A permissions matrix that trusts a client-supplied `user_id` isn't actually enforcing anything — it was the single biggest gap in the original implementation, and closing it (JWT + `authenticate` middleware) was more consequential than the role matrix itself.
- Client-supplied IDs used for *derived* permission checks (like a `workspace_id` alongside a `task_id`) need to be re-derived from the actual parent record server-side, not trusted, even when they look like they're "just" identifying which workspace room to broadcast to.

## What Surprised You

How much of the real risk in a role-based permissions system lives in the plumbing around the matrix — token verification, deriving the correct scope for a check — rather than in the matrix table itself. The Owner/Admin/Member/Viewer table was the easy part to get right; making sure every route actually asked the right question of the right data took far more care.

## What To Do Differently

Write the permission-matrix helper and the auth middleware *before* building out REST routes on top of ad hoc inline checks, rather than retrofitting them afterward. Retrofitting meant finding and fixing several routes that had already baked in the "trust the client's `workspace_id`" assumption before the central `can()` helper existed to make that assumption obviously wrong.
