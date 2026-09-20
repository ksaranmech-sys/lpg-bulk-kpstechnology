# KPS Technology — Fleet Management System

A MERN (MongoDB + Express + React + Node) application for KPS Technology's
customers to manage their own truck fleets: trip logging, diesel/mileage
tracking, expense capture with photo + GPS proof, and automatic settlement
reports emailed as PDF. It ships as a **website** and an **Android/iOS app
("LPG Fleet Driver")** that share one backend and one API client.

---

## 1. How the domain model works

- **Customer** = a subgroup. Each customer has their own vehicles and users.
  Multi-tenant via a `customer` field on every record (not separate
  databases) — simplest to run and to extend to mobile.
- **Users**
  - `customer_admin` — full access to every vehicle under their customer.
  - `vehicle_user` — access restricted to exactly one assigned vehicle.
  - `super_admin` — KPS Technology staff; onboards new customers.
  - Customers don't self-register — KPS (or the customer admin, for
    vehicle_users) creates logins directly, matching "create username and
    password for different customers."
- **Vehicle** belongs to a customer; has a vehicle number and contact number.
- **Trip** belongs to a vehicle. It holds driver advances, loading location
  + expense, diesel fills, RTO entries, unloading location + expense, and
  other expenses — matching every field in the spec.

## 2. The tricky part: diesel, KM, and mileage across trip boundaries

This is the part worth reading carefully before changing anything in
`backend/src/utils/tripCalculations.js`.

A trip does **not** close when the driver finishes unloading — it closes the
moment diesel is filled again at the loading location **for the next trip**.
So two consecutive trips share a diesel-fill boundary event. Concretely:

- Trip N's **first** diesel entry is really "topping off" what's left from
  Trip N-1 — it does not represent Trip N's own consumption, so it's
  excluded.
- Trip N's diesel consumption = `sum(Trip N's diesel entries except the
  first)` **+** `Trip N+1's first diesel entry volume`.
- Trip N's KM run = `(Trip N+1's first fill odometer) - (Trip N's first fill
  odometer)`.
- Mileage = KM / diesel litres (as computed above).

Because of this, **a trip can only be settled once the next trip exists and
has recorded its own first diesel fill**. The API handles this automatically:
every time a diesel entry is saved and it happens to be the first entry on
its trip, the backend looks up that vehicle's previous open trip and tries to
settle it (`tryCloseVehiclePreviousTrip` in
`controllers/trip/tripHelpers.js`). If the previous trip's own first-fill
odometer reading is missing, settlement is deferred until it's filled in —
the trip simply stays "open."

**Expense settlement** (separate from diesel):

```
totalExpense = loadingExpense + unloadingExpense + sum(otherExpenses) + sum(rtoEntries)
balance      = totalAdvance - totalExpense
```

Diesel cost is *not* subtracted from the advance (only physically-paid cash
expenses are) — it's reported for information/mileage purposes only. If your
actual accounting also nets off diesel cost against the advance, that's a
one-line change in `computeTripSettlement()`.

## 3. Project layout

One repository, four npm workspaces. `npm install` at the root installs all
of them and links `shared` into the other three.

```
kpstechnology-web/
  package.json            # workspaces + root scripts (build, test, lint, dev)
  DEPLOYMENT.md           # step-by-step go-live checklist (Render, Vercel, Play Store)
  shared/                 # @kps/shared - plain JS used by BOTH web and mobile
    api.js                #   createApiClient(): every endpoint + token refresh
    dates.js  trips.js    #   date/month helpers, trip grouping, reminder expiry
    constants.js          #   roles, trip statuses, empty form shapes
  backend/                # Express 4 + Mongoose 8 API  (node --test for tests)
    src/
      config/env.js       #   reads + validates env vars (fails fast if secrets missing)
      config/db.js        #   Mongo connection with retry
      models/             #   Customer, User, Vehicle, Trip, Leave
      middleware/         #   auth (JWT + roles), validate (express-validator), rateLimit, upload (Cloudinary/local)
      controllers/        #   auth, customer, customerUsers, salary, vehicle, leave
      controllers/trip/   #   lifecycle, entries (advances/diesel/rto/other), report, helpers
      routes/             #   /api/v1/* wiring
      utils/              #   tripCalculations, salary, pdfGenerator, mailer, tokens, seed
    test/                 #   unit tests (npm test)
  frontend/               # React 18 website (Create React App)
    src/
      api/                #   thin wrapper around @kps/shared client + localStorage session
      context/            #   AuthContext
      pages/              #   one file per route (thin - composition only)
      features/           #   dashboard/, customer/, driver/ - one component per screen section
      components/trip/    #   trip entry sections shared by the trip page
  mobile/                 # "LPG Fleet Driver" - Expo SDK 57 / React Native / Expo Router
    app/                  #   file-based routes (login, forgot-password, (app)/...)
    src/                  #   config, session (SecureStore), api, AuthContext, ui kit, features/, trip/
    assets/  store/       #   icons/splash generated from store/logo-source.png (scripts/make-icons.ps1)
    eas.json              #   EAS build profiles (preview APK, production AAB)
```

## 4. Running it locally

Prerequisites: Node 20+, MongoDB (local `mongod` or an Atlas connection string).

```bash
npm install
copy backend\.env.example backend\.env      # then fill in the values below
npm run dev                                  # API + website on http://localhost:5001
```

`backend/.env` must contain at least:

- `MONGO_URI` — your database.
- `JWT_SECRET` and `JWT_REFRESH_SECRET` — two **different** random strings of
  32+ characters. Generate each with
  `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
  The server refuses to start without them.
