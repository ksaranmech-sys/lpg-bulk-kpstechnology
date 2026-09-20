# Deployment Checklist — KPS Fleet (web + LPG Fleet Driver app)

Follow the parts in order. Each part ends with a check so you know it worked before moving on.
Anything in `code style` is something to type or paste exactly. Values in `<angle brackets>` are yours to fill in.

---

## Part 0 — Before you start (10 minutes)

- [ ] **Generate two secrets.** Open a terminal in this folder and run the command below **twice**. Save both outputs somewhere safe (a password manager). Call them `SECRET_A` and `SECRET_B`.
  ```
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```
- [ ] **Create a free Cloudinary account** at https://cloudinary.com (stores receipt photos permanently — Render's disk is wiped on every deploy).
  In the Cloudinary dashboard find **API environment variable**; it looks like `cloudinary://123456789:abcDEF...@yourcloudname`. Copy the whole thing. Call it `CLOUDINARY_URL`.
- [ ] **Know your website addresses.** You need the exact address(es) users type in the browser, e.g. `https://lpg-bulk.kpstechnology.in` and your Vercel address `https://<project>.vercel.app`. (Vercel → your project → Domains.)
- [ ] **Decide the admin password.** After deploying, log in with the current `kpsadmin` password, then use the new **Change Password** button (top bar) to set a strong one. The old behaviour that reset it on every restart is gone.

---

## Part 1 — Backend on Render (15 minutes)

The backend must go live **first**: the website and the mobile app both talk to it, and the new login flow (refresh tokens) needs the new server.

1. [ ] Render dashboard → your service `lpg-bulk-kpstechnology-fleet` → **Settings**:
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Node version:** 20 or newer (Settings → Environment → `NODE_VERSION` = `20` if it is older).
2. [ ] **Environment** tab → add/update these variables (keep any existing ones such as `MONGO_URI`, `SMTP_*`, `COMPANY_EMAIL`, `MAIL_FROM`):

   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `JWT_SECRET` | `SECRET_A` from Part 0 |
   | `JWT_REFRESH_SECRET` | `SECRET_B` from Part 0 |
   | `JWT_EXPIRES_IN` | `15m` |
   | `JWT_REFRESH_EXPIRES_IN` | `30d` |
   | `ALLOWED_ORIGINS` | your website addresses, comma-separated, no spaces, e.g. `https://lpg-bulk.kpstechnology.in,https://<project>.vercel.app,https://lpg-bulk-kpstechnology-fleet.onrender.com` |
   | `STORAGE_DRIVER` | `cloudinary` |
   | `CLOUDINARY_URL` | the value copied from Cloudinary |
   | `CLOUDINARY_FOLDER` | `kps-fleet` |
   | `API_BASE_URL` | `https://lpg-bulk-kpstechnology-fleet.onrender.com` |

   Remove these if present: `ADMIN_INITIAL_PASSWORD` (only needed on a brand-new empty database), `USE_MEMORY_MONGO`, `AWS_*`.
3. [ ] **Deploy the branch.** In GitHub, merge `hardening-and-mobile` into `main` (or in Render → Settings → Branch, point at `hardening-and-mobile`). Render redeploys automatically.
4. [ ] **Check:** Render → **Logs** should show `[db] MongoDB connected` and `[server] KPS Fleet API listening`. If it shows `[config] JWT_SECRET must be set...`, a secret is missing or too short — fix the variable and click **Manual Deploy**.
5. [ ] **Check:** open `https://lpg-bulk-kpstechnology-fleet.onrender.com/health` in a browser → `{"status":"ok",...}`.

---

## Part 2 — Website on Vercel (5 minutes)

