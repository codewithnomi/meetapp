---
feature: F01
title: Accounts & workspaces
status: done
updated: 2026-10-11
---

# F01 Accounts & workspaces: Test Cases

Written **before** the code. Each test case becomes an automated test, except those marked **manual** (recorded in `verification.md`).
Levels: unit · integration · e2e (real Electron window, Playwright) · security · performance · visual (Storybook) · manual.

Test names must include the TC and AC IDs, e.g. `TC-F01-08 [AC-F01-04] wrong code is refused`.

**Test set-up (design.md "Test approach"):**
- Integration and security tests use real PostgreSQL and Redis, Better Auth running, and Mailpit to read emails (codes, invitations).
- Google and Microsoft are tested with a local fake OpenID provider (`oauth2-mock-server`); no real keys are needed. A real-provider check is the optional manual TC-F01-24.
- The e2e hand-off opens the start URL in a second Playwright browser that signs in at the fake provider.
- "Another user", "outsider" and "member" mean seeded users in the workspace named in the test. "Same answer" means same status code, same body shape and same message.
- Timing checks compare the median of 30 calls and allow a margin of 150 ms or 30%, whichever is larger (no clock tricks: the real clock is used, expiry tests move time with fake timers on the server).
- Seed users from AC-F01-30 (`@example.test`, password `meetapp-dev-password`) are used wherever a test needs an existing account.

## Test cases

### Sign up

### TC-F01-01: Create an account, from the form to the home screen
- **Covers:** AC-F01-01, AC-F01-04, AC-F01-14
- **Level:** e2e
- **Given** the desktop app on the sign-in screen and Mailpit empty
- **When** the user chooses Create account, enters email, name and a good password, ticks the terms and 16+ box, reads the 6-digit code from Mailpit and types it
- **Then** the app shows the home screen in the workspace "Personal", and the user is signed in

### TC-F01-02: Start of sign-up emails a code and stores the terms
- **Covers:** AC-F01-01
- **Level:** integration
- **Given** an email with no account
- **When** `POST /api/v1/auth/sign-up` is called with valid data and `termsAccepted: true`
- **Then** it answers `202 { signupId, next: "code" }`, one email with a 6-digit code arrives, and no user exists yet. After `sign-up/verify`, the user row has `termsVersion = draft-1`, `termsAcceptedAt` and `ageConfirmedAt` set

### TC-F01-03: Sign-up without the tick is refused
- **Covers:** AC-F01-01
- **Level:** integration
- **Given** a valid sign-up body
- **When** `termsAccepted` is `false`, missing, or the string `"true"`
- **Then** each answers 400 with a field error, no pending sign-up is stored and no email is sent. The form's submit button also stays disabled until the box is ticked (component test)

### TC-F01-04: Sign-up with an existing email looks the same and warns the owner
- **Covers:** AC-F01-02
- **Level:** integration
- **Given** a seeded user `owner@example.test`
- **When** someone calls sign-up with that email
- **Then** the answer is `202 { signupId, next: "code" }` with the same shape as for a new email, no second account exists, no code email is sent, and the account's owner gets the "someone tried to create an account" email (reminder of how to sign in or reset). A second and third try in the same hour send no further notice emails

### TC-F01-05: A second sign-up for the same email cannot take over the first, security
- **Covers:** AC-F01-02, AC-F01-04, AC-F01-33
- **Level:** security
- **Given** a victim starts sign-up for `new@example.test` with password A (pending record 1) and an attacker starts sign-up for the same email with password B (pending record 2)
- **When** the victim verifies with their code, and later the attacker verifies with the code from record 2
- **Then** the account has password A and the victim's name; the attacker gets `CODE_INVALID`; the attacker's pending record never changes record 1; and the attacker cannot sign in with password B

### TC-F01-06: Password rules
- **Covers:** AC-F01-03
- **Level:** unit
- **Given** the password rule
- **When** passwords of 9 characters, 10 characters, 128 characters, 129 characters, and a password from the common list (for example `password123`) are checked
- **Then** 9, 129 and the common one are refused with a reason; 10 and 128 are accepted. The same rule gives the same refusal when called through sign-up, `POST /me/password` and password reset (integration, three calls)

### TC-F01-07: Right code creates the account, the personal workspace and a session in one step
- **Covers:** AC-F01-04, AC-F01-14
- **Level:** integration
- **Given** a pending sign-up with a known code
- **When** `sign-up/verify` is called with the right code
- **Then** in one transaction a user (email verified), a password login, the terms dates, theme and accent from the form, and one personal workspace with the user as its only member exist; a session token is returned; the pending record is deleted. If the personal-workspace insert is forced to fail, no user row remains

### TC-F01-08: Wrong, used, expired and exhausted codes
- **Covers:** AC-F01-04
- **Level:** integration
- **Given** a pending sign-up
- **When** (a) a wrong code is sent, (b) five wrong codes are sent and then the right one, (c) the right code is sent after 15 minutes (server time moved), (d) the right code is used twice, (e) Send a new code is used
- **Then** (a) `CODE_INVALID` ("That code isn't right"); (b) the right code no longer works and the app offers Send a new code; (c) refused as expired; (d) the second use is refused; (e) a new code works and the old one does not. Same rules checked for sign-in and reset codes. Leaving before typing the code leaves no user row

### TC-F01-09: Double submit and parallel codes make one account
- **Covers:** AC-F01-04, AC-F01-02, AC-F01-29
- **Level:** integration
- **Given** two pending sign-ups for the same email, plus one existing-account email
- **When** both right codes are sent at the same moment, and `verify` is sent twice in parallel for one record
- **Then** exactly one user and one personal workspace exist; the loser gets `CODE_INVALID`. For the email that already has an account, `verify` always answers `CODE_INVALID` with the same try counting

### Sign in

