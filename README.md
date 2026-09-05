# KPS Technology — Fleet Management System

A starter, working codebase for the app you described: customer logins (admin +
single-vehicle user), trip/diesel/expense tracking with photo+GPS capture, automatic
mileage & settlement calculation, printable/emailable trip reports, and expiry
reminders for 9 vehicle documents.

**Stack**: Next.js (React, deploys natively on Vercel) + MongoDB Atlas + NextAuth +
Vercel Blob (photo storage) + Resend (email) + Vercel Cron (reminders) + pdf-lib
(printable reports).

> Why Next.js instead of plain React? Vercel is built around it — you get API routes,
> serverless functions, and cron jobs in the same project with zero extra config. A
> plain React (Vite) app would need a *separate* backend hosted somewhere else.

---

## 1. What's already built in this folder

```
lib/
  mongodb.js          MongoDB connection (cached for serverless)
  auth.js              NextAuth config + role-based access guard
  tripCalculations.js  The diesel/KM/mileage/expense/balance math
  tripPdf.js           Printable settlement PDF generator
  email.js             Sends trip reports + reminder emails (Resend)
  reminders.js         Reminder-due logic (quarter-end / 15-days-before)
models/
  User.js              superadmin / admin / user roles
  Customer.js           name, mobile, email
  Vehicle.js            vehicle number + the 9 document expiry fields
  Trip.js               advance, loading/unloading, diesel fills, RTO, expenses
pages/
  login.js             Login page
  api/auth/[...nextauth].js
  api/customers/index.js       superadmin-only: create customer + its admin login
  api/vehicles/index.js       list vehicles (role-scoped) / register vehicle (superadmin only)
  api/vehicles/[id].js         fetch one vehicle / edit its document expiry dates
  api/trips/index.js          list/create trips
  api/trips/[id]/diesel.js    add a diesel fill
  api/trips/[id]/rto.js       add an RTO entry
  api/trips/[id]/expense.js   add an "other expense"
  api/trips/[id]/close.js     settle trip, generate PDF, email it
  api/cron/reminders.js       daily reminder job
  api/upload.js               photo upload endpoint (Vercel Blob)
components/
  DieselFillEntry.jsx  Example form: camera capture + GPS tagging + upload
scripts/
  seedSuperAdmin.js    Creates your very first login
vercel.json            Registers the daily cron job
.env.example           Every environment variable you need to set
```

This is a **working backend + data model + one example form**, not a finished UI for
every screen. Section 6 below tells you exactly how to build the remaining pages by
copying the same pattern.

---

## 2. How the business rules map to code

**Roles & access** (`lib/auth.js`)
- `superadmin` — KPS staff **only**. The only role that can create a `Customer` record,
  its `admin` login, and register vehicle numbers (`POST /api/customers`,
  `POST /api/vehicles`). This matches "KPS creates username/password for customers."
- `admin` — a customer's main login. Its feed is strictly scoped to its own
  `customerId` — it can never see or touch another customer's vehicles or trips. It
  *can* edit its own fleet's document expiry dates (`PATCH /api/vehicles/:id`), but
  cannot register a new vehicle number itself — that stays with KPS staff.
- `user` — restricted login tied to exactly one `assignedVehicle`. Can view that
  vehicle's **current open trip and its full trip history** (`GET /api/trips` returns
  all trips for the assigned vehicle unless a `status` filter is passed), start/update
  trips, but cannot edit document expiry dates.
- Every API route checks `canAccessVehicle()` before returning or mutating data, so
  this scoping is enforced server-side, not just hidden in the UI.

**Trip lifecycle** (`models/Trip.js`, `lib/tripCalculations.js`)
1. Trip opens: driver advance, loading location, loading (cleaner) expense, and the
   **first diesel fill** are recorded together. This first fill is the carry-over from
   wherever the truck last filled up — it's stored, but excluded from this trip's diesel
   total.
2. While on the road: any number of extra diesel fills, RTO entries (amount + date +
   GPS-tagged photo), and "other expenses" (amount + date + photo) can be added.
