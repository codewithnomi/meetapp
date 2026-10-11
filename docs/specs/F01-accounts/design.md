---
feature: F01
title: Accounts & workspaces
status: approved
updated: 2026-10-11
---

# F01 Accounts & workspaces: Design (HOW)

## Summary (plain English)
- **Sign-in library:** a well-known open-source library, **Better Auth** (D020), handles the parts of signing in that are easy to get wrong:
  - storing passwords safely;
  - the 6-digit email codes;
  - Google and Microsoft sign-in;
  - "remember me" sessions;
  - "sign out everywhere".
- **Workspaces:** our own backend code handles workspaces, roles, invitations and requests to join. We follow our own rules there (one owner, any member can invite, approval for join requests), and every database query is checked so nobody can see another workspace (S2).
- **Desktop sign-in:** the desktop app keeps your sign-in in the Mac's Keychain. Only the app's hidden main part ever touches it; the screens never see it.
- **Google and Microsoft:** they open in your normal browser. The app waits, then picks up the sign-in by itself.
- **Updates:** the app checks with the server every 30 seconds and when you come back to the window. That's how renames, removals and "sign out everywhere" reach an open app within a minute.

Screens follow the approved designs (D029): canvas https://claude.ai/artifact/7Arjr3rCB8iTMM5KA3XXDJ, section "Accounts and workspaces (F01)", plus the existing "Sign in" and "Settings" screens.

## 1. What gets created
```
apps/api/src/
  plugins/auth.ts             Better Auth setup, its Fastify mount and the allow-list of its routes (section 3)
  plugins/session.ts          reads the session on every request (request.user); 401 if missing; terms gate
  plugins/rate-limit.ts       Redis counters for the per-email, per-user and per-address limits (S5)
  plugins/workspace-access.ts loads the caller's membership for :workspaceId; 404 if not a member (S2)
  emails/                     all email templates (HTML + text; words in emails/locales/en.json) and the outbox (BullMQ)
  modules/accounts/           sign-up with code, desktop hand-off, profile, preferences, photo
  modules/workspaces/         workspaces, members, roles (workspaces.permissions.ts)
  modules/invitations/        email invitations and the invitation web page (page/)
  modules/join-requests/      join link and code, requests to join, the daily expiry job
packages/db/src/schema/       auth tables (Better Auth) + workspace tables; migrations
packages/contracts/src/       Zod schemas for every new endpoint (shared with the app)
apps/web/src/
  app/router.tsx              routes (React Router): signed-out area, terms gate, signed-in area
  features/auth/              sign-in, code, sign-up, reset flows (TanStack Query + React Hook Form)
  features/workspaces/        switcher, create, join, people, requests
  pages/                      SignInPage, CreateAccountPage, CodePage, NewPasswordPage, TermsPage,
                              JoinWorkspacePage, PeoplePage, RequestsPage, ProfilePage
apps/desktop/src/main/
  auth-token.ts               keeps the sign-in token, encrypted with Electron safeStorage
  auth-bridge.ts              performs every sign-in call itself, so the token never reaches the page
  api-auth.ts                 adds the token to requests to the API (data and photos)
  provider-sign-in.ts         opens the browser for Google/Microsoft and collects the result
packages/ui                   new molecules/organisms: CodeInput, WorkspaceSwitcher, MemberRow, InviteForm,
                              JoinLinkCard, RequestRow, AvatarUpload; template AuthLayout
```
`docs/engineering/project-structure.md` gains these folders in the same change. Everything the API serves lives under `apps/api`, so the F00 backend container keeps working.

## 2. Screens and user flow
Names match the approved canvas.

- **Sign in** (existing design):
  1. You type your email and choose **Continue with email**.
  2. The **password step** always comes next, whether or not the email has an account (AC-05).
  3. From there: **Sign in**, **Email me a code instead** (AC-06) or **Forgot password?** (AC-09).
- **Google or Microsoft** (AC-07): the app shows "Finish signing in in your browser", a 4-digit **match code** and a **Cancel** button, and waits (section 4).
- **Create account** (AC-01): email, name, password and the terms tick. Then the **code** screen (AC-04), then home, in your personal workspace.
- **Code** screen: one screen serves three purposes (sign-up, sign-in, reset), named in the heading.
  - It has 6 boxes, and pasting works.
  - It shows a countdown.
  - **Send a new code** is always there (limited by section 9); after 5 wrong tries or when the code has expired it is the only way on.