### TC-F01-10: Password sign-in
- **Covers:** AC-F01-05
- **Level:** integration
- **Given** a seeded user
- **When** they sign in with email and the right password
- **Then** the call succeeds, a session exists, and the call completes in under 3 seconds (measured locally); email case and surrounding spaces do not matter

### TC-F01-11: Wrong password and unknown email give the same message, security
- **Covers:** AC-F01-05
- **Level:** security
- **Given** a seeded user and an email with no account
- **When** sign-in is tried with (a) the right email and a wrong password and (b) the unknown email
- **Then** both answers are identical ("Email or password is wrong", same status and body shape). In the app the password step is shown for the unknown email too

### TC-F01-12: Timing does not reveal whether an email has an account, security
- **Covers:** AC-F01-05, AC-F01-13
- **Level:** security
- **Given** a seeded user and an unknown email
- **When** 30 wrong-password sign-ins are timed for each; also 30 `sign-up` calls, 30 sign-in code requests and 30 reset requests for each
- **Then** in every pair the median times differ by no more than the margin

### TC-F01-13: Sign in with an emailed code
- **Covers:** AC-F01-06
- **Level:** integration
- **Given** a seeded user and an unknown email
- **When** a sign-in code is requested for each, then the real code is typed
- **Then** the seeded user gets an email and the code signs them in (15 minutes, once, 5 tries as in TC-F01-08); the unknown email gets the same answer but no email is sent and no user or pending record is created

### TC-F01-14: Sign-in screens
- **Covers:** AC-F01-05, AC-F01-06
- **Level:** e2e
- **Given** the app on the sign-in screen
- **When** the user enters an email, reaches the password step, signs in; later signs out and chooses Email me a code instead and types the code from Mailpit
- **Then** both reach the home screen; a wrong password shows "Email or password is wrong" and keeps the user on the password step

### Google and Microsoft

### TC-F01-15: First sign-in with a provider creates the account
- **Covers:** AC-F01-07, AC-F01-14
- **Level:** integration
- **Given** the fake provider offers a verified email that has no MeetApp account, and a profile photo
- **When** the sign-in completes through the hand-off (TC-F01-17)
- **Then** a user exists with a verified email, a personal workspace, an `account` row for the provider, and the provider's photo stored as the profile photo (the user can later change or remove it); `termsAcceptedAt` is still empty

### TC-F01-16: Terms gate blocks everything until accepted, security
- **Covers:** AC-F01-07
- **Level:** security
- **Given** a user from TC-F01-15 with no terms accepted
- **When** they call every `/api/v1` route (taken from the route list of TC-F01-76)
- **Then** every route except `GET /me`, `POST /me/terms` and sign-out answers `403 TERMS_REQUIRED`. After `POST /me/terms` (with the 16+ statement) the same calls work. In the app the Terms screen shows first and nothing else can be opened

### TC-F01-17: Browser hand-off, normal path
- **Covers:** AC-F01-07
- **Level:** integration
- **Given** the fake provider and a verifier with its SHA-256 challenge
- **When** `desktop/init` is called, `desktop/start` is opened with the returned cookie flow, the provider approves, the page shows the match code, Continue is pressed, and `exchange` is polled
- **Then** `init` returns a 4-digit match code equal to the one on the `done` page; `exchange` answers `202 pending` until Continue, then `200` with a new desktop session exactly once; a second `exchange` fails; the browser's own session is revoked; the page says "You can close this tab"; all hand-off pages carry `Cache-Control: no-store`

### TC-F01-18: Cancel and time-out of the hand-off
- **Covers:** AC-F01-07
- **Level:** integration
- **Given** a started hand-off
- **When** (a) Cancel is pressed in the browser page, (b) the provider refuses, (c) the app cancels (main stops polling and calls cancel), (d) nothing happens for 5 minutes (server time moved)
- **Then** (a, b) `exchange` answers `410 cancelled`; (c, d) the request is gone and the app shows "Sign-in was cancelled"; in all four cases no user, session or account row is created for a first-time user

### TC-F01-19: Hand-off attacks fail, security
- **Covers:** AC-F01-07, AC-F01-34
- **Level:** security
- **Given** a victim's started hand-off (requestId R, verifier V, match code M)
- **When** the attacker (a) calls `exchange` with R and a wrong verifier, (b) calls `exchange` with another user's or a random requestId, (c) calls `start` for R more than 60 s after `init`, (d) opens `start` for R in a browser that has no binding cookie, then calls `done`, (e) presses Continue without the click (a plain GET of `done` or a POST without the cookie), (f) tries to reuse R after the success
- **Then** (a) fails and R is deleted, so even the right verifier now fails; (b) answers like an unknown request, nothing leaks; (c) refused as expired; (d, e) refused and no session is created; (f) refused. Verifier comparison is constant time (unit check that a timing-safe compare is used). After a success the browser's own session is revoked

### TC-F01-20: Provider buttons follow the settings
- **Covers:** AC-F01-07
- **Level:** integration
- **Given** the API started with (a) no Google or Microsoft keys, (b) only Google keys, (c) both
- **When** `GET /api/v1/auth/providers` is called and the sign-in screen is opened
- **Then** it lists none, only Google, or both, and the screen shows only those buttons; password and code sign-in work in all three cases; `sign-in/social` for an unconfigured provider answers 404

### TC-F01-21: A provider with an existing email enters the same account
- **Covers:** AC-F01-08
- **Level:** integration
- **Given** a seeded password user, and the fake provider reporting the same email as verified
- **When** the user signs in through the provider
- **Then** the session belongs to the same user id (no second user, no second personal workspace), a provider `account` row is linked, and password sign-in and code sign-in still work afterwards

### TC-F01-22: Unverified provider email is refused
- **Covers:** AC-F01-08
- **Level:** integration
- **Given** the fake provider returns (a) Google `email_verified: false`, (b) Microsoft without `xms_edov` or with it false in a work tenant, (c) Microsoft in the consumer tenant, (d) no email at all, each time using an email that already has a MeetApp account, and also an unused email
- **Then** (a, b, d) `PROVIDER_EMAIL_UNVERIFIED` ("Your Google/Microsoft email isn't verified; create an account with your email instead"), no user, account link or session is created or changed (including for the existing account); (c) is accepted