3. Trip closes: when diesel is filled again **at the next loading location**, that fill
   is added as normal via `/api/trips/:id/diesel`, then `/api/trips/:id/close` is called
   with the unloading location + unloading expense. That single call:
   - Sums diesel litres/value from the **second fill onward** (first fill excluded).
   - KM = odometer at the closing fill − odometer at the first fill.
   - Mileage = KM ÷ diesel litres.
   - Total expenses = loading expense + unloading expense + all RTO entries + all other
     expenses (**diesel is deliberately not included**, per your spec).
   - Balance = advance − total expenses.
   - Builds a one-page PDF and emails it to the customer's registered address.

**Reminders** (`lib/reminders.js`, `pages/api/cron/reminders.js`)
- Every document except Q-Tax uses a "15 days before `expiryDate`" rule.
- Q-Tax ignores `expiryDate` and instead fires on the **last calendar day of every
  quarter** (Mar 31 / Jun 30 / Sep 30 / Dec 31), matching "reminder at end of every
  quarter."
- A `lastReminderSentFor` key on each document prevents the same reminder firing twice.
- `vercel.json` schedules this to run once a day; Vercel calls it with a bearer token
  equal to `CRON_SECRET`, which the route checks.

---

## 3. Step-by-step: get this running

### Step 1 — Install prerequisites
- Node.js 18+ installed
- A free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) account
- A free [Vercel](https://vercel.com/signup) account
- A free [Resend](https://resend.com) account (email sending)
- GitHub account (Vercel deploys from a Git repo)

### Step 2 — Create the database
1. In MongoDB Atlas, create a free (M0) cluster.
2. Database Access → add a database user with a password.
3. Network Access → allow access from `0.0.0.0/0` (Vercel's IPs are dynamic).
4. Get your connection string (Connect → Drivers) — this is `MONGODB_URI`.

### Step 3 — Set up email sending
1. Sign up at resend.com, verify a sending domain (or use their test domain while
   developing).
2. Create an API key — this is `RESEND_API_KEY`.
3. Update the `from:` address in `lib/email.js` to your verified domain.

### Step 4 — Configure environment variables
Copy `.env.example` to `.env.local` and fill in every value:
```
MONGODB_URI=...
NEXTAUTH_SECRET=...     # generate with: openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000
RESEND_API_KEY=...
COMPANY_EMAIL=...
BLOB_READ_WRITE_TOKEN=... # from Vercel dashboard, Storage tab, after Step 7
CRON_SECRET=...          # generate with: openssl rand -base64 32
```

### Step 5 — Install & run locally
```bash
npm install
npm run dev
```
Visit `http://localhost:3000`.

### Step 6 — Create your first login
```bash
node scripts/seedSuperAdmin.js
```
This creates `kpsadmin / ChangeMe123!` with the `superadmin` role. Log in, then build a
small internal page (or use MongoDB Compass/Atlas UI directly at first) to:
1. Create a `Customer` document (name, mobile, email).
2. Create that customer's `admin` User (`role: "admin"`, `customerId` set).
3. Have the admin add vehicle numbers (`POST /api/vehicles`).
4. Create `user` logins per vehicle (`role: "user"`, `assignedVehicle` set) for drivers
   who should only see one truck.

### Step 7 — Push to GitHub & deploy on Vercel
```bash
git init && git add . && git commit -m "Initial KPS fleet app"
```
Create a GitHub repo, push, then in Vercel: **New Project → Import** your repo.
- Add all the same environment variables from `.env.local` in Vercel's Project
  Settings → Environment Variables (set `NEXTAUTH_URL` to your real `https://...
  vercel.app` domain).
- Go to Storage tab → Create a Blob store → copy `BLOB_READ_WRITE_TOKEN` into env vars.
- Deploy.

Vercel automatically registers the cron job from `vercel.json` once deployed — no extra
step needed. (Cron jobs only run on deployed projects, not `localhost`.)

### Step 8 — Verify the cron job
In Vercel → your project → Cron Jobs tab, you can trigger `/api/cron/reminders`
manually to test it before waiting for the schedule.

---

## 4. Data you enter, mapped to fields

| Your requirement | Field |
|---|---|
| Vehicle number | `Vehicle.vehicleNumber` |
| Customer mobile number | `Customer.mobileNumber` |
| Customer mail address | `Customer.email` |
| Driver advance + date | `Trip.driverAdvance.{amount,date}` |
| Loading location (dropdown) | `Trip.loadingLocation`, options in `models/Trip.js` |
| Loading expense (cleaner) | `Trip.loadingExpense` |
| Diesel fills (volume/rate/value/KM/photo) | `Trip.dieselFills[]` |
| RTO entries (amount/date/photo+GPS) | `Trip.rtoEntries[]` |
| Unloading location (dropdown) | `Trip.unloadingLocation` |
| Unloading expense (cleaner) | `Trip.unloadingExpense` |
| Other expenses (amount/date/photo) | `Trip.otherExpenses[]` |
| Document expiry dates (9 types) | `Vehicle.documents.{qTax,fitness,permit1Year,permit5Year,purging,explosive,pli,insurance,hydroCertificate}` |

To change the dropdown options later, edit the `LOADING_LOCATIONS` /
`UNLOADING_LOCATIONS` arrays at the top of `models/Trip.js`.

---

## 5. Photo + GPS capture pattern

`components/DieselFillEntry.jsx` shows the full pattern used for every photo in the
app (diesel, RTO, other expenses):
1. `<input type="file" accept="image/*" capture="environment">` — opens the phone's
   rear camera by default, but the user can still tap "choose from gallery" to upload
   an existing photo (covers your "take photo OR upload" requirement).
2. `navigator.geolocation.getCurrentPosition()` grabs GPS coordinates at the moment of
   upload (used for RTO photos as required; harmless to also attach it everywhere else).
3. The file uploads directly to Vercel Blob storage via `@vercel/blob/client`, so large
   images never pass through your API function body.
4. The resulting `{ url, gps }` object is saved on the relevant sub-document.

Copy this component's shape for the RTO and "other expense" forms, pointing them at
`/api/trips/:id/rto` and `/api/trips/:id/expense` respectively.

---

## 6. What to build next (pages not yet included)

The backend and data model are complete; build these pages using the fetch calls shown
above as your API layer:

1. **`/dashboard`** — After login, redirect by role: superadmin sees all customers;
   admin sees their vehicle list; user is sent straight to their one vehicle's trip
   screen.
2. **`/vehicles/[id]`** — Vehicle detail: current open trip (if any) or a "Start Trip"
   button; the 9 document expiry dates with date pickers (`PUT` to a new
   `/api/vehicles/[id]` route you add, following the pattern in `api/vehicles/index.js`).
3. **`/vehicles/[id]/trip`** — The active trip screen: shows running lists of diesel
   fills / RTO entries / other expenses, each backed by a form like
   `DieselFillEntry.jsx`, plus a "Close Trip" button that calls `/api/trips/:id/close`.
4. **A printable view** — A simple page at `/trips/[id]/print` that fetches the closed
   trip and renders it with `@media print` CSS, so staff can hit Ctrl+P as well as
   receiving the emailed PDF.
5. **Admin screens** for superadmin to create customers/admins, and for a customer
   admin to create per-vehicle `user` logins (hash passwords with `bcryptjs`, same as
   `seedSuperAdmin.js`).

Each of these is a normal Next.js page using `useSession()` from `next-auth/react` to
guard access, and the existing API routes for data — no new backend concepts needed.

---

## 7. Notes & things to double check before going live

- Trip closing assumes the closing diesel fill was already added via `/diesel` before
  calling `/close` — build the UI so "Close Trip" is only enabled after that fill is
  entered.
- Mileage/KM are `null` if odometer readings weren't entered on both the first and
  closing fill (odometer is optional per your spec) — display that gracefully in the UI.
- Currency is assumed INR throughout (`Rs`) — change the label in `tripPdf.js` if needed.
- Add indexes on `Vehicle.vehicleNumber` (already `unique: true`) and
  `Trip.{vehicleId,status}` once you have real data volume.
- Consider restricting who can edit a *closed* trip (currently nothing allows it, which
  is intentional — treat closed trips as immutable financial records).