- **New password** (AC-09): after the reset code. Saves the password and signs you in.
- **Terms** (AC-07): shown on first entry after a first Google/Microsoft sign-in. Nothing else works until it's accepted.
- **Workspace switcher** (AC-16): the top of the side menu, with "Create a workspace" and "Join with a link or code".
- **Create a workspace** (AC-15): a dialog; after creating, the app switches to the new workspace.
- **Join a workspace** (AC-18–20):
  - your pending invitations, with **Join** and **Decline**;
  - a link-or-code field, then the workspace card with **Ask to join**, then "Request sent".
- **People** (AC-17, 19, 21, 22):
  - invite by email (with a role choice for the owner and admins only);
  - the join link and code card (owner and admins only; members see only the copy buttons);
  - the member table, with an actions menu (Make admin, Make member, Remove, Hand over ownership) shown only to people allowed to use it.
- **Requests and invitations** (AC-17, 19), owner and admins only:
  - approve or reject requests, with a "removed earlier" badge;
  - sent invitations, with **Cancel** and **Send again**.
- **Profile and account** (AC-10, 12, 25):
  - photo, name, confirmed email, change password;
  - linked sign-in methods;
  - **Sign out** and **Sign out everywhere**;
  - the support email for data requests (a setting, `SUPPORT_EMAIL`).
- **Invitation web page** (AC-18): a static page served by the API at `/invite/<token>`.
  - It shows the workspace, who invited you, and the masked invited email.
  - If the invitation can't be used, it shows "no longer valid".
  - It has no sign-in and no forms.
- **Removed or renamed** (AC-21, 23, 24): when the 30-second check notices a change, the app shows "You are no longer a member of <name>", switches to Personal, and updates names.

## 3. Identity: Better Auth (identity only)
Better Auth (1.7 at T1; this design was written against the 1.6 docs and is re-checked in T3) runs inside the API (`plugins/auth.ts`) at `/api/auth/*`, stores its data with Drizzle in PostgreSQL, and is used only for **who you are**. Workspaces are our own module (section 5, D048). Items marked *(verify)* are checked against its docs and source at build time; the full list is at the end of this file.

**Only these Better Auth routes are reachable;** every other one answers 404 (`disabledPaths` or an allow-list in front of the mount *(verify)*):
- `sign-in/email`, `sign-in/email-otp`, `email-otp/send-verification-otp`;
- `forget-password/email-otp`, `email-otp/reset-password`;
- `sign-in/social`, `callback/*`;
- `sign-out`, `revoke-sessions`.

So Better Auth's own sign-up, update-user, change-email, delete-user, link/unlink and organization routes can't be used to get around our rules. The app's pages never call these routes directly (section 4).