### TC-F01-23: Provider sign-in in the real desktop app
- **Covers:** AC-F01-07
- **Level:** e2e
- **Given** the desktop app and a second Playwright browser, the fake provider configured
- **When** the user clicks Continue with Google, the app shows the match code, the second browser opens the start URL, signs in at the fake provider, sees the same code and clicks Continue
- **Then** the app is signed in within 5 seconds, shows the Terms screen for a first-time user, and after accepting reaches the home screen. Cancel in the app returns to the sign-in screen with "Sign-in was cancelled"

### TC-F01-24: Real Google and Microsoft accounts
- **Covers:** AC-F01-07, AC-F01-08
- **Level:** manual (optional, owner)
- **Given** the owner has created keys following `docs/runbooks/sign-in-providers.md`
- **When** the owner signs in with a real Google account and a real Microsoft account (personal and work), including a Microsoft work account without a verified email claim
- **Then** the sign-in, photo, same-email linking and refusal of unverified emails behave as in the automated tests. The result is recorded in `verification.md`; skipping is allowed and noted

### TC-F01-25: Provider photo download is limited, security
- **Covers:** AC-F01-07, AC-F01-25
- **Level:** security
- **Given** the fake provider returns a photo URL that is (a) not on Google's or Microsoft's own addresses, (b) a redirect to an internal address (`127.0.0.1`, `169.254.169.254`), (c) larger than 5 MB, (d) slower than 5 s, (e) not an image
- **When** the first sign-in runs
- **Then** the photo is not fetched or not stored in each case, the sign-in itself still succeeds, and the profile shows initials. `user.image` is never returned to the app

### Passwords

### TC-F01-26: Forgot password
- **Covers:** AC-F01-09
- **Level:** integration
- **Given** a seeded user with a second signed-in session, a provider-only user, and an unknown email
- **When** each starts Forgot password, and the seeded user types the right code and a new password
- **Then** the first screen is the same for all three (code-step "if an account exists"); only the two real accounts get an email; the new password is refused if it breaks TC-F01-06; after success the user is signed in on this computer, the other session is revoked, the old password fails, the new one works. The provider-only user can set a password the same way and then sign in with it

### TC-F01-27: Change password
- **Covers:** AC-F01-10
- **Level:** integration
- **Given** a user signed in on two sessions, and a provider-only user with no password
- **When** the first user changes the password with the right current password, then with a wrong one; the second user asks for an emailed code and uses it
- **Then** the right one succeeds and the other session gets 401; the wrong one answers `400 PASSWORD_WRONG` (never 401, so the app does not sign the user out); the provider-only user can set a password with the emailed code; weak passwords are refused

### TC-F01-28: Reset and change in the app
- **Covers:** AC-F01-09, AC-F01-10
- **Level:** e2e
- **Given** the app signed out, a seeded user
- **When** the user completes Forgot password (code from Mailpit, new password), then on the Profile screen changes the password again
- **Then** both succeed, the user lands signed in, and the final password works after sign-out

### Staying signed in and signing out

### TC-F01-29: Sessions last 30 days and slide with use
- **Covers:** AC-F01-11
- **Level:** integration
- **Given** a fresh session
- **When** server time moves to day 29 and a request is made, then to day 58 (29 days after that request), then a session unused for 31 days is used
- **Then** the first two requests succeed (the session was extended by use, at most once a day); the session unused for 31 days gets 401

### TC-F01-30: Restart keeps the user signed in
- **Covers:** AC-F01-11, AC-F01-34
- **Level:** e2e
- **Given** the user is signed in on the desktop app (safeStorage available)
- **When** the app is closed and started again
- **Then** the home screen opens without a sign-in. When the stored token has been revoked on the server, the same restart shows the sign-in screen and the stored token file is deleted

### TC-F01-31: Sign out everywhere
- **Covers:** AC-F01-12
- **Level:** integration
- **Given** one user with three sessions
- **When** one session calls `sign-out-everywhere`, and separately another session calls `sign-out`
- **Then** every session of that user gets 401 on its next request immediately (not after a delay); `sign-out` ends only its own session; other users' sessions are untouched. The same revoke-others holds for TC-F01-26 and TC-F01-27

### TC-F01-32: Sign out in the app, and the second computer
- **Covers:** AC-F01-12
- **Level:** e2e
- **Given** two app windows (two data folders) signed in as the same user
- **When** window A clicks Sign out, then both sign in again and window A clicks Sign out everywhere
- **Then** window A shows the sign-in screen at once both times; after Sign out only A is out; after Sign out everywhere window B's next request is refused, and its open app shows the sign-in screen within 1 minute

### Rate limits

### TC-F01-33: Wrong passwords per email
- **Covers:** AC-F01-13
- **Level:** integration
- **Given** a seeded user and an unknown email
- **When** 5 wrong passwords are sent for each within 15 minutes, then a 6th, then the right password for the seeded user, then time moves 15 minutes
- **Then** the 6th is refused `429 TOO_MANY_ATTEMPTS` with "Too many attempts, try again in N minutes" and `retryAfterSeconds`; the right password is also refused during the lockout; afterwards it works. While the email is locked, Google/Microsoft sign-in for it is refused too (`TOO_MANY_ATTEMPTS`)

### TC-F01-34: Code emails per address and sign-ups per network address
- **Covers:** AC-F01-13
- **Level:** integration
- **Given** one email, and one network address
- **When** 5 code emails are requested for the email across sign-up, sign-in and reset (mixed), then a 6th; and 50 sign-ups are made from one address, then a 51st
- **Then** the 6th code request and the 51st sign-up answer `429 TOO_MANY_ATTEMPTS`; only 5 emails were sent; after the window moves they work again; a different email or address is not affected