1. [ ] Vercel redeploys `main` automatically after the merge. If you pointed Render at the branch instead, do the same in Vercel → Settings → Git → Production Branch.
2. [ ] **Check:** open the website, log in as `kpsadmin`. You will need to log in once more than usual (old sessions are invalid after the secret change — expected).
3. [ ] Top bar → **Change Password** → set the strong admin password.
4. [ ] On the same page, **Password Recovery Contacts** → enter the owner's email and mobile number, confirm with the password, save. This is what the **Forgot password?** link on the login page uses: it emails a 6-digit code to that address and asks for that mobile number. Do this for each customer admin too (they can do it themselves after logging in).
5. [ ] Test it once: sign out → **Forgot password?** → username + mobile → check the recovery inbox for the code (needs the `SMTP_*` settings on Render to be valid — if the email never arrives, the Render log shows `[auth] Failed to send reset code email`).
6. [ ] Log in as a driver in the website, open a trip, add a diesel entry **with a photo**. Click the photo: its address should start with `https://res.cloudinary.com/...`. That confirms permanent photo storage.
7. [ ] Optional speed-up: Vercel → Settings → General → **Install Command** = `npm install --workspace shared --workspace frontend` (skips downloading the mobile app's packages on every website deploy).

---

## Part 3 — Test the mobile app on your phone (Expo Go, no account needed)

1. [ ] Phone: install **Expo Go** from Google Play.
2. [ ] PC (same Wi-Fi as the phone), terminal 1: `npm run dev` (starts the local backend).
   Terminal 2: `cd mobile` then `npx expo start`.
3. [ ] Phone: Expo Go → *Scan QR code* → scan the code in terminal 2.
4. [ ] The login screen shows `Server: http://<your PC IP>:5001/api/v1` at the bottom. If login says *Cannot reach the server*, allow Node.js through Windows Firewall (Windows Security → Firewall & network protection → Allow an app through firewall → Node.js → tick *Private*).
5. [ ] Walk through: driver login → Start Trip → advance → diesel with photo (grant camera + location) → Trip close. Then admin login → Drivers → a driver → **Share salary PDF**.
6. [ ] To test the phone against the **live** server instead, create `mobile/.env` containing
   `EXPO_PUBLIC_API_BASE_URL=https://lpg-bulk-kpstechnology-fleet.onrender.com/api/v1` and restart `npx expo start`.

---

## Part 4 — Installable Android build (APK) via Expo EAS (free)

This produces a file anyone can install on an Android phone without the Play Store — ideal for giving drivers early access.

1. [ ] Create a free account at https://expo.dev.
2. [ ] Terminal: `npm install -g eas-cli` then `eas login`.
3. [ ] `cd mobile` then `eas init` (links the project to your Expo account; accept defaults).
4. [ ] `eas build --platform android --profile preview`
   The first run asks to generate an Android keystore — answer **Yes** (Expo stores it for you; it is what proves future updates come from you). The build runs on Expo's servers (10–20 minutes).
5. [ ] When done you get a link to an `.apk`. Open it on the phone → Install (allow "unknown sources" if asked). The app is named **LPG Fleet Driver**, talks to the live Render server, and works without your PC.

---

## Part 5 — Google Play release

1. [ ] Create a **Google Play Console** account at https://play.google.com/console (one-time US$25). Identity verification can take a day or two.
2. [ ] **Privacy policy page** (Play requires it because the app uses camera and location). Publish a short page on your website, e.g. `https://kpstechnology.in/lpg-fleet-privacy`, stating: what data is collected (login, trip entries, receipt photos, GPS at diesel fills), why (fleet operations for the employer), who sees it (the customer's admins and KPS Technology), and a contact email. Keep the address — you enter it in Play Console.
3. [ ] Play Console → **Create app** → name `LPG Fleet Driver`, app type *App*, free. Complete the **Dashboard** tasks: privacy policy URL, app access (provide a **test driver login** since the app requires sign-in), ads (none), content rating questionnaire, target audience (18+ / business), data safety form (Location: collected, not shared; Photos: collected; Name/Username: collected).
4. [ ] Store listing: short description, full description, at least 2 phone screenshots (take them from the APK build), a 512×512 icon and a 1024×500 feature graphic. `mobile/assets/icon.png` is currently the Expo placeholder — replace it with your logo before this step (same file name and size).
5. [ ] Terminal: `cd mobile` then `eas build --platform android --profile production` (creates the `.aab` bundle Play needs).
6. [ ] Upload: either `eas submit --platform android --latest` (EAS asks you once for a Play service-account JSON — follow its prompts), or download the `.aab` from the build page and upload it in Play Console → **Testing → Internal testing → Create release**.
7. [ ] Add tester emails (yourself, a driver), roll out to internal testing, install from the test link, confirm it works.
8. [ ] Promote to **Production** when satisfied. First review typically takes a few days.

**Updating the app later:** `eas build --platform android --profile production` then `eas submit --platform android --latest`. Version numbers increase automatically.

---

## Part 6 — iOS (when you decide to)

- Requires an **Apple Developer** account (US$99/year) at https://developer.apple.com. No Mac is needed — Expo builds in the cloud.
- `eas build --platform ios --profile production` (EAS creates the certificates for you), then `eas submit --platform ios --latest`, then complete the App Store Connect listing (same information as Play).

---

## If something goes wrong

| Symptom | Likely cause | Fix |
|---|---|---|
| Render log: `JWT_SECRET must be set...` | Secret missing/short/contains "change" | Set a 96-character value from Part 0 |
| Website login works but "session expired" every 15 min | Old website build still deployed | Redeploy Vercel; hard-refresh the browser |
| Browser console: CORS error | Website address not in `ALLOWED_ORIGINS` | Add the exact `https://...` address, no trailing slash |
| Photos disappear after a deploy | `STORAGE_DRIVER` still `local` | Set `cloudinary` + `CLOUDINARY_URL` |
| Too many login attempts (429) for everyone | Proxy hops mis-detected | Report it — the server trusts 2 proxy hops by design |
| Forgot the admin password | — | First try **Forgot password?** on the login page (needs recovery contacts set in Part 2). Last resort, locally: put the Atlas `MONGO_URI` and `ADMIN_INITIAL_PASSWORD=<new>` in `backend/.env`, then `cd backend` and run `npm run seed -- --reset-admin-password`; afterwards remove both values again |
| Reset code email never arrives | SMTP settings wrong, or mobile number doesn't match | Check Render log for `[auth] Failed to send reset code email`; the mobile number is compared on its last 10 digits |
| Phone can't reach local backend | Firewall / different Wi-Fi | Part 3 step 4 |