Plugins and settings:
- **`emailOTP`:** `otpLength: 6`, `expiresIn: 900` (15 min), `allowedAttempts: 5`, `storeOTP: "hashed"`, `overrideDefaultEmailVerification: true`, `disableSignUp: true`. `sendVerificationOTP` only queues the email and is never awaited, so timing doesn't reveal anything.
- **`bearer`:** the desktop app sends `Authorization: Bearer <token>`. The app never uses cookies.
- **Social providers:** `google` and `microsoft` (tenant `common`), each switched on only when its client id and secret are set (AC-07). `GET /api/v1/auth/providers` tells the app which buttons to show.
- **Verified provider email only (AC-08):**
  - Google: `email_verified` must be true.
  - Microsoft: the `xms_edov` optional claim must be true (set up in the app registration), or the account must be in Microsoft's consumer tenant. This avoids the known "nOAuth" problem.
  - Otherwise the sign-in is refused with `PROVIDER_EMAIL_UNVERIFIED` (checked in the provider's profile mapping).
  - Account linking is on, but Google and Microsoft are **not** "trusted providers", because trusted providers link even unverified emails *(verify)*.
- **Sessions:**
  - 30 days, extended by every day of use (`expiresIn` 30 d, `updateAge` 1 d: AC-11).
  - Kept in PostgreSQL only.
  - No IP addresses or browser names are stored, because no F01 feature needs them (privacy).
  - Session tokens stored only as hashes *(verify; if Better Auth can't, D048 records the exception and the owner is told before building)*.
- **Passwords:**
  - Better Auth's default **scrypt** hash, a slow one-way hash made for passwords (AC-33). 10–128 characters.
  - A hook refuses the 10,000 most common passwords (a bundled list, checked offline).
  - After a reset every session is revoked (`revokeSessionsOnPasswordReset`) and a new one is made for this computer (AC-09).
- **Provider tokens** are stored encrypted (S8, Better Auth's token-encryption option *(verify)*).
- **User fields added**, none of them settable through Better Auth (`input: false`): `termsVersion`, `termsAcceptedAt`, `ageConfirmedAt`, `theme`, `accent`, `lastWorkspaceId`, `avatarKey`. `user.image` is never shown directly (section 6).
- **Personal workspace:** created through the **workspaces service** after a user is created, as insert-or-ignore with a unique rule (one per user). `GET /api/v1/me` repairs it if it is missing (AC-14).
- **Our limits on Better Auth routes:**
  - a `hooks.before` on `sign-in/*`, `email-otp/*` and `forget-password/*` applies `plugins/rate-limit.ts` (section 9);
  - counters grow even when no account exists or no email is sent;
  - an unknown email does the same password-hash work as a wrong password, so timing doesn't reveal anything *(verify)*.

### Our sign-up flow (accounts exist only after the code: AC-01, 02, 04)
Better Auth's own email sign-up would create the account before the email is proven, so we wrap it.

1. **`POST /api/v1/auth/sign-up`** `{ email, name, password, termsAccepted: true, theme, accent }`
   1. Validate the input (AC-03).
   2. **Always** hash the password and write to the queue, so both paths below take the same time.
   3. If the email already has an account: queue the "someone tried to create an account" email (at most 1 per hour per address).
   4. Otherwise, create a **pending sign-up** in Redis for 15 min under a random `signupId`. It holds the email, name, password hash, terms version, theme, accent and the hashed 6-digit code. Then queue the code email.

   Both paths answer `202 { signupId, next: "code" }` in the same way. A new sign-up for the same email creates a **separate** pending record and never changes another one, so nobody can swap in their own password.
2. **`POST /api/v1/auth/sign-up/verify`** `{ signupId, code }`
   - Up to 5 tries per pending record (then it is gone); the code is compared in constant time.
   - In **one database transaction**: create the user (email verified), the password login from the stored hash, the terms and 16+ dates, the theme/accent, and the personal workspace.
   - The unique email rule stops a double click, or a second pending record, from making a second account; the later one gets `CODE_INVALID`.
   - The Redis record is deleted after the commit.
   - The session token goes only to the desktop main process (section 4).
   - For an email that already had an account, `verify` always answers `CODE_INVALID`, with the same counting.

## 4. Desktop sign-in and the token (AC-07, 11, 12, 34)
- **The page never sees the token.** Better Auth returns the token in response headers and bodies, so the page may not call any route that creates a session:
  - The main process **cancels** any request from the page to `/api/auth/*`, `/api/v1/auth/sign-up/verify` and `/api/v1/auth/desktop/*` (`session.webRequest.onBeforeRequest`).
  - Instead, the preload bridge offers `meetapp.auth`:
    - `signInWithPassword(email, password)`, `requestCode(email, purpose)`, `signInWithCode(email, code)`;
    - `startSignUp(form)`, `finishSignUp(signupId, code)`, `resetPassword(email, code, newPassword)`;
    - `startProviderSignIn(provider)`, `cancelProviderSignIn()`;
    - `signOut()`, `signOutEverywhere()`, `status()`.
  - Main makes each call itself with `net.fetch`, keeps the token, and returns only `{ ok, user }` or an error code to the page.
  - Main accepts these messages only from the app's own window and page origin.
- **Storage:** the token is encrypted with Electron **safeStorage** (the key is held by the macOS Keychain, or Windows' DPAPI) and saved in the app's data folder. If encryption isn't available, the token is kept in memory only, and the user signs in again after a restart.
- **Use:** `session.webRequest.onBeforeSendHeaders` adds `Authorization: Bearer <token>` to every request to the API origin, photos (`<img>`) included. The F00 CORS setting gains `authorization` and `idempotency-key` as allowed headers.
- **Sign out:**
  - **Sign out:** main calls `/api/auth/sign-out` (best effort), then deletes the token.
  - **Sign out everywhere:** main calls `/api/v1/auth/sign-out-everywhere`, then deletes the token.
  - A `401` from `GET /api/v1/me` also deletes it; a 401 from any other route triggers a `/me` check first.
  - A wrong current password answers `400 PASSWORD_WRONG`, never 401.
- **Google and Microsoft (browser hand-off):**
  1. Main makes a secret `verifier` and calls `POST /api/v1/auth/desktop/init { provider, challenge: SHA-256(verifier) }`. The API answers `{ requestId, matchCode }` (a 4-digit code). The request must be started within 60 s.
  2. Main opens the system browser at `/api/v1/auth/desktop/start?request=<requestId>`.
     - In development the API is `http://127.0.0.1`, so F00's "open only https links" rule (D040) is extended: it also allows exactly the configured API's `/api/v1/auth/desktop/start` when that API is on this computer. Never in the packaged app.
     - `start` sets a short-lived, signed, http-only cookie that binds this browser to the request, then redirects to the provider.
  3. After the provider, `done` checks the cookie and shows "Sign in to the MeetApp app on this computer? Code **4821**" with **Continue** and **Cancel**. The app shows the same code.
     - On **Continue** the request is marked ready, the browser's own session is revoked (the browser keeps nothing), and the page says "You can close this tab".
     - On **Cancel**, or if the provider refused, the request is marked cancelled.
  4. Meanwhile main polls `POST /api/v1/auth/desktop/exchange { requestId, verifier }` every second. Answers:
     - `202 pending`;
     - `410 cancelled`;
     - `200` exactly once: the API creates a **new session for the desktop**, and main stores its token.

     A wrong verifier deletes the request; the verifier is compared in constant time.
  5. The app gives up after 5 minutes, or at once when the user presses **Cancel** in the app, and shows "Sign-in was cancelled". A closed browser tab can't be detected, so until then the app keeps waiting (AC-07 wording updated with the owner).
  - **Why this way:** it needs no `meetapp://` link (F04, D022) and no local web server, and it works in development. The verifier makes a stolen request id useless. The match code, the click, the browser cookie and the 60-second start window make it hard to trick someone into finishing a sign-in that an attacker started. The remaining risk, a user who confirms a code without looking, is written in D048.
- **Staying signed in:** at start the app asks main for `status()`. If the stored token works (`GET /api/v1/me`), the app opens the signed-in area (AC-11).
- **CSP:** F00's `img-src 'self' data:` gains the API origin, so photos load (AC-25).

## 5. Workspaces (own module, S2)
- **Roles:** exactly **one owner** per company workspace (a database rule), any number of admins and members. The personal workspace has only its owner and allows no invitations, join link, rename, leaving or hand-over (AC-14); such actions answer `409 PERSONAL_WORKSPACE`.
- **Terms gate (S1):** until `termsAcceptedAt` is set, every `/api/v1` route except `GET /me`, `POST /me/terms` and sign-out answers `403 TERMS_REQUIRED`.
- **Access check:**
  - Every route with `:workspaceId` runs `workspace-access` first. It loads `(workspaceId, userId)` from `workspace_members`. If there is no row, the answer is **404 `NOT_FOUND`**, the same as for an id that doesn't exist (AC-31).
  - Services receive `{user, membership}`.
  - Every repository function that reads workspace data takes `workspaceId` and filters by it.
  - Role checks live in one place, `workspaces.permissions.ts`, a table of action → allowed roles. A refusal is `403 FORBIDDEN` (AC-32).

| Action | Owner | Admin | Member |
|---|---|---|---|
| See members, copy join link/code | ✓ | ✓ | ✓ |
| Invite as member | ✓ | ✓ | ✓ |
| Invite as admin | ✓ | ✓ | – |
| Cancel invitation | ✓ | ✓ | only their own |
| Turn link/code on/off, replace | ✓ | ✓ | – |
| Approve / reject requests | ✓ | ✓ | – |
| Rename | ✓ | ✓ | – |
| Make member → admin, remove member | ✓ | ✓ | – |
| Make admin → member, remove admin | ✓ | – | – |
| Hand over ownership | ✓ | – | – |
| Leave | – (hand over first) | ✓ | ✓ |

- **Invitations (AC-17, 18):**
  - Emails are trimmed and lower-cased before they are stored or matched.
  - The token is 32 random bytes; only its SHA-256 hash is stored. It is valid 7 days.
  - An admin invitation is checked again when accepted: if the sender is no longer the owner or an admin, the person joins as a member.
  - There is one pending invitation per (workspace, email). A new one replaces the old: status `replaced`, new token, new email.
  - The limit is 50 invitation emails per sender per day, a Redis counter kept for 24 h.
  - "Already a member" is checked before sending.
  - The invited email sees the invitation in the app: `GET /api/v1/me/invitations` matches the verified email of the signed-in user. Accepting checks the email again on the server, so only the invited address can use it.
- **Join link and code (AC-19):**
  - Each workspace has one `join_secret`: 24 random bytes for the link, plus a 10-character code (letters and digits, without look-alikes like 0/O and 1/I).
  - Both are stored **encrypted** (AES-256-GCM, with a key version), because members must be able to copy them again later. Lookup uses a separate keyed hash (HMAC) column, so the database is never searched by the secret itself. Both keys come from `DATA_ENCRYPTION_KEY` through HKDF, with different labels.
  - AC-33's "stored only as hashes" covers invitation links and codes; the join link is reversible on purpose.
  - A wrong, switched-off or replaced link or code gets the same 404, and lookups are limited (section 9).
  - Replacing makes a new secret; the old one stops at once.
  - Using it creates a `join_requests` row (`pending`, one per (workspace, user)). The owner and admins get an in-app badge and an email.
  - Approve adds the person as a member; reject closes the request. Either way the person gets an email, and the app shows it on the next check.
  - Pending requests older than 14 days are set to `expired` by a daily job (BullMQ) and also treated as expired when read.
- **Removal (AC-21, 23):** deletes the membership row (their content stays, owned by the workspace) and writes a `member_removals` row, used for the "removed earlier" badge. Their next request in that workspace gets 404.
- **Hand-over (AC-22):** one transaction swaps the roles: the old owner becomes admin, the new one owner.
- **Limits (AC-15):** a user can own at most 20 company workspaces at a time, checked in the service. A hand-over counts for the new owner.

## 6. Profile, photo and preferences (AC-25, 26)
- **Name:** 1–60 characters, trimmed. Shown everywhere as plain text (React escapes it; emails escape it: AC-35).
- **Photo upload:**
  - `PUT /api/v1/me/avatar` (multipart, at most 5 MB).
  - The type is checked from the file's **content** (magic bytes), not its name: only JPEG, PNG or WebP.
  - **sharp** re-encodes it to a 512×512 WebP, with a pixel limit (`limitInputPixels`) against "decompression bomb" files. This also drops location and camera details.
  - Stored privately as `avatars/<userId>/<avatarKey>.webp` in the storage bucket.
  - Served by `GET /api/v1/users/:id/avatar?v=<avatarKey>` only to people who share a workspace with that user (or the user); everyone else gets 404. `Cache-Control: private, max-age=60`.
- **Google/Microsoft photo:** fetched once at the first sign-in, only from Google's or Microsoft's own addresses, with 5 MB and 5 s limits, through the same steps. Better Auth's `user.image` is never shown directly.
- **Theme and accent:** saved with `PATCH /api/v1/me/preferences`.
  - At sign-in the app takes the account's values; the appearance store from F00 is replaced.
  - At sign-up the computer's current values are sent along.
  - After sign-out the local store keeps the last values.

## 7. Data stored (migrations in `packages/db`)
| Table | Main columns | Why |
|---|---|---|
| `user` (Better Auth) | id, name, email (unique, lower-case), email_verified, image, + terms_version, terms_accepted_at, age_confirmed_at, theme, accent, last_workspace_id, avatar_key, created_at, updated_at | The account |
| `session` (Better Auth) | id, token (hashed, *verify*), user_id, expires_at (no IP address or browser stored) | "Remember me" and sign out everywhere |
| `account` (Better Auth) | id, user_id, provider_id (credential/google/microsoft), account_id, password (scrypt hash), access/refresh tokens (encrypted) | Ways to sign in |
| `verification` (Better Auth) | id, identifier, value (hashed code), expires_at | Email codes |
| `workspaces` | id, name, kind (`personal`/`company`), created_by, join_enabled, join_secret_enc, join_key_version, join_lookup_hmac (unique), created_at, updated_at; **unique partial (created_by) where kind = personal** | Workspaces |
| `workspace_members` | id, workspace_id, user_id, role (`owner`/`admin`/`member`), created_at (= joined), updated_at; unique (workspace_id, user_id); **unique partial index: one owner per workspace** | Who is in which workspace |
| `invitations` | id, workspace_id, email, role, token_hash (unique), invited_by, status, expires_at, created_at, updated_at; unique partial (workspace_id, email) where pending | Email invitations |
| `join_requests` | id, workspace_id, user_id, via (`link`/`code`), status, decided_by, decided_at, created_at, updated_at; unique partial (workspace_id, user_id) where pending | Requests to join |
| `member_removals` | id, workspace_id, user_id, removed_by, created_at (= removed), updated_at | "Removed earlier" badge, history |

Redis (not tables):
- pending sign-ups (15 min);
- desktop hand-off requests (60 s to start, 5 min in all);
- rate-limit counters;
- idempotency keys (10 min).

Better Auth's tables follow its core schema (checked against its docs in T2) and are written as normal Drizzle tables in `packages/db/src/schema/auth.ts`, with database-made UUIDs and times with time zone; migration `0001_accounts_workspaces` (`/db-migration`). Columns that record **who did something** (`invited_by`, `decided_by`, `removed_by`) are kept as "unknown" (set to empty) if that account is ever deleted, so the history stays; rows **about** a person go with their account.

## 8. Backend endpoints (all JSON, Zod schemas in `packages/contracts`, OpenAPI at `/docs`)
| Endpoint | Who | What |
|---|---|---|
| `/api/auth/*` | public | Better Auth: password sign-in, code sign-in, reset code, social callbacks, sign-out, revoke sessions |
| `GET /api/v1/auth/providers` | public | which of Google/Microsoft are configured |
| `POST /api/v1/auth/sign-up` | public | start sign-up (section 3) |
| `POST /api/v1/auth/sign-up/verify` | public | finish sign-up with the code |
| `POST /api/v1/auth/desktop/init` · `GET /start` · `GET`/`POST /done` · `POST /exchange` | public (main process or browser) | browser hand-off (section 4) |
| `POST /api/v1/auth/sign-out-everywhere` | signed in | revoke every session (AC-12) |
| `GET /api/v1/me` | signed in | profile, preferences, workspaces with role, counts of pending requests (the 30-second check) |
| `POST /api/v1/me/terms` | signed in | accept terms + 16+ (first Google/Microsoft sign-in) |
| `PATCH /api/v1/me` · `PATCH /api/v1/me/preferences` · `PUT/DELETE /api/v1/me/avatar` | signed in | profile, theme/accent, photo |
| `POST /api/v1/me/password` | signed in | change password (current one or an emailed code); revokes other sessions |
| `GET /api/v1/users/:id/avatar` | shares a workspace | photo |
| `GET /api/v1/me/invitations` · `POST /api/v1/invitations/:id/accept` · `/decline` | invited email | invitations for me |
| `POST /api/v1/join/lookup` | signed in | `{linkOrCode}` → workspace name and size (no other data) |
| `POST /api/v1/join/request` | signed in | ask to join |
| `POST /api/v1/workspaces` | signed in | create (Idempotency-Key header) |
| `PATCH /api/v1/workspaces/:workspaceId` | owner/admin | rename |
| `GET /api/v1/workspaces/:workspaceId/members` | member | member list |
| `PATCH` · `DELETE /api/v1/workspaces/:workspaceId/members/:userId` | by role table | change role, remove |
| `POST /api/v1/workspaces/:workspaceId/leave` · `/transfer` | member · owner | leave, hand over |
| `GET` · `POST /api/v1/workspaces/:workspaceId/invitations` · `DELETE …/:id` · `POST …/:id/resend` | by role table | invitations |
| `GET` · `PUT /api/v1/workspaces/:workspaceId/join-link` · `POST …/join-link/replace` | member (view) · owner/admin | join link and code |
| `GET /api/v1/workspaces/:workspaceId/requests` · `POST …/:id/approve` · `/reject` | owner/admin | requests |
| `GET /invite/:token` | public | invitation web page (HTML; `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex`, strict CSP, limited per network address) |

Errors use the F00 format: 400, 401, 403, 404, 409 (`ALREADY_MEMBER`, `PENDING_REQUEST`), 410 (expired or cancelled invitation), and 429 `TOO_MANY_ATTEMPTS` with `retryAfterSeconds`.

## 9. Rate limits (AC-13, S5)
`plugins/rate-limit.ts` keeps fixed-window counters in Redis. Email-based counters are keyed by an HMAC of the lower-cased email and grow whether or not an account exists.

| Limit | Count | Window |
|---|---|---|
| Wrong passwords per email (Google/Microsoft attempts count too) | 5 | 15 minutes |
| Code emails per email address (sign-up, sign-in, reset) | 5 | 1 hour |
| Sign-ups per network address | 50 | 1 hour |
| Invitation emails per user | 50 | 24 hours |
| Join lookups and requests, per user / per network address | 20 / 60 | 1 hour |
| Invitation page views per network address | 60 | 1 hour |
| Desktop hand-off starts per network address | 20 | 1 hour |

Better Auth's own per-address limiter stays on as a second layer. A refused try answers `429 TOO_MANY_ATTEMPTS` with `retryAfterSeconds`, the same for unknown emails.

## 10. Emails
Templates live in `apps/api/src/emails/`, with text from the translation files; each has an HTML version and a plain-text version (AC-27):
- the code email (the code shown large, its validity, "If you didn't ask for this, ignore this email");
- invitation;
- request to join (sent to the owner and admins);
- request decided;
- "someone tried to create an account".

They are sent through the F00 email provider (Mailpit locally) by a **BullMQ** job (its worker runs inside the API process for now), so an email failure never blocks a request and timings don't vary. The same queue runs the daily join-request expiry.

## 11. App behaviour (AC-16, 23, 24, 29)
- **Server data:** TanStack Query (planned in frontend.md).
- **The background check:** `GET /api/v1/me` runs every 30 s and when the window gains focus. Open member lists and requests refetch on the same rhythm, so names and photos are at most a minute old (AC-24, 25).
  - A `401` clears the session and shows Sign in.
  - A workspace that is gone from the list while open switches to Personal with "You are no longer a member of <name>".
- **Network:**
  - All calls go through one client with a **10 s timeout**.
  - On a timeout or network error the screen shows "Can't reach MeetApp. Check your connection." with **Retry**.
  - Buttons are disabled while a request runs.
  - Creating workspaces sends an `Idempotency-Key`. Invitations and join requests are protected by the unique "pending" rules, so a double click never makes two (AC-29).
- **Routing:** React Router, with two areas (signed out, signed in) and a terms gate. The last-used workspace is saved on the account (`lastWorkspaceId`), with Personal as the fallback.

## Edge cases and errors
- **Code emails and Google/Microsoft limits:**
  - Codes are limited per address. A code email that fails to send is retried by the job; the screen still offers **Send a new code**.
  - Google or Microsoft is down: the browser shows their error, and the app's 5-minute wait ends with "Sign-in was cancelled".
  - The provider gives no email or an unverified one: refused (AC-08).
- **Invitations and join requests:**
  - An invitation is accepted after its workspace was deleted: not possible in F01 (deleting comes in F10); the code path returns 410 anyway.
  - A user is in a workspace and opens its link or invitation again: 200 with "You're already a member", nothing changes (AC-20).
  - Two admins approve the same request at once: the request row is updated only when still `pending`, and the second admin gets "already decided".
- **Owner and roles:** the owner tries to leave: 409 `OWNER_MUST_TRANSFER`. A member tries to make themselves an admin: 403.
- **Sign-out everywhere:** done while offline on another device; that device's next request gets 401 and shows Sign in.
- **Clock differences** don't matter: every expiry is checked on the server.

## Seed data (AC-30)
`pnpm seed` (F00's seed, extended):
- users are made with Better Auth's password hasher and the local test password `meetapp-dev-password` (written in the runbook);
- all of them have `@example.test` emails: an owner, an admin and a member of the company workspace "Example team", plus one user with a pending join request;
- running it twice adds nothing; `pnpm seed:clear` removes only these;
- it refuses to run unless `NODE_ENV` is `development` or `test` **and** the database is on this computer.

## Security and privacy
- **S1:** every `/api/v1` route needs a session except the public ones listed in section 8, which carry their own limits. The terms gate is in section 5. **Every route is listed in a test**, so a new route can't be left unprotected by mistake.
- **S2:** workspace access as in section 5. An automated test calls **every workspace route** as an outsider and expects 404 (AC-31).
- **S5:** the limits in section 9.
- **S7:** new settings in `.env.example`, checked at start-up:
  - `BETTER_AUTH_SECRET` (32+ characters);
  - `DATA_ENCRYPTION_KEY`;
  - `GOOGLE_*`, `MICROSOFT_*` (optional);
  - `SUPPORT_EMAIL`;
  - `APP_PUBLIC_URL`.
- **S8:** provider tokens and the join secret are encrypted.
- **S10:**
  - The log redaction gains exact paths: `req.body.password`, `newPassword`, `currentPassword`, `req.body.code`, `*.otp`, `*.verifier`, `*.token`. Error `code` fields stay visible.
  - Request bodies of `/api/auth/*` and `/api/v1/auth/*` are never logged.
  - A test sends each kind of secret through every auth endpoint and checks logs, traces and Sentry (AC-33).
- **S11:** every input passes a Zod schema; names are plain text everywhere (AC-35).
- **S12:** photos as in section 6.
- **Electron:** the token stays in main and sign-in calls go through main. The CSP and the "open external links" rule are extended only as described in section 4 (AC-34).
- **Desktop hand-off:** see section 4 (verifier, match code, browser cookie, 60-second start, new desktop session, browser session revoked, `no-store` pages).
- **Privacy:**
  - the terms version and dates are stored;
  - no IP addresses or browser names are stored with sessions;
  - emails are visible only to members of the same workspace (D046);
  - photos only to people who share a workspace.

## Cost impact
None.
- Better Auth, sharp and the common-password list are free.
- Google and Microsoft sign-in are free to set up. The owner creates the keys only when they want to try real Google/Microsoft sign-in, using a step-by-step note in `docs/runbooks/sign-in-providers.md`.
- Tests use a local fake sign-in provider and never need real keys.

## Test approach
Levels:
- **unit:** services, permissions table, rate limits, password rules, email templates;
- **integration:** real PostgreSQL and Redis, Better Auth running, a local fake OpenID provider standing in for Google/Microsoft (`oauth2-mock-server`, a dev-only library vetted with `/add-dependency`), Mailpit to read the codes;
- **e2e:** real Electron windows; the hand-off is tested by opening the start URL in a second Playwright browser that signs in at the fake provider;
- **security:** the S1/S2 route sweeps and the log, trace and Sentry checks;
- **visual:** Storybook stories for the new components.

| AC | How it's tested |
|---|---|
| 01, 02, 03, 04 | integration (sign-up, pending sign-up, codes from Mailpit, duplicate email sends "someone tried", password rules) + e2e (create account → code → home) |
| 05, 06 | integration (same answer for unknown email, timing within a margin) + e2e (password step, code sign-in) |
| 07, 08 | integration with the fake provider (first sign-in, terms gate, photo, cancel, 5-minute timeout, unverified email refused, linking) + e2e hand-off; manual check with real Google/Microsoft keys is optional (owner) |
| 09, 10 | integration (reset code, password change, other sessions revoked) + e2e |
| 11, 12 | integration (30-day sliding session, revoke all) + e2e (restart keeps you signed in; sign out everywhere: a second session gets 401, the open app shows Sign in within 1 min) |
| 13 | integration (each limit, join lookups included; same message and same timing margin for unknown emails; Redis counters) |
| 14, 15, 16 | integration (personal workspace auto-created and locked; create; 20 limit) + e2e (switcher, last used, fallback to Personal, switch < 1 s measured) |
| 17, 18 | integration (roles, limits, replace, cancel, only invited email, 7 days) + e2e (invite → Mailpit → join) + unit (invitation page HTML) |
| 19, 20 | integration (link/code on/off/replace, request, approve/reject, 14-day expiry, removed person asks again, already a member) + e2e (ask to join → approve) |
| 21, 22, 23, 24 | integration (role table for every action, hand-over transaction, leave/remove → 404 at once, rename) + e2e (removed while app open → Personal within 1 min) |
| 25, 26 | integration (photo type by content, size, pixel limit, EXIF removed, visibility, caching) + e2e (theme follows the account on another profile; a new account starts with the computer's choice) |
| 27 | unit (each email: plain-text version, name/logo, validity, never asks for a password, translation keys) |
| 28 | Storybook + axe (accessibility) for new components; e2e keyboard-only pass through sign-in and People; ui-reviewer against the canvas |
| 29 | e2e with the API stopped (message + Retry), integration (double submit → one row) |
| 30 | integration (`pnpm seed` twice, `seed:clear`, refuses outside local) |
| 31 | security: outsider sweep over every workspace route → 404; wrong or old join codes → the same 404 |
| 32 | security: member sweep over every owner/admin action → 403 |
| 33 | security: secrets never in logs, traces, Sentry; hashes in the database |
| 34 | e2e: the page can't reach `/api/auth/*`, and the token isn't in storage, cookies or any response the page sees; unit: safeStorage use and the memory-only fallback; security: a hand-off with a foreign request id fails |
| 35 | unit + e2e: a name like `<img src=x onerror=…>` shows as text in the app, emails and the invitation page |

## Verify at build (Better Auth and Microsoft details)
Each item is checked against the current docs and source before the task that uses it. Anything that differs updates this design first.
1. Which Better Auth routes return the token in the body or headers, and that the allow-list or `disabledPaths` blocks the rest.
2. The emailOTP options `storeOTP: "hashed"`, `allowedAttempts`, `disableSignUp`, `overrideDefaultEmailVerification`.
3. Creating a user and its password login from an existing scrypt hash (server API), inside our transaction.
4. Session tokens stored as hashes; sessions kept only in PostgreSQL.
5. Encrypting provider tokens; `revokeSessionsOnPasswordReset`; whether a reset signs the user in.
6. Account linking without "trusted providers"; the Microsoft `xms_edov` claim and the consumer-tenant check.
7. Signing in with an unknown email takes as long as a wrong password.
8. A Microsoft photo arriving as data in `user.image` (we ignore it and fetch the photo ourselves).

**Checked in T3 (Better Auth 1.7.7, source read):**
- Item 1: `disabledPaths` is a block list, so our Fastify route keeps its own **allow-list** and forwards nothing else.
- Item 2: all four emailOTP options exist.
- Item 4: Better Auth stores session tokens readable and looks them up by value. A thin wrapper around its database adapter therefore stores only a SHA-256 fingerprint of each session token and looks up by fingerprint, so AC-33 holds (D048).
- Item 5: `revokeSessionsOnPasswordReset` and `account.encryptOAuthTokens` exist.
- Item 7: password sign-in hashes the given password even for an unknown email, so timing matches.
- Items 3, 6 and 8 are checked in T5 and T7.

## Decisions made here
- **D048 (proposed):**
  - Better Auth for identity only, with workspaces as our own module;
  - the desktop app's token kept in main with safeStorage and sent as a bearer token;
  - a browser hand-off with a secret verifier for Google/Microsoft;
  - our own sign-up wrapper, so accounts exist only after the code.
- **D049 (proposed):** new libraries for F01, each to be vetted with `/add-dependency` before use:
  - `better-auth`;
  - `react-router`;
  - `@tanstack/react-query` and `react-hook-form` (already planned in frontend.md);
  - `sharp` (photos);
  - `oauth2-mock-server` (dev only, tests);
  - a common-passwords list file.
