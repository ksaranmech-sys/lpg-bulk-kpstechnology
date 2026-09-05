# KPS Technology - Truck Trip & Reminder System

A web app for tracking truck trips (diesel, KM, mileage, expenses) and sending
document-expiry reminders. Runs as a normal Node.js web server so any number of
customers/drivers can log in from their own phone or computer, from anywhere,
once it's deployed on a live server.

## How the roles work

| Role | Created by | Access |
|---|---|---|
| **Super Admin** (KPS Technology staff) | seeded automatically on first run | Creates every customer account |
| **Customer Admin** | Super Admin, when creating a customer | Full access to all of that customer's vehicles: add vehicles, create vehicle logins, set document expiry dates, view all trips/reports |
| **Vehicle User** | Customer Admin, per vehicle | Can only see/enter data for the one vehicle they're assigned to (start loading fills, diesel entries, RTO, other expenses, unloading, view that vehicle's trip reports) |

## Trip logic implemented (as specified)

- A trip **opens** the moment a diesel fill is entered at a loading location.
- That first fill's litres/value are **not** counted — it only records the
  starting odometer reading.
- Every later fill during the trip **is** counted.
- The trip **closes automatically** the moment the *next* loading-point diesel
  fill is entered — that closing fill's litres/value count toward the trip
  that's ending, and its odometer reading becomes the trip's end odometer. The
  same fill then becomes the *opening* (uncounted) fill of the new trip.
- **KM** = end odometer − start odometer.
- **Mileage** = KM ÷ total counted diesel litres.
- **Total expenses** = loading expense + unloading expense + all RTO entries +
  all other expenses (diesel is **not** included in this total).
- **Net amount** = driver advance − total expenses.
- The moment a trip closes, a printable report is generated automatically and
  emailed to the customer's registered email address. It can also be re-sent
  or opened/printed on demand from the vehicle/trip screens.

## Reminders

A daily job (runs at 08:00 server time):
- Sends a **Q-Tax** reminder to every customer on the last calendar day of
  each quarter (Mar/Jun/Sep/Dec).
- Sends a reminder **15 days before expiry** for: Fitness, 1 Year Permit,
  5 Year Permit, Purging, Explosive License, PLI, Vehicle Insurance, Hydro
  Certificate.

## Photos & GPS

Diesel fills, RTO entries, and other expenses all accept an optional photo
(taken with the phone camera or uploaded from the gallery — the `capture`
attribute on file inputs opens the camera directly on mobile). RTO entries
also automatically attach the browser's GPS coordinates when the user allows
location access.

---

## Running it locally (for testing)

```bash
cd kps-technology
npm install
cp .env.example .env
# edit .env: set JWT_SECRET, SMTP_* mail settings, and the super-admin login
npm start
```

The server starts on `http://localhost:4000` (or whatever `PORT` you set).
The database (`db/kps.db`, SQLite) and its tables are created automatically
the first time you run it, along with the super-admin login from your `.env`.

Open `http://localhost:4000` → log in as the super admin → create your first
customer → log out → log in as that customer admin → add a vehicle → create a
vehicle login → hand that username/password to the driver/user.

## Deploying to a live server (so different systems can use it)

Any small Linux VPS (DigitalOcean, AWS Lightsail, Hostinger VPS, etc.) works.
Outline:

1. Install Node.js (v18+) on the server.
2. Upload this whole `kps-technology` folder to the server (e.g. via `git`,
   `scp`, or an SFTP client).
3. `cd kps-technology && npm install`
4. Create `.env` on the server with real values:
   - `JWT_SECRET` — any long random string.
   - `SMTP_*` — your company's email account (Gmail with an "App Password",
     or any SMTP provider) so reports and reminders actually get delivered.
   - `SUPERADMIN_USERNAME` / `SUPERADMIN_PASSWORD` — your own login.
5. Keep it running permanently with a process manager, e.g.:
   ```bash
   npm install -g pm2
   pm2 start server.js --name kps-technology
   pm2 save
   pm2 startup
   ```
6. Put Nginx in front of it as a reverse proxy (so you can use a normal domain
   name and free HTTPS via Let's Encrypt/certbot) forwarding port 80/443 to
   the app's `PORT` (default 4000).
7. Once that's done, anyone — on any computer or phone, anywhere — can go to
   `https://your-domain.com` and log in with the username/password you gave
   them. No installation needed on their side; it's just a website.

### Backing up
The entire database lives in one file: `db/kps.db` (plus `-wal`/`-shm`
companion files while the server is running). Back that file up regularly.
Uploaded photos live in the `uploads/` folder — back that up too.

## Project structure

```
kps-technology/
  server.js              - app entry point
  db/                     - SQLite database + schema/seed script
  middleware/             - auth (JWT) and file-upload handling
  routes/                 - REST API: auth, customers, vehicles, trips, config
  utils/                  - trip calculations, report builder, email, reminders
  public/                 - the actual website (HTML/CSS/JS), served statically
```

## Notes / things you may want to extend later

- Passwords are entered as plain text by the admin when creating a login
  (there's no self-service "forgot password" flow yet) — an admin can reset
  a user's password directly in the database if needed, or this can be added
  as a small extra screen.
- The printable report currently opens as an HTML page the user prints to
  PDF from their browser (Ctrl/Cmd+P → Save as PDF); a one-click "download
  as PDF" button can be added later using the `pdfkit` dependency already
  included in `package.json`.
- Multiple vehicle users per vehicle, or a customer having more than one
  admin login, aren't in this first version but the schema supports adding
  them easily.
