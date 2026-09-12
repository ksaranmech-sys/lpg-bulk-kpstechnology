# KPS Technology — Fleet Management System

A MERN (MongoDB + Express + React + Node) application for KPS Technology's
customers to manage their own truck fleets: trip logging, diesel/mileage
tracking, expense capture with photo + GPS proof, and automatic settlement
reports emailed as PDF. Built with a mobile app in mind — the backend is a
plain versioned REST API (`/api/v1/...`) with JWT auth, so a React Native (or
any other) mobile client can consume it unchanged.

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
`../LPG-FLEET-BACKEND/src/utils/tripCalculations.js`.

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
settle it (`tryCloseVehiclePreviousTrip` in `tripController.js`). If the
previous trip's own first-fill odometer reading is missing, settlement is
deferred until it's filled in — the trip simply stays "open."

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

```
kpstechnology-web/
  package.json             # single deployment boundary
  backend/
    src/
      config/         # db connection, shared enums (loading/unloading locations, roles)
      models/         # Customer, User, Vehicle, Trip (Mongoose schemas)
      middleware/     # JWT auth + role/vehicle scoping, file upload abstraction
      controllers/    # request handlers
      routes/         # /api/v1/* route wiring
      utils/          # trip settlement math, PDF report builder, mailer, seed script
  frontend/
    src/
      api/api.js      # single axios client - mirror this file for the mobile app
      context/        # auth state
      pages/          # Login, Dashboard, VehicleDetail, TripDetail, AdminOnboarding
      components/     # shared layout
```

## 4. Running it locally

From the `kpstechnology-web` root:
```bash
npm install
copy backend\.env.example backend\.env
npm run seed               # creates the first super_admin login (kpsadmin / ChangeMe@123)
npm run dev                 # http://localhost:5001
```

The backend serves the React application and the `/api/v1` API from the same
origin. For a production-style build and run:
```bash
npm run build
npm start                    # http://localhost:5001
```

The frontend API defaults to `/api/v1`; set
`frontend/.env` only when intentionally using a separate development API.

### First-time setup flow
1. Log in as `kpsadmin` (change the password immediately — there's no
   "change password" endpoint stubbed yet; add one before going live, or
   update it directly via the seed script/DB).
2. Go to **Admin → Onboard New Customer** (`/admin/onboarding`) to create a
   customer/subgroup and its first `customer_admin` login.
3. Log in as that customer admin, add vehicles (currently via API —
   `POST /api/v1/customers/:customerId/vehicles`; wire up a small UI form the
   same way `AdminOnboarding.jsx` is built if you want this in the browser).
4. Create `vehicle_user` logins the same way for drivers/staff who should
   only see one vehicle.
5. Start a trip, add diesel/RTO/other-expense entries (camera capture +
   automatic GPS tagging on mobile browsers), close out unloading details.
6. Start the *next* trip and record its first diesel fill — this
   automatically settles the previous trip and makes "Print / Email Report"
   available on it.

## 5. API summary (all under `/api/v1`, JWT bearer auth except `/auth/login`)

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/login` | username+password → JWT |
| GET | `/auth/me` | current user profile |
| GET | `/meta` | loading/unloading location dropdown values |
| POST | `/customers` | (super_admin) onboard a customer + its admin login |
| POST | `/customers/:id/vehicles` | add a vehicle under a customer |
| POST | `/customers/:id/users` | create a vehicle-scoped login |
| GET | `/vehicles` | list vehicles visible to the current user |
| GET/POST | `/vehicles/:id/trips` | list / start trips for a vehicle |
| GET | `/trips/:id` | trip detail incl. settlement once closed |
| POST | `/trips/:id/advances` | add a driver advance |
| POST | `/trips/:id/diesel` | multipart: volume, rate, odometer(optional), photo(optional) |
| POST | `/trips/:id/rto` | multipart: amount, date, photo+GPS |
| POST | `/trips/:id/other-expenses` | multipart: amount, date, description, photo |
| PATCH | `/trips/:id/unloading` | set unloading location + cleaner expense |
| GET | `/trips/:id/report` | streams the settlement PDF inline (for "Print") |
| POST | `/trips/:id/send-report` | emails the PDF to the company (+ customer cc) |

All photo uploads accept an optional `lat`/`lng` pair, which the frontend
fills in automatically from the browser's Geolocation API — the same call
works from a mobile app.

## 6. Deployment

Deploy the `kpstechnology-web` directory as one Node application. Use
`npm install` for the install command, `npm run build` for the build command,
and `npm start` for the start command. Configure the backend environment
variables on the hosting platform, including `MONGO_URI`, `JWT_SECRET`, and
the SMTP settings. Locally stored uploads are written under `backend/uploads`;
use S3 or another persistent volume in production.

## 7. What's stubbed / what to do before production

- **Password reset / change-password** endpoint — not built yet.
- **S3 storage** — `saveUploadedFile()` in `middleware/upload.js` has a
  ready-to-fill S3 branch; local disk storage is fine for development only.
- **Vehicle/customer-admin management UI** — the API exists
  (`addVehicleToCustomer`, `createVehicleUser` in `api.js`); only the
  customer-onboarding screen has a UI built. Add two more small forms mirrored
  on `AdminOnboarding.jsx` when needed.
- **Refresh tokens** — `.env` has placeholders; current implementation issues
  a single long-lived JWT for simplicity. Add refresh-token rotation before
  shipping the mobile app.
- **Validation** — `express-validator` is included as a dependency but not
  yet wired into every route; the controllers currently do minimal manual
  checks.
- **Tests** — none included yet; the settlement math in
  `tripCalculations.js` is the highest-value thing to unit test first since
  it's the part with the trickiest cross-trip logic.