### TC-F01-35: Limits look the same for unknown emails, security
- **Covers:** AC-F01-13
- **Level:** security
- **Given** a seeded email and an unknown email, with all counters empty
- **When** each is driven over the limit in TC-F01-33 and TC-F01-34
- **Then** the refusals are identical (status, message, `retryAfterSeconds` within 1 second), counters grow even though no email is sent for the unknown address, the Redis keys contain an HMAC and never the plain email, and the timing margin of TC-F01-12 holds for the refused calls

### TC-F01-36: Other limits
- **Covers:** AC-F01-13, AC-F01-17, AC-F01-19
- **Level:** integration
- **Given** a user, a network address, and a workspace
- **When** (a) 21 join lookups or requests by one user in an hour, (b) 61 from one address, (c) 61 views of `/invite/<token>` from one address, (d) 21 desktop hand-off starts from one address
- **Then** the 21st / 61st / 61st / 21st answer 429; earlier calls work; a wrong, switched-off or replaced link and code count the same as a right one

### Personal workspace

### TC-F01-37: Every new account gets one personal workspace
- **Covers:** AC-F01-14
- **Level:** integration
- **Given** accounts created by (a) email sign-up, (b) a first provider sign-in, (c) the seed, and (d) a user whose personal workspace row was deleted by hand
- **When** `GET /api/v1/me` is called for each
- **Then** each has exactly one workspace of kind `personal` with only that user as owner, shown as "Personal", listed first; for (d) it is repaired by the call and is not duplicated by two parallel calls

### TC-F01-38: Personal workspace rules, security
- **Covers:** AC-F01-14
- **Level:** security
- **Given** a user and their personal workspace
- **When** they try to invite, replace or turn on a join link, rename, leave, hand over, change a role of themselves, or delete it; and when another user tries to join it by invitation, request or code
- **Then** each answers `409 PERSONAL_WORKSPACE` (or 404 for the outsider cases) and nothing changes. A second personal workspace for the same user is rejected by the database's unique rule

### Company workspaces

### TC-F01-39: Create a company workspace
- **Covers:** AC-F01-15
- **Level:** integration
- **Given** a signed-in user
- **When** they create workspaces named "A", "AB", a 60-character name, a 61-character name, and "Same" twice
- **Then** "A" and 61 characters are refused; "AB" and 60 characters work; the two "Same" workspaces both exist with different ids; the creator is the owner of each and the response says to switch to it; the app switches to the new one

### TC-F01-40: The 20-workspace limit and double submit
- **Covers:** AC-F01-15, AC-F01-29
- **Level:** integration
- **Given** a user who owns 19 company workspaces
- **When** they create a 20th, then a 21st; and the same create request with the same `Idempotency-Key` is sent twice, then in parallel
- **Then** the 20th works, the 21st is refused with the limit message; the repeated key returns the first result and creates one workspace; after a hand-over to the user (TC-F01-58) the workspace counts for the new owner; leaving ownership frees a place for the old owner

### TC-F01-41: Workspace switcher in the app
- **Covers:** AC-F01-16
- **Level:** e2e
- **Given** a user with Personal and two company workspaces
- **When** they open the switcher and click another workspace, and the time from click to the new name and content is measured
- **Then** Personal is listed first, all three are shown, the switch takes under 1 second (measured locally, 10 runs, all under 1 s), and "Create a workspace" and "Join with a link or code" are offered

### TC-F01-42: Last-used workspace and fallback
- **Covers:** AC-F01-16
- **Level:** integration
- **Given** a user whose `lastWorkspaceId` is set by switching
- **When** the app starts again; then the user is removed from that workspace; then the id points to a workspace that does not exist
- **Then** the first start opens the last-used workspace; the second and third open Personal. A user cannot save a `lastWorkspaceId` for a workspace they are not in (404)

### Invitations

### TC-F01-43: Invitation rules
- **Covers:** AC-F01-17
- **Level:** integration
- **Given** a workspace with an owner, an admin, a member and a pending-invited email `x@example.test`
- **When** each role invites as member and as admin; an existing member's email is invited; `X@Example.test ` (case and spaces) is invited again; the pending list is read; the owner, an admin and the sender cancel, and a different member tries to cancel
- **Then** a member inviting as admin gets 403; others succeed and an email arrives that is valid 7 days; the existing member is refused with `ALREADY_MEMBER` ("<email> is already a member") before any email is sent; the repeated invite replaces the old one (old status `replaced`, old link stops, a new email is sent, still one pending row); cancelling works for owner, admin and sender, and a different member gets 403; emails are stored lower-case and trimmed

### TC-F01-44: Invitation email limit
- **Covers:** AC-F01-17
- **Level:** integration
- **Given** a user who has sent 50 invitation emails today across two workspaces
- **When** they send a 51st, then time moves 24 hours
- **Then** the 51st is refused ("Invite limit reached, try again tomorrow") and no email is sent; another user is not affected; after 24 hours sending works

### TC-F01-45: Accept and decline an invitation
- **Covers:** AC-F01-18
- **Level:** integration
- **Given** an invitation for `x@example.test` (role admin), and the user signs up or signs in with that email
- **When** `GET /me/invitations` is read and the user accepts; and on other invitations the user declines, or the invitation is cancelled, replaced, or older than 7 days
- **Then** the invitation shows the workspace name and who invited; accepting adds the workspace with the invited role without further approval; declined, cancelled, replaced and expired invitations are no longer listed, and using them answers 410. If the sender is no longer owner or admin when an admin invitation is accepted, the person joins as member

### TC-F01-46: Only the invited email can use an invitation, security
- **Covers:** AC-F01-18
- **Level:** security
- **Given** an invitation for `x@example.test` and another signed-in user `y@example.test` who obtained the token or the invitation id
- **When** `y` calls accept or decline, opens the web page, or lists invitations
- **Then** accept and decline are refused (404 or 403, never a join); `y` does not see the invitation in their list; nothing is added to the workspace. An invited address that was not verified (the account has the email unverified) cannot accept

