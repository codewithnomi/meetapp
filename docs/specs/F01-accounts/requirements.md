---
feature: F01
title: Accounts & workspaces
status: approved
updated: 2026-10-11
---

# F01 Accounts & workspaces: Requirements (WHAT)

## Goal
People can create a MeetApp account, sign in safely from the desktop app, and work either in their own personal workspace or together with teammates in a company workspace. Everything later (meetings, transcripts, AI) belongs to a workspace, so this is the base for who can see what.

## Who uses it
- **Visitor:** someone without an account (signs up, or was invited).
- **User:** anyone signed in. Every user has a **personal workspace** (only them; shown as "Personal").
- **Company workspace roles** (glossary): **owner** (one per workspace), **admin** (helps run it), **member** (uses it).

## User stories
- As a visitor, I want to sign up with my email, Google or Microsoft account, so that I can start using MeetApp in a minute.
- As a user, I want to sign in with a password or an emailed code, reset a forgotten password and sign out of every device, so that my account stays mine.
- As a user, I want a personal workspace right away, so that I can use MeetApp alone without creating anything.
- As a team lead, I want to create a company workspace and invite teammates by email or link, so that we share meetings in one place.
- As a workspace member, I want to invite a colleague, so that they can join without waiting for an admin.
- As an owner or admin, I want to decide who is an admin and remove people who left, so that only the right people see our data.
- As a user, I want my name, photo, theme and accent color saved to my account, so that the app looks the same on every computer.

## How it works, following Microsoft Teams (D047)
MeetApp follows the way Microsoft Teams and Microsoft accounts handle these steps, so people coming from Teams find nothing new:
- **Email first:** sign-in asks for the email address, then the password (or a code). Google and Microsoft are offered as buttons.
- **Codes, not links:** confirming an email and resetting a password use a **6-digit code** sent by email and typed into the app, as Microsoft does. A user can also sign in with an emailed code instead of their password. This works without a web app (F10) and without `meetapp://` links (F04).
- **Join link and join code ask for approval:** like a private team in Teams, someone who uses the workspace's join link or join code sends a **request to join**; the owner or an admin approves or rejects it. Email invitations are already approved by whoever sent them.
- **Invitation emails:** the button leads to a small MeetApp web page that says who invited them and tells them to open MeetApp (or get it) and sign in with the invited email, where the invitation is waiting.

## Acceptance criteria
Format: WHEN <situation>, THEN <expected result>. Times are measured locally (`pnpm dev`). Message texts in quotes are the meaning; exact wording comes from the translation file.

### Sign up
- **AC-F01-01:** WHEN a visitor chooses **Create account**, enters their email, then their name and a password, and ticks "I agree to the Terms and Privacy Policy, and I am 16 or older", THEN a 6-digit code is emailed (visible in Mailpit locally) and the app asks for it. Without the tick, sign-up is refused. The date and the version of the terms are stored (until the real documents exist, they are clearly marked placeholder pages with version `draft-1`).
- **AC-F01-02:** WHEN someone signs up with an email that already has an account, THEN the app shows the same "Enter the code we sent" step, no second account is created, and the existing account's owner gets an email saying someone tried to create an account with their address, with a reminder of how to sign in or reset the password. Nobody can tell from the app whether the email had an account.
- **AC-F01-03:** WHEN a password is shorter than 10 characters, longer than 128, or on the list of the most common passwords, THEN sign-up, password change and password reset refuse it and say why.
- **AC-F01-04:** WHEN the user types the right code (valid 15 minutes, usable once), THEN the email is verified, the account is created with its personal workspace, and they are signed in. A wrong code says "That code isn't right"; after 5 wrong codes, or when it has expired, the code stops working and the app offers **Send a new code**. A visitor who leaves before typing the code has no account yet and can simply start again.