- `ADMIN_INITIAL_PASSWORD` — only for the very first start on an empty
  database; it creates the `kpsadmin` super admin. Remove it afterwards. It is
  never used to overwrite an existing password.

Other useful commands (from the root):

| Command | What it does |
|---|---|
| `npm test` | backend unit tests + frontend tests |
| `npm run lint` | ESLint over backend and frontend |
| `npm run build` | production website build into `build/` (served by the backend) |
| `npm start` | production-style run on port 5001 |
| `cd backend && npm run seed -- --reset-admin-password` | emergency admin password reset (uses `ADMIN_INITIAL_PASSWORD`) |

**Mobile app in development:** `cd mobile && npx expo start`, then scan the
QR code with the Expo Go app on a phone on the same Wi-Fi. In development the
app automatically talks to the backend running on your PC (port 5001); set
`EXPO_PUBLIC_API_BASE_URL` in `mobile/.env` to override.

### First-time setup flow
1. Log in as `kpsadmin`. Top bar → **Change Password**; on the same page set
   **Password Recovery Contacts** (email + mobile) so "Forgot password?" works.
2. **Create Customer** (`/admin/onboarding`) to create a customer and its
   first `customer_admin` login.
3. As the customer admin: add vehicles and drivers from the dashboard /
   customer page (or from the mobile app).
4. As a driver: **Start Trip**, add advance, loading details, diesel fills
   (photo + GPS), RTO, unloading, other expenses, then **Trip close**.
5. Starting the *next* trip and recording its first diesel fill settles the
   previous one automatically.

## 5. Security model (what's in place)

- Passwords hashed with bcrypt; JWT access tokens expire in 15 min, refresh
  tokens in 30 days with rotation; logout / password change revokes all
  refresh tokens (`tokenVersion`).
- Self-service password change; forgot-password via one-time code emailed to a
  registered recovery address, requiring the registered recovery mobile
  number as a second factor (10-minute expiry, 5 attempts).
- Login and reset endpoints rate-limited (10 attempts / 15 min per IP);
  general API ceiling 1000 req / 15 min.
- Request bodies validated with `express-validator`; Mongo ids checked.
- CORS restricted to `ALLOWED_ORIGINS`; native apps (no Origin header) pass.
- Secrets never fall back to defaults; production refuses to start without
  `MONGO_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`.
- Uploads: image-only, 10 MB cap, stored on Cloudinary in production.
- Role checks on every route plus data scoping in controllers
  (customer_admin → own customer; vehicle_user → own vehicle).

## 6. API summary (all under `/api/v1`, bearer auth unless noted)

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/login` | public — username+password → `{ token, refreshToken, user }` |
| POST | `/auth/refresh` | public — refresh token → new pair |
| POST | `/auth/logout` | revoke all refresh tokens |
| GET | `/auth/me` | current profile |
| POST | `/auth/change-password` | `{ currentPassword, newPassword }` |
| POST | `/auth/recovery-contact` | `{ currentPassword, recoveryEmail, recoveryMobile }` |
| POST | `/auth/forgot-password` | public — `{ username, recoveryMobile }` → code emailed |
| POST | `/auth/reset-password-with-code` | public — `{ username, code, newPassword }` |
| POST | `/auth/reset-password` | admin resets a user under their scope |
| GET/PUT | `/meta`, `/meta/route-km` | location lists and route KM table |
| GET/POST | `/customers` | (super_admin) list / onboard customer + admin login |
| GET/PATCH/DELETE | `/customers/:id` | customer detail / update / delete |
| POST | `/customers/:id/vehicles` | add a vehicle |
| POST/PATCH/DELETE | `/customers/:id/users[/:userId]` | driver logins |
| GET | `/customers/:id/users/:userId/salary?month=YYYY-MM` | monthly salary breakdown |
| GET | `/customers/:id/users/:userId/monthly-summary` | salary PDF |
| GET | `/vehicles` | vehicles visible to the current user |
| PATCH | `/vehicles/:id/document-reminders` | RC/insurance/permit expiry dates |
| GET/POST | `/vehicles/:id/trips` | list / start trips |
| GET/DELETE | `/trips/:id` | trip detail (with settlement) / delete |
| POST/PATCH/DELETE | `/trips/:id/advances[/:i]` | driver advances |
| POST/PATCH/DELETE | `/trips/:id/diesel[/:i]` | multipart: volume, total, odometer, photo, `lat`/`lng` (required) |
| POST/PATCH | `/trips/:id/rto[/:i]` | multipart: amount, date, photo |
| POST/PATCH/DELETE | `/trips/:id/other-expenses[/:i]` | multipart: description, amount, date, photo |
| PATCH | `/trips/:id/loading` · `/unloading` · `/turn` · `/unloading-turn` | trip stages |
| POST | `/trips/:id/close` | close (settle) a trip |
| GET / POST | `/trips/:id/report` · `/send-report` | settlement PDF / email it |
| GET/POST/PATCH/DELETE | `/leaves[/:id]` | driver leave entries |

## 7. Deployment

See **[DEPLOYMENT.md](DEPLOYMENT.md)** — a checklist covering Render
(backend), Vercel (website), Cloudinary (photos), Expo EAS (Android/iOS
builds) and the Google Play listing, including every environment variable.