### TC-F01-47: Invitation web page
- **Covers:** AC-F01-18, AC-F01-35
- **Level:** unit
- **Given** the page renderer and an HTTP call to `GET /invite/<token>`
- **When** the invitation is valid, cancelled, expired, replaced, or the token is random; and the workspace and inviter names are `<img src=x onerror=alert(1)>`
- **Then** the valid page shows the workspace, inviter and masked invited email (`x***@example.test`), a link to getting MeetApp, and no forms or sign-in; the other cases show "This invitation is no longer valid; ask for a new one" with the same status code and body for all invalid cases; names are escaped; headers contain `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex` and a strict CSP (no inline script)

### TC-F01-48: Invite by email and join, end to end
- **Covers:** AC-F01-17, AC-F01-18
- **Level:** e2e
- **Given** the owner signed in and a visitor with no account
- **When** the owner invites the visitor's email on the People screen, the visitor opens the email from Mailpit, clicks the button (web page in a browser), creates an account in the app with that email and presses Join
- **Then** the page names the workspace and inviter; after Join the workspace appears in the visitor's switcher with the invited role; the owner's People screen shows the visitor and the invitation is gone from the pending list

### Join link and code

### TC-F01-49: Manage the join link and code
- **Covers:** AC-F01-19
- **Level:** integration
- **Given** a workspace with the join link off
- **When** a member, then an admin, turns it on; reads it; the admin replaces it; the owner turns it off
- **Then** the member's turn-on gets 403; the admin's works and returns a link and a 10-character code (no 0/O/1/I); any member can read the current link and code while on, and none when off; after replace the old link and code answer the same 404 at once and the new ones work; after off, both answer 404

### TC-F01-50: Request to join, approve and reject
- **Covers:** AC-F01-19
- **Level:** integration
- **Given** a workspace with link on, two other users A and B, and an owner and admin
- **When** A uses the code and B uses the link; `join/lookup` is called first; the admin approves A and rejects B
- **Then** lookup shows only the workspace name and size; the requests are pending and the owner and admin each get an in-app count and an email naming the person; a second request by the same user answers `PENDING_REQUEST` and keeps one row; approval adds A as member and A gets an email; rejection adds nobody and B gets an email; a member cannot approve or reject (403)

### TC-F01-51: Requests expire after 14 days
- **Covers:** AC-F01-19
- **Level:** integration
- **Given** a pending request that is 13 days old and another that is 15 days old
- **When** the list is read before the daily job runs, and again after it runs
- **Then** the 15-day request is already shown as expired when read, and is set to `expired` by the job; the 13-day request stays pending; approving an expired request is refused; the user can ask again

### TC-F01-52: Removed person asks again, and two admins approve at once
- **Covers:** AC-F01-19, AC-F01-21
- **Level:** integration
- **Given** a member who was removed earlier, and a pending request
- **When** the removed person uses the link; and two admins approve the same request in parallel
- **Then** the request is created and shows the "removed earlier" flag to the owner and admins, and an owner or admin decides; exactly one approval succeeds and the other gets "already decided"; one membership row exists

### TC-F01-53: Ask to join, end to end
- **Covers:** AC-F01-19
- **Level:** e2e
- **Given** a user with a code copied from the People screen of a workspace, and the owner in another window
- **When** the user types the code under Join a workspace, sees the card and presses Ask to join; the owner approves under Pending requests
- **Then** the user sees "Request sent"; the owner sees the request with name and email; after approval the workspace appears in the user's switcher as member within 1 minute

### TC-F01-54: An existing member uses a link, code or invitation
- **Covers:** AC-F01-20
- **Level:** integration
- **Given** a member of a workspace, with a link on and a pending invitation for their email
- **When** they use the link, the code, and the invitation
- **Then** each answers 200 "You're already a member", no request or second membership row is created, and the role does not change

### Members and roles

### TC-F01-55: Member list
- **Covers:** AC-F01-21
- **Level:** integration
- **Given** a workspace with owner, admin and member
- **When** each of the three reads the member list
- **Then** every one sees name, photo reference, email, role and join date for all members; the actions the caller may use are not offered to a member

### TC-F01-56: Role table
- **Covers:** AC-F01-21, AC-F01-32
- **Level:** unit
- **Given** `workspaces.permissions.ts`
- **When** every action in the design table is tested for owner, admin, member and non-member
- **Then** the result matches the table exactly (for example admin can make a member admin but not an admin member; member can cancel only their own invitation; nobody can remove or change the owner). A new action added without a table entry fails a test

### TC-F01-57: Change roles and remove people
- **Covers:** AC-F01-21
- **Level:** integration
- **Given** owner O, admins A1 and A2, members M1 and M2
- **When** A1 makes M1 admin; A1 tries to make A2 member; O makes A2 member; A1 removes M2; A1 tries to remove A2 and O; O removes an admin; anyone tries to change O's role; M1 makes themselves admin
- **Then** results follow the table: allowed ones change the role or membership, the others answer 403, the owner is untouched, and a removal writes a `member_removals` row

### TC-F01-58: Hand over ownership
- **Covers:** AC-F01-22
- **Level:** integration
- **Given** owner O, admin A, member M
- **When** O hands over to A (with the confirmation flag), then to M; an admin tries it; O hands over to a non-member; the hand-over fails half-way (forced error)
- **Then** A becomes owner and O becomes admin in one transaction; the later call by the old owner is 403; a non-member target answers 404; after the forced error the roles are unchanged and there is still exactly one owner

### TC-F01-59: Exactly one owner, enforced by the database, security
- **Covers:** AC-F01-21, AC-F01-22
- **Level:** security
- **Given** a company workspace with an owner
- **When** a direct database insert or update tries to create a second owner, or two hand-overs run in parallel
- **Then** the unique partial index rejects the second owner; after the parallel hand-overs there is still exactly one owner