### Sign in
- **AC-F01-05:** WHEN a user enters their email and then the right password, THEN they reach their home screen within 3 seconds. WHEN the email or password is wrong, THEN the message is the same in both cases ("Email or password is wrong"); the password step is shown for every email, so it never reveals whether an account exists.
- **AC-F01-06:** WHEN a user chooses **Email me a code instead** at the password step, THEN a 6-digit sign-in code is emailed (same rules as AC-F01-04: 15 minutes, once, 5 tries) and typing it signs them in. For an email with no account, the app behaves the same but no code is sent.
- **AC-F01-07:** WHEN a user picks **Continue with Google** or **Continue with Microsoft**, THEN the computer's own browser opens the provider's page; after they approve, the page says "You can close this tab" and the app is signed in within 5 seconds (no password typed into MeetApp). A first-time Google/Microsoft user gets an account (email counted as verified), confirms the terms and the 16+ statement on first entry, and their Google/Microsoft photo is used as their profile photo (they can change or remove it). WHEN they say no or press **Cancel** (in the browser page or in the app), or don't finish within 5 minutes, THEN the app returns to the sign-in screen with "Sign-in was cancelled" and nothing is created. (A closed browser tab can't be detected, so the app keeps waiting until Cancel or the 5 minutes.) Before continuing, the browser page and the app show the same 4-digit code, so the user can check it's their own sign-in. If Google or Microsoft isn't set up (no keys in the settings), its button is hidden and everything else still works.
- **AC-F01-08:** WHEN someone signs in with Google or Microsoft using an email that already has a MeetApp account, THEN they enter that same account, which then works with any way of signing in. WHEN Google or Microsoft reports the email as not verified, THEN no account is created or linked and the app says "Your Google/Microsoft email isn't verified; create an account with your email instead."

### Passwords
- **AC-F01-09:** WHEN a user chooses **Forgot password** and enters their email, THEN the app always asks for "the code we sent, if an account exists". Typing the right code (AC-F01-04 rules) lets them choose a new password in the app; they are then signed in and every other device is signed out (rule in AC-F01-12). An account that only uses Google/Microsoft can set a password this way too.
- **AC-F01-10:** WHEN a signed-in user changes their password (entering the current one, or a code emailed to them if they have none), THEN it is changed and every other device is signed out (rule in AC-F01-12).

### Staying signed in and signing out
- **AC-F01-11:** WHEN a user has signed in, THEN they stay signed in on that computer when the app restarts, until they sign out or their app makes no request to the server for 30 days.
- **AC-F01-12:** WHEN a user clicks **Sign out**, THEN that computer shows the sign-in screen at once. WHEN they click **Sign out everywhere** (or another device is signed out by AC-F01-09/10), THEN this computer is signed out at once; every other device's next request is refused immediately, and an open app there shows the sign-in screen within 1 minute.
- **AC-F01-13:** WHEN someone tries too often, THEN further tries are refused with "Too many attempts, try again in N minutes": at most 5 wrong passwords per email per 15 minutes, 5 code emails (sign-up, sign-in or reset) per email address per hour, and 50 sign-ups per network address per hour. The limit and message are the same whether or not the email has an account (security rule S5).

### Personal workspace
- **AC-F01-14:** WHEN an account is created (any way), THEN it gets a **personal workspace** automatically, shown as "Personal". Only that user is in it; nobody can be invited to it, and it can't be deleted, left, renamed or handed over.

