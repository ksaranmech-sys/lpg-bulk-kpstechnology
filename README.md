# Fleet Trip Manager

A no-backend, browser-only web app for tracking truck trips per customer:
driver advances, loading/unloading, diesel fills, RTO expenses, other
expenses, mileage, and a printable/emailable trip report. Data is stored in
the browser's `localStorage` — there is no server and no database to host.

## Files

| File | Purpose |
|---|---|
| `index.html` | The app shell (login, license, dashboard screens) |
| `style.css` | Visual design |
| `app.js` | All app logic: auth, trips, calculations, reports |
| `config.js` | **Edit this per customer** — company ID, name, contact, dropdown lists |
| `license.js` | Offline license key generation/validation |
| `keygen.html` | Developer-only tool to generate renewal keys — do not give this file to customers |

## Setting up a new customer

1. Copy this whole folder.
2. Open `config.js` and set:
   - `COMPANY_ID` — a unique string for this customer (e.g. `"ACME-LOGISTICS-01"`). Keep it unique across all your customers — license keys are tied to it.
   - `DEFAULT_COMPANY_NAME`, `DEFAULT_COMPANY_MOBILE`, `DEFAULT_COMPANY_EMAIL`
   - `DEFAULT_ADMIN_USERNAME` / `DEFAULT_ADMIN_PASSWORD` — the first login you'll hand to the customer's admin. Tell them to change the password from Settings → Users after first login.
3. Host the folder anywhere static files work (a plain web host, S3/Netlify/GitHub Pages, or even opened locally as `index.html` on the vehicle owner's/office computer). No build step, no server code.
4. Open `keygen.html` yourself (not the customer), enter that customer's `COMPANY_ID`, and generate a 1-year key. Give the customer only the key string — never send them `keygen.html`.
5. The customer opens the app, enters that key on the **Activate** screen, then signs in with the admin credentials from step 2.

## Renewing a license every year

1. Open `keygen.html`, enter the customer's `COMPANY_ID`, choose the renewal length, and generate a new key.
2. Send the customer the new key.
3. The customer's admin goes to **Settings → License** inside the app and pastes it into "Enter renewal key from developer".

The app shows a reminder banner on the login screen starting 21 days before expiry so the admin knows to ask you for the next key.

> **Note on security:** this license scheme is fully client-side (there's no server to phone home to), which is what makes the app free to host. It's enough to enforce a yearly renewal conversation with each customer, but anyone with programming knowledge who reads `license.js` could forge a key. If you need real protection against forged keys, move key validation to a small server endpoint you control instead of `license.js`.

## Roles

- **Admin** — sees every vehicle, manages vehicles and user accounts, edits company details, applies license renewals, and can open any vehicle's trips and reports.
- **User** — signs in and sees only the one vehicle assigned to their account: its current trip and its trip history/reports. Create one user account per driver/vehicle from **Manage users** (admin only).

## How a trip works

1. **First trip on a vehicle**: enter the opening diesel fill (volume, rate, odometer, date, optional photo), the driver advance, and the loading location + loading (cleaner) expense.
2. While the trip is open you can log: more diesel fills, RTO entries (amount, date, photo, GPS captured from the browser), the unloading location + expense, and other expenses (amount, date, photo).
3. **Closing a trip**: this happens "once diesel is filled again at the loading location" for the next trip — enter that fill's volume, rate, odometer, and date. The app immediately:
   - Excludes the trip's very first fill from the diesel/mileage math.
   - Sums the trip's interim fills **plus this closing fill** as diesel used.
   - Calculates KM as (closing odometer − opening odometer).
   - Calculates mileage as KM ÷ diesel used.
   - Adds up loading + unloading + RTO + other expenses (diesel excluded) and subtracts that from the driver advance to get the balance.
   - Starts the next trip automatically, using this same fill as its opening fill — so you only enter the reading once.
4. From any closed trip's **Report**, you can **Print / Save PDF**, or **Email to company address**, which opens the admin's mail app with a prefilled summary addressed to the company email from Settings. (Photos aren't attached automatically by the mailto link — print to PDF first if you need photos included in what you send.)

## Data & photos

Everything — company info, vehicles, users, trips, and photos — is saved in
the browser's `localStorage` on the device being used. Photos are
compressed before saving to keep storage usage reasonable, but very heavy
use of photos on one device over a long time can approach the browser's
storage limit; there's no server-side backup. If a customer wants
protection against losing data if the browser storage is cleared or the
device is lost, add a small backup/export step or move storage to a real
backend.