### TC-F01-60: Leave and remove cut access at once
- **Covers:** AC-F01-23
- **Level:** integration
- **Given** a member and an admin with session tokens, and a workspace route (members list)
- **When** the member leaves; the admin is removed by the owner; the owner tries to leave
- **Then** the very next request by each in that workspace answers 404 (no delay); their data is not deleted and stays owned by the workspace; the owner leaving answers `409 OWNER_MUST_TRANSFER`; `GET /me` no longer lists the workspace

### TC-F01-61: Removed while the app is open
- **Covers:** AC-F01-23
- **Level:** e2e
- **Given** a member has the workspace open in window A, the owner in window B
- **When** the owner removes the member
- **Then** within 1 minute (the 30-second check) A switches to Personal and shows "You are no longer a member of <name>"; the same happens when the member leaves from a second window

### TC-F01-62: Rename reaches everyone
- **Covers:** AC-F01-24
- **Level:** e2e
- **Given** the owner, an admin and a member with the workspace open
- **When** the admin renames it to a new name (2–60 characters); a member tries; a 1-character name is tried
- **Then** every open window shows the new name within 1 minute; the member and the 1-character name are refused (403 and 400)

### Profile and preferences

### TC-F01-63: Display name
- **Covers:** AC-F01-25
- **Level:** integration
- **Given** a signed-in user
- **When** they set a name of 0 characters, spaces only, 1 character, 60 characters, 61 characters
- **Then** empty, spaces-only and 61 are refused; 1 and 60 are saved trimmed; a user cannot change another user's name; `PATCH /me` ignores unknown fields (`termsVersion`, `email`, `avatarKey`)

### TC-F01-64: Photo type is checked from the content, security
- **Covers:** AC-F01-25
- **Level:** security
- **Given** a signed-in user
- **When** they upload (a) real JPEG, PNG and WebP files, (b) a GIF, SVG, PDF, HTML or EXE renamed `.png` with `Content-Type: image/png`, (c) a real PNG named `.exe` with `Content-Type: text/plain`, (d) an empty file, (e) a file with an image header and garbage body
- **Then** (a, c) are accepted (decided by the magic bytes only); (b, d, e) are refused with "Use a JPEG, PNG or WebP image up to 5 MB" and nothing is stored

### TC-F01-65: Photo size and pixel limits, security
- **Covers:** AC-F01-25
- **Level:** security
- **Given** a signed-in user
- **When** they upload a 5 MB file, a 5 MB + 1 byte file, and a small PNG that decodes to a huge size (a "decompression bomb", for example 30000 x 30000 pixels)
- **Then** 5 MB is accepted; 5 MB + 1 byte is refused before it is fully read; the bomb is refused by the pixel limit without the server running out of memory (memory stays under a fixed ceiling in the test) and nothing is stored

### TC-F01-66: Photo is re-encoded and location data is removed
- **Covers:** AC-F01-25
- **Level:** integration
- **Given** a JPEG with EXIF GPS location, camera model and an embedded thumbnail, and a PNG with text metadata
- **When** each is uploaded and the stored object is downloaded
- **Then** the stored file is a 512x512 WebP at `avatars/<userId>/<avatarKey>.webp`; it has no EXIF, GPS, camera, thumbnail or text metadata (checked by reading the bytes); the bucket object is private (no public URL works); `DELETE /me/avatar` removes it and the initials show

### TC-F01-67: Who can see a photo, security
- **Covers:** AC-F01-25, AC-F01-31
- **Level:** security
- **Given** user U with a photo, V who shares a workspace with U, W who shares none, and a signed-out caller
- **When** each requests `GET /api/v1/users/U/avatar?v=<key>`; and V requests it after leaving the shared workspace
- **Then** U and V get the image with `Cache-Control: private, max-age=60`; W and V-after-leaving get 404 (same as for a user without a photo or an id that does not exist); the signed-out caller gets 401 like on every signed-in route (it reveals nothing about the photo; changed in T16); the photo of a user whose id is guessed is not distinguishable from a missing one

### TC-F01-68: Name and photo reach others, and other computers
- **Covers:** AC-F01-25
- **Level:** e2e
- **Given** users U and V in one workspace in two windows, and U also signed in in a third window
- **When** U changes name and uploads a photo
- **Then** U's own window shows both at once; V's People screen shows both within 1 minute; the third window shows both after its next check or sign-in; without a photo initials are shown, and an oversize file shows the exact refusal message

### TC-F01-69: Theme and accent follow the account
- **Covers:** AC-F01-26
- **Level:** e2e
- **Given** user U who saved theme dark and accent green on computer A, and computer B set to light and blue
- **When** U signs in on B; separately a new account is created on B; then U signs out on B
- **Then** after U signs in on B the app shows dark and green (and saved to the account by `PATCH /me/preferences`); the new account starts with B's light and blue (sent at sign-up); after sign-out B keeps the last shown choice. An invalid theme value is refused with 400

### Emails and screens

### TC-F01-70: Email templates
- **Covers:** AC-F01-27, AC-F01-35
- **Level:** unit
- **Given** the five templates: code (sign-up, sign-in, reset), invitation, request to join, request decided, "someone tried to create an account"
- **When** each is rendered with sample data, including a workspace and person name of `<script>alert(1)</script>`
- **Then** each has an HTML and a plain-text version, the MeetApp name and logo (placeholder), the validity time where relevant (15 minutes / 7 days), no request for a password, all text from translation keys (no literal strings, checked against the translation file), code emails show the code prominently and "If you didn't ask for this, ignore this email", and HTML in names is escaped in the HTML version, stays inert text in the plain-text version, and angle brackets never appear in subjects; colors come from the design tokens