### Company workspaces
- **AC-F01-15:** WHEN a user creates a company workspace with a name (2–60 characters; two workspaces may have the same name), THEN it exists, they are its **owner**, and the app switches to it. A user can own at most 20 company workspaces at a time (a guard against misuse; plans in F10 may change it).
- **AC-F01-16:** WHEN a user belongs to several workspaces, THEN a workspace switcher lists all of them (personal first); from the click until the new workspace's name and content show takes under 1 second; and the app opens in the last-used workspace next time, or in the personal workspace if that one is gone or the user is no longer in it.
- **AC-F01-17:** WHEN the owner, an admin or a member invites an email address, THEN an invitation email arrives (valid 7 days). Members can invite only as **member**; the owner and admins can also invite as **admin**. Inviting an email that is already in the workspace is refused with "<email> is already a member"; inviting an email with a pending invitation replaces it (a new email is sent). Each user can send at most 50 invitation emails per day across all workspaces ("Invite limit reached, try again tomorrow"). Pending invitations are listed; the owner, admins or the sender can cancel one.
- **AC-F01-18:** WHEN the invited person signs in or creates an account **with the invited email**, THEN the app shows the invitation (workspace name, who invited them) with **Join** and **Decline**; joining adds the workspace to their switcher with the invited role, without any further approval. The email's button opens a small MeetApp web page that says this and links to getting MeetApp. **Only the invited email can use an invitation** (D046). A cancelled or expired invitation no longer shows, and the page says "This invitation is no longer valid; ask for a new one".
- **AC-F01-19:** WHEN the owner or an admin turns on the workspace's **join link and join code** (a short code, like Teams' team code), THEN any signed-in user who opens the link or types the code under **Join a workspace** sees the workspace name and can **Ask to join**; the app then says "Request sent". The owner and admins are told (in the app and by email), see the request under **Pending requests** with the person's name and email, and approve or reject it; the person is told the result, and on approval the workspace appears in their switcher as a **member** (D047). A request not answered in 14 days expires. The owner and admins can turn the link and code off or replace them; the old ones stop working at once. Any member can copy the current link and code while they are on. A person who was removed earlier can ask again, and an owner or admin decides.
- **AC-F01-20:** WHEN an existing member uses the join link, join code or an invitation, THEN the app opens that workspace with "You're already a member" and nothing changes.
- **AC-F01-21:** WHEN anyone in a company workspace opens its member list, THEN they see each person's name, photo, email, role and join date (D046). The owner and admins can also make a member an admin and remove a member; only the owner can make an admin a member again or remove an admin. Nobody can remove or change the owner.
- **AC-F01-22:** WHEN the owner hands the workspace over to another member or admin (with a confirmation step), THEN that person becomes the owner and the old owner becomes an admin.
- **AC-F01-23:** WHEN a member or admin leaves a company workspace or is removed, THEN the server refuses their next request in that workspace immediately; an open app switches them to their personal workspace within 1 minute and shows "You are no longer a member of <name>". What they created there (meetings and data, from F02 on) stays in the workspace. The owner can't leave without handing over first.
- **AC-F01-24:** WHEN the owner or an admin renames the workspace (2–60 characters), THEN every member sees the new name within 1 minute.

### Profile
- **AC-F01-25:** WHEN a user changes their display name (1–60 characters) or uploads a photo (JPEG, PNG or WebP, up to 5 MB, shown as a circle), THEN it shows in their own app at once and to people who share a workspace with them within 1 minute, and stays after signing in on another computer. Location and camera details inside the photo are removed on upload. Only people who share a workspace with the user can see the photo. Other file types or bigger files are refused with "Use a JPEG, PNG or WebP image up to 5 MB". Without a photo, their initials are shown.
- **AC-F01-26:** WHEN a signed-in user changes theme (light/dark/system) or accent color, THEN it is saved to their account and applied when they sign in on any computer (the account's choice replaces the computer's). A new account starts with the computer's current choice. After sign-out the computer keeps the last choice (as in F00).

