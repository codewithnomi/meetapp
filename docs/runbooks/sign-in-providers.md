# Runbook: Google and Microsoft sign-in keys

**Optional.** Without keys, the "Continue with Google/Microsoft" buttons are simply hidden and everything else works (AC-F01-07). The automated tests never need real keys; they use a local fake provider.

Both keys are **free** (D017). You need a Google account and a free Microsoft account. The websites change their screens from time to time; if a step looks different, look for the same words nearby.

## Before you start: the backend's address
Google and Microsoft send people back to the backend after they sign in, so they need its exact address. It is the `APP_PUBLIC_URL` setting in `.env`:
- it must use the same port as `API_PORT` (on this Mac that is `http://127.0.0.1:3010`, because the backend moved to port 3010);
- Google and Microsoft accept plain `http` only for `localhost`. So for these keys set `APP_PUBLIC_URL=http://localhost:3010` (same port, the name `localhost` instead of the numbers).

The return addresses below use that value. Replace `localhost:3010` if yours differs.

## Google (about 10 minutes)
1. Open https://console.cloud.google.com and sign in. Create a project (top bar → project picker → **New project**), for example "MeetApp local".
2. Menu → **Google Auth Platform** (older screens: **APIs & Services → OAuth consent screen**). Click **Get started**. App name "MeetApp", your email as support and contact email, audience **External**. Save.
3. **Audience** → **Test users** → add your own Google address. While the app is in "testing", only test users can sign in.
4. **Clients** → **Create client** → type **Web application**, name "MeetApp local".
   - **Authorized redirect URIs** → add `http://localhost:3010/api/auth/callback/google`.
   - Create. Copy the **Client ID** and **Client secret**.
5. Put them in `.env`:
   ```
   GOOGLE_CLIENT_ID=<the client id>
   GOOGLE_CLIENT_SECRET=<the client secret>
   ```

## Microsoft (about 10 minutes)
1. Open https://entra.microsoft.com (or https://portal.azure.com) and sign in with a Microsoft account. A free account is enough.
2. **Applications → App registrations → New registration**.
   - Name "MeetApp local".
   - Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**.
   - Redirect URI: platform **Web**, address `http://localhost:3010/api/auth/callback/microsoft`.
   - Register. Copy the **Application (client) ID**.
3. **Certificates & secrets → New client secret**. Choose an expiry, add it, then copy the **Value** at once (it is shown only once).
4. **Token configuration → Add optional claim** → token type **ID** → tick `email` and `xms_edov` → Add (accept the extra permission it offers).
   - `xms_edov` tells MeetApp that a work account's email was really checked. Without it, work accounts are refused with "Your Google/Microsoft email isn't verified" (AC-F01-08). Personal Microsoft accounts work either way.
5. Put them in `.env`:
   ```
   MICROSOFT_CLIENT_ID=<the application (client) id>
   MICROSOFT_CLIENT_SECRET=<the secret value>
   ```

## Check it
1. Restart with `pnpm dev`. `http://localhost:3010/api/v1/auth/providers` shows `true` for each provider you set up.
2. In the app, choose **Continue with Google** (or Microsoft). Your browser opens. Sign in, check that the 4-digit code matches the app, and press **Continue**.

## Problems
| What you see | Why | Fix |
|---|---|---|
| The backend won't start: "set both … or neither" | Only one of the two keys of a provider is in `.env` | Add the missing one, or remove both |
| Google says "redirect_uri_mismatch" | The return address doesn't match exactly | Compare it with `APP_PUBLIC_URL` + `/api/auth/callback/google`: same name (`localhost`), port and path |
| Google says "access blocked: app not verified" | Your address isn't a test user | Add it under **Audience → Test users** |
| "Your Google/Microsoft email isn't verified" | A work account without the `xms_edov` claim | Do Microsoft step 4 |
| The browser page says "This sign-in link isn't valid" | More than 60 s passed before the browser opened, or the link was used already | Start again from the app |

Keys are secrets: they live only in `.env` (never committed). Before going online, the keys get production addresses (later, with the hosting decision).