### TC-F01-71: Accessibility and look of new components
- **Covers:** AC-F01-28
- **Level:** visual
- **Given** Storybook stories for CodeInput, WorkspaceSwitcher, MemberRow, InviteForm, JoinLinkCard, RequestRow, AvatarUpload, AuthLayout and the screens built from them (default, loading, error, empty)
- **When** the visual and axe checks run
- **Then** there are no accessibility violations, errors are announced to screen readers (`role="alert"` or live region), screenshots match the approved baselines, and the `ui-reviewer` finds no difference from the approved canvas. The invitation web page is checked by axe in the same way

### TC-F01-72: Keyboard-only pass
- **Covers:** AC-F01-28
- **Level:** e2e
- **Given** the app signed out, using only the keyboard
- **When** the user signs in, opens the switcher, creates a workspace, invites an email, opens People and Pending requests, and edits the profile
- **Then** every control is reachable and usable with Tab, Enter, Space and Escape, focus is visible and never trapped, the code boxes accept paste, and every visible string is from the translation file (a test fails if the app shows a key that is missing)

### TC-F01-73: Server not reachable, and no double saves
- **Covers:** AC-F01-29
- **Level:** e2e
- **Given** the API stopped (and a variant where it accepts but never answers for 10 s)
- **When** the user tries to sign in, sign up, invite and change the profile; then the API is started and Retry is pressed; and a button is double-clicked
- **Then** "Can't reach MeetApp. Check your connection." with a Retry button shows within about 10 s; nothing is half-saved; Retry works; buttons are disabled while a request runs and the double click creates one account, workspace, invitation or request

### Seed data

### TC-F01-74: Seed and clear
- **Covers:** AC-F01-30
- **Level:** integration
- **Given** a local empty database, then one with real-looking extra data
- **When** `pnpm seed` runs twice, a seeded user signs in with `meetapp-dev-password`, then `pnpm seed:clear` runs
- **Then** the first run adds users with `@example.test` emails, a company workspace "Example team" with one owner, admin and member, and one pending join request; the second run adds nothing; sign-in works; the clear removes all seeded records and none of the extra data (this completes AC-F00-45)

### TC-F01-75: Seed refuses outside local, security
- **Covers:** AC-F01-30
- **Level:** security
- **Given** (a) `NODE_ENV=production`, (b) `NODE_ENV=development` with a database host that is not this computer, (c) `NODE_ENV` unset
- **When** `pnpm seed` runs
- **Then** all three exit non-zero with a clear message and write nothing

### Security sweeps