### Emails, screens, network and data
- **AC-F01-27:** WHEN MeetApp sends a code, invitation, join-request or "someone tried to create an account" email, THEN it shows the MeetApp name and logo (placeholder until the logo is chosen, D018), has a plain-text version, says how long a code or invitation is valid, never asks for a password, and its text comes from the translation file. Code emails show the code prominently and say "If you didn't ask for this, ignore this email."
- **AC-F01-28:** WHEN the sign-in, create-account, code, forgot-password, workspace switcher, join-a-workspace, members, invitations, pending-requests and profile screens and the invitation web page are used, THEN they match screen designs approved by the owner (D029; screens not yet in the approved canvas are designed and approved before the design stage), work with the keyboard alone, announce errors to screen readers, show loading and error states, and all text comes from the translation file.
- **AC-F01-29:** WHEN the server can't be reached or doesn't answer within 10 seconds during sign-in, sign-up, invite or profile actions, THEN the app shows "Can't reach MeetApp. Check your connection." with a **Retry** button; nothing is half-saved, and pressing a button twice never creates two accounts, workspaces, invitations or requests.
- **AC-F01-30:** WHEN `pnpm seed` runs, THEN it adds sample users (with a known local test password) and a sample company workspace with an owner, an admin, a member and one pending join request, with no real personal data; `pnpm seed:clear` removes only those (completes AC-F00-45). `pnpm seed` refuses to run when the environment isn't local.

## Security & privacy
Rules from `docs/architecture/security.md`: S1 (every request checked on the server), **S2 (workspaces fully separated)**, S5 (rate limits), S7 (secrets only in settings), S8 (Google/Microsoft tokens stored encrypted), S10 (no passwords or tokens in logs), S11 (input validated, names shown as plain text), S12 (photos: allowed types, size limit, stored privately).
- **AC-F01-31:** WHEN a user asks for anything in a workspace they're not in (for example by changing an ID in a request), THEN the server answers "not found", the same as for a workspace that doesn't exist, and reveals nothing about it. Automated tests try this for every workspace action.
- **AC-F01-32:** WHEN a member tries something only the owner or an admin may do (change roles, remove people, rename, manage the join link and code, approve requests, invite as admin), THEN the server refuses it, even if the screen was bypassed.
- **AC-F01-33:** WHEN passwords, codes, invitation links or sign-in tokens are handled, THEN they never appear in logs, error reports or traces; passwords are stored only as a one-way hash made for passwords (method chosen in design.md); codes, invitation links and sign-in tokens are random, single-purpose, and stored only as hashes.
- **AC-F01-34:** WHEN the desktop app keeps the user signed in, THEN the sign-in token is kept only by the app's hidden main part, encrypted with a key held by the computer's own secure storage (macOS Keychain / Windows' built-in protection); the app's pages can never read it. If the computer can't encrypt it, it is kept only until the app closes.
- **AC-F01-35:** WHEN a name (user or workspace) contains HTML or script text, THEN it is shown as plain text everywhere, including emails and the invitation web page.
- Privacy: sign-up records terms acceptance (date, version) and the 16+ confirmation (privacy-legal.md §5). Account deletion and data export arrive with F10 (privacy-legal.md §2); until then, requests go to the support email shown on the profile screen and are handled by hand.

## Limits in F01
Company workspaces created per user: 20. Members per workspace: no limit in F01 (plans come with F10). Invitation emails: 50 per user per day. Code emails: 5 per address per hour. Join requests expire after 14 days. Duplicate workspace names: allowed.

## Out of scope
- Two-step sign-in (authenticator codes): F10, with the admin console (D045).
- Company login (SSO/SAML), joining automatically by email domain: later.
- "Sign in with Apple": F11 (D020).
- `meetapp://` links that open the desktop app directly: F04 (D022).
- Public workspaces anyone can join without approval (Teams' public teams): later, if needed.
- Several owners per workspace (Teams allows co-owners; here admins fill that role): later, if needed.
- Deleting a workspace, data export, deleting an account, plans and payments: F10. F10's admin console builds on F01's member management.
- A list of signed-in devices and signing out one device: later.
- Changing an account's email address: later.
- Guests joining a meeting without an account: F02.
- Meetings themselves: F02 (F01 only provides the workspaces they belong to).

## Open questions
None. Owner choices on 2026-10-11: D045 (sign-up, joining, inviting, two-step later), D046 (invitations only for the invited email, members see the member list with emails) and D047 (follow Microsoft Teams: email codes instead of links, join link and code send a request that the owner or an admin approves).