### TC-F01-76: S1 route sweep, security
- **Covers:** AC-F01-31, AC-F01-32, AC-F01-33
- **Level:** security
- **Given** the list of every registered route (read from the running server) and a test table that names each route as `public` or `signed-in` (and its role rule)
- **When** every route is called with no session, an expired session, a malformed token and a revoked token
- **Then** every non-public route answers 401; each public route is in the table with its own limit (sign-up, sign-up/verify, desktop/*, providers, `/invite/:token`, `/api/auth` allow-list); a route that exists but is not in the table fails the test, so a new route cannot be left unprotected

### TC-F01-77: S2 outsider sweep over every workspace route, security
- **Covers:** AC-F01-31
- **Level:** security
- **Given** workspace W (with members, invitations, a join link, requests) and an outsider who is a member of another workspace only, plus a user who was removed from W
- **When** the outsider and the removed user call every route that contains `:workspaceId` (members, invitations and their ids, join-link, requests and their ids, rename, leave, transfer, role change, removal) with real ids, with ids of objects in W, and with ids of objects in their own workspace under W's id
- **Then** every call answers 404 `NOT_FOUND`, byte-identical to the answer for a workspace id that does not exist; no name, count, role or member is revealed; no change was made. The route list comes from the server, so a new workspace route is covered automatically

### TC-F01-78: Wrong join secrets look the same, security
- **Covers:** AC-F01-31
- **Level:** security
- **Given** a workspace with link on
- **When** `join/lookup` and `join/request` are called with a random link, a random code, a replaced link, a switched-off link, a workspace id used as the secret, and the right link
- **Then** all wrong ones answer the same 404 with the same body; the right one shows only the workspace name and size; the database is searched only through the HMAC column (a test spies on the query)

### TC-F01-79: Member sweep over every owner/admin action, security
- **Covers:** AC-F01-32
- **Level:** security
- **Given** a plain member with a valid session in workspace W
- **When** they call every owner/admin action directly (bypassing the screen): rename, role change, remove, hand over, turn join link on/off, replace link, list and approve and reject requests, invite as admin, cancel someone else's invitation, make themselves admin
- **Then** every call answers 403 `FORBIDDEN` and nothing changes; the same sweep as an admin for owner-only actions (hand over, make admin a member, remove an admin) also answers 403

### TC-F01-80: Only allowed Better Auth routes are reachable, security
- **Covers:** AC-F01-33, AC-F01-34
- **Level:** security
- **Given** the running API
- **When** each Better Auth route not in the allow-list is called (`sign-up/email`, `update-user`, `change-email`, `delete-user`, `link-social`, `unlink-account`, `change-password`, `organization/*`, `list-sessions`, `get-session` with a token in the body, and others from Better Auth's route list)
- **Then** each answers 404 without side effects; the allowed routes (`sign-in/email`, `sign-in/email-otp`, `email-otp/send-verification-otp`, `email-otp/request-password-reset`, `sign-in/social`, `callback/*`, `sign-out`, `revoke-sessions`) work; a user cannot set `termsVersion`, `theme`, `avatarKey` and other `input: false` fields through any route

### TC-F01-81: Secrets never appear in logs, security
- **Covers:** AC-F01-33
- **Level:** security
- **Given** the API with log capture and unique marker values
- **When** each secret kind is sent through every auth endpoint (`password`, `newPassword`, `currentPassword`, `code`, `otp`, `verifier`, bearer token, invitation token, join code, provider `code`/`state`), once with success and once with a validation error and once with a server error
- **Then** no captured log line, error response or stack trace contains any marker; the `/api/auth/*` and `/api/v1/auth/*` request bodies are never logged; error `code` fields (for example `CODE_INVALID`) are still visible

### TC-F01-82: Secrets never appear in traces or Sentry, security
- **Covers:** AC-F01-33
- **Level:** security
- **Given** tracing and Sentry pointed at test sinks
- **When** the flows of TC-F01-81 run, including a thrown error
- **Then** no span attribute, breadcrumb, event, request body, header (`authorization`, `cookie`) or URL query in the sinks contains a marker; URLs of `/invite/<token>` and `desktop/*` are recorded without the token and request id

### TC-F01-83: Secrets are stored only as hashes or encrypted, security
- **Covers:** AC-F01-33
- **Level:** security
- **Given** a database after sign-up, code sign-in, an invitation, a join link, a provider sign-in and a session
- **When** the raw tables and Redis are read
- **Then** passwords are scrypt hashes; email codes (verification table and pending sign-ups) are hashes; invitation tokens are SHA-256 hashes; session tokens are hashes (if Better Auth cannot, the exception recorded in D048 is asserted); provider access and refresh tokens are encrypted (S8); the join secret is AES-256-GCM encrypted with a key version and looked up by HMAC; no plain secret or marker is found. Start-up fails with a clear message when `BETTER_AUTH_SECRET` is shorter than 32 characters or `DATA_ENCRYPTION_KEY` is missing (S7)

### Desktop token

### TC-F01-84: The page cannot reach the token, security
- **Covers:** AC-F01-34
- **Level:** e2e
- **Given** the signed-in desktop app, with DevTools-style access to the page through Playwright
- **When** the page runs `fetch` to `/api/auth/*`, `/api/v1/auth/sign-up/verify` and `/api/v1/auth/desktop/*`; reads `localStorage`, `sessionStorage`, `document.cookie`, IndexedDB and the window object; and the sign-in flows run while all page-visible responses are recorded
- **Then** the fetches are cancelled by the main process; the token (a marker found by reading the main process's value in the test) is in none of the storages, cookies or responses; `window.meetapp.auth` exposes only the listed methods and returns only `{ ok, user }` or an error code; messages from another origin or a frame are rejected; photos still load with the token added by main

### TC-F01-85: Token storage and the memory-only fallback
- **Covers:** AC-F01-34
- **Level:** unit
- **Given** `auth-token.ts` with a fake safeStorage
- **When** (a) encryption is available, (b) `isEncryptionAvailable()` is false, (c) the file is damaged or was written by another key
- **Then** (a) the file on disk contains no plain token and decrypts back; (b) nothing is written to disk and the token lives in memory only, so a restart signs out; (c) the file is ignored and deleted and the user is signed out; sign-out deletes both the file and the memory copy

### Names as plain text

### TC-F01-86: HTML in names is shown as text everywhere, security
- **Covers:** AC-F01-35
- **Level:** security
- **Given** a user named `<img src=x onerror=alert(1)>` and a workspace named `<script>alert(2)</script>`
- **When** they are shown in the switcher, People, Pending requests, invitations, the profile screen, notification toasts, the invitation web page and every email (HTML and plain text) in Mailpit
- **Then** the app and pages show the characters as text and no script runs (a Playwright dialog or global flag is never set); in emails the characters are escaped (`&lt;`); the plain-text email contains them as text; names are still accepted by the length rules

## Coverage
| Acceptance criterion | Test cases |
|---|---|
| AC-F01-01 | TC-F01-01, 02, 03 |
| AC-F01-02 | TC-F01-04, 05, 09 |
| AC-F01-03 | TC-F01-06 |
| AC-F01-04 | TC-F01-01, 05, 07, 08, 09 |
| AC-F01-05 | TC-F01-10, 11, 12, 14 |
| AC-F01-06 | TC-F01-13, 14 |
| AC-F01-07 | TC-F01-15, 16, 17, 18, 19, 20, 23, 24, 25 |
| AC-F01-08 | TC-F01-21, 22, 24 |
| AC-F01-09 | TC-F01-26, 28 |
| AC-F01-10 | TC-F01-27, 28 |
| AC-F01-11 | TC-F01-29, 30 |
| AC-F01-12 | TC-F01-31, 32 |
| AC-F01-13 | TC-F01-12, 33, 34, 35, 36 |
| AC-F01-14 | TC-F01-01, 07, 15, 37, 38 |
| AC-F01-15 | TC-F01-39, 40 |
| AC-F01-16 | TC-F01-41, 42 |
| AC-F01-17 | TC-F01-36, 43, 44, 48 |
| AC-F01-18 | TC-F01-45, 46, 47, 48 |
| AC-F01-19 | TC-F01-36, 49, 50, 51, 52, 53 |
| AC-F01-20 | TC-F01-54 |
| AC-F01-21 | TC-F01-52, 55, 56, 57, 59 |
| AC-F01-22 | TC-F01-58, 59 |
| AC-F01-23 | TC-F01-60, 61 |
| AC-F01-24 | TC-F01-62 |
| AC-F01-25 | TC-F01-25, 63, 64, 65, 66, 67, 68 |
| AC-F01-26 | TC-F01-69 |
| AC-F01-27 | TC-F01-70 |
| AC-F01-28 | TC-F01-71, 72 |
| AC-F01-29 | TC-F01-09, 40, 73 |
| AC-F01-30 | TC-F01-74, 75 |
| AC-F01-31 | TC-F01-67, 76, 77, 78 |
| AC-F01-32 | TC-F01-56, 76, 79 |
| AC-F01-33 | TC-F01-05, 76, 80, 81, 82, 83 |
| AC-F01-34 | TC-F01-19, 30, 80, 84, 85 |
| AC-F01-35 | TC-F01-47, 70, 86 |
