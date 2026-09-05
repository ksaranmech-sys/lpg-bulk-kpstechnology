/* =========================================================================
   APP.JS — Fleet Trip Manager
   Single-tenant per deployment. All data lives in this browser's
   localStorage, namespaced by APP_CONFIG.COMPANY_ID so multiple customer
   copies never collide if ever opened on the same machine.
   ========================================================================= */

const CID = APP_CONFIG.COMPANY_ID;
const K = {
  license: `${CID}_license`,
  company: `${CID}_company`,
  users: `${CID}_users`,
  vehicles: `${CID}_vehicles`,
  trips: `${CID}_trips`,
  session: `${CID}_session`
};

/* ---------------------------- storage helpers ---------------------------- */
const DB = {
  get(key, fallback){
    const raw = localStorage.getItem(key);
    if(raw === null) return fallback;
    try { return JSON.parse(raw); } catch(e){ return fallback; }
  },
  set(key, value){ localStorage.setItem(key, JSON.stringify(value)); }
};

function uid(prefix="id"){
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;
}
function todayStr(){
  const d = new Date();
  return d.toISOString().slice(0,10);
}
function fmtMoney(n){
  const v = Number(n)||0;
  return "₹" + v.toLocaleString("en-IN", {maximumFractionDigits:2});
}
function fmtNum(n, digits=2){
  const v = Number(n);
  return isFinite(v) ? v.toFixed(digits) : "—";
}
function esc(s){
  return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

/* ------------------------------- seed data -------------------------------- */
function ensureSeed(){
  if(DB.get(K.company) === undefined){
    DB.set(K.company, {
      name: APP_CONFIG.DEFAULT_COMPANY_NAME,
      mobile: APP_CONFIG.DEFAULT_COMPANY_MOBILE,
      email: APP_CONFIG.DEFAULT_COMPANY_EMAIL
    });
  }
  if(DB.get(K.users) === undefined){
    DB.set(K.users, [{
      id: uid("usr"),
      username: APP_CONFIG.DEFAULT_ADMIN_USERNAME,
      password: APP_CONFIG.DEFAULT_ADMIN_PASSWORD,
      role: "admin",
      vehicle: null
    }]);
  }
  if(DB.get(K.vehicles) === undefined) DB.set(K.vehicles, []);
  if(DB.get(K.trips) === undefined) DB.set(K.trips, []);
}

/* ---------------------------------------------------------------------------
   APP — top level controller: boot, auth, routing
--------------------------------------------------------------------------- */
const App = {
  route: { name: "home" },

  boot(){
    ensureSeed();
    const lic = DB.get(K.license, null);
    const check = lic ? LicenseKit.validate(lic.key, CID) : { valid:false };
    if(!check.valid){
      this.showScreen("license");
      if(lic && lic.key){
        document.getElementById("licenseInput").value = lic.key;
        this.flashLicenseError(check.reason || "License invalid.");
      }
      return;
    }
    DB.set(K.license, { key: lic.key, expiry: check.expiry });
    const sessionUserId = DB.get(K.session, null);
    const users = DB.get(K.users, []);
    const user = users.find(u => u.id === sessionUserId);
    if(!user){
      this.showScreen("login");
      this.renderLoginBrand();
      return;
    }
    this.currentUser = user;
    this.enterApp();
  },

  showScreen(name){
    ["license","login","app"].forEach(s=>{
      document.getElementById(`screen-${s}`).classList.toggle("hidden", s!==name);
    });
  },

  flashLicenseError(msg){
    const el = document.getElementById("licenseError");
    el.textContent = msg; el.classList.remove("hidden");
  },

  submitLicense(){
    const key = document.getElementById("licenseInput").value.trim();
    const check = LicenseKit.validate(key, CID);
    if(!check.valid){
      this.flashLicenseError(check.reason || "Invalid key.");
      return;
    }
    DB.set(K.license, { key, expiry: check.expiry });
    this.showScreen("login");
    this.renderLoginBrand();
  },

  renderLoginBrand(){
    const company = DB.get(K.company);
    document.getElementById("loginCompanyName").textContent = company.name;
    const lic = DB.get(K.license);
    const check = LicenseKit.validate(lic.key, CID);
    const warn = document.getElementById("licenseWarning");
    if(check.valid && check.daysLeft <= 21){
      warn.textContent = `License renews in ${check.daysLeft} day(s) — ask your developer for a renewal key soon.`;
      warn.classList.remove("hidden");
    } else {
      warn.classList.add("hidden");
    }
  },

  submitLogin(){
    const u = document.getElementById("loginUser").value.trim();
    const p = document.getElementById("loginPass").value;
    const users = DB.get(K.users, []);
    const found = users.find(x => x.username.toLowerCase() === u.toLowerCase() && x.password === p);
    const err = document.getElementById("loginError");
    if(!found){
      err.textContent = "Incorrect username or password.";
      err.classList.remove("hidden");
      return;
    }
    err.classList.add("hidden");
    DB.set(K.session, found.id);
    this.currentUser = found;
    this.enterApp();
  },

  logout(){
    localStorage.removeItem(K.session);
    this.currentUser = null;
    document.getElementById("loginUser").value = "";
    document.getElementById("loginPass").value = "";
    this.showScreen("login");
    this.renderLoginBrand();
  },

  enterApp(){
    this.showScreen("app");
    const company = DB.get(K.company);
    document.getElementById("hdrCompanyName").textContent = company.name;
    const lic = DB.get(K.license);
    const check = LicenseKit.validate(lic.key, CID);
    document.getElementById("hdrLicenseNote").textContent =
      check.valid ? `License valid until ${check.expiry}` : "License issue";
    document.getElementById("hdrUserInfo").textContent = this.currentUser.username;
    document.getElementById("hdrRolePill").textContent = this.currentUser.role.toUpperCase();

    if(this.currentUser.role === "admin"){
      this.route = { name: "adminHome" };
    } else {
      this.route = { name: "vehicle", vehicle: this.currentUser.vehicle };
    }
    this.render();
  },

  goto(route){ this.route = route; this.render(); window.scrollTo({top:0}); },

  render(){
    const main = document.getElementById("mainContent");
    main.innerHTML = "";
    switch(this.route.name){
      case "adminHome": main.innerHTML = Views.adminHome(); break;
      case "vehicles": main.innerHTML = Views.vehiclesMgmt(); break;
      case "users": main.innerHTML = Views.usersMgmt(); break;
      case "settings": main.innerHTML = Views.settings(); break;
      case "vehicle": main.innerHTML = Views.vehicleDashboard(this.route.vehicle); break;
      case "report": main.innerHTML = Views.report(this.route.tripId); break;
      default: main.innerHTML = "<p>Not found.</p>";
    }
  }
};

/* ---------------------------------------------------------------------------
   Photo + GPS capture helpers
--------------------------------------------------------------------------- */
function compressImage(file, maxW=900, quality=0.62){
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = e => { img.src = e.target.result; };
    reader.onerror = reject;
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function captureGPS(){
  return new Promise((resolve) => {
    if(!navigator.geolocation){ resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy:true, timeout:8000 }
    );
  });
}

/* ---------------------------------------------------------------------------
   Trip data access + calculations
--------------------------------------------------------------------------- */
const Trips = {
  all(){ return DB.get(K.trips, []); },
  save(list){ DB.set(K.trips, list); },
  byVehicle(vehicle){ return this.all().filter(t => t.vehicleNumber === vehicle).sort((a,b)=> b.createdAt - a.createdAt); },
  openTrip(vehicle){ return this.all().find(t => t.vehicleNumber === vehicle && t.status === "open"); },
  get(id){ return this.all().find(t => t.id === id); },
  update(id, mutator){
    const list = this.all();
    const idx = list.findIndex(t => t.id === id);
    if(idx === -1) return;
    mutator(list[idx]);
    this.save(list);
  },

  startFirstTrip(vehicle, openingFill, advance, advanceDate, loadingLocation, loadingExpense){
    const list = this.all();
    list.push({
      id: uid("trip"),
      vehicleNumber: vehicle,
      status: "open",
      createdAt: Date.now(),
      openingFill,
      driverAdvance: Number(advance)||0,
      driverAdvanceDate: advanceDate,
      loadingLocation, loadingExpense: Number(loadingExpense)||0,
      dieselEntries: [],
      rtoEntries: [],
      unloadingLocation: null, unloadingExpense: 0,
      otherExpenses: [],
      closedAt: null, closingFill: null, calc: null
    });
    this.save(list);
  },

  closeAndStartNext(tripId, closingFill, advance, advanceDate, loadingLocation, loadingExpense){
    const list = this.all();
    const trip = list.find(t => t.id === tripId);
    if(!trip) return;
    trip.closingFill = closingFill;
    trip.closedAt = Date.now();
    trip.status = "closed";
    trip.calc = calcTrip(trip);
    list.push({
      id: uid("trip"),
      vehicleNumber: trip.vehicleNumber,
      status: "open",
      createdAt: Date.now(),
      openingFill: closingFill,
      driverAdvance: Number(advance)||0,
      driverAdvanceDate: advanceDate,
      loadingLocation, loadingExpense: Number(loadingExpense)||0,
      dieselEntries: [],
      rtoEntries: [],
      unloadingLocation: null, unloadingExpense: 0,
      otherExpenses: [],
      closedAt: null, closingFill: null, calc: null
    });
    this.save(list);
  }
};

function calcTrip(trip){
  const interimVol = trip.dieselEntries.reduce((s,d)=> s + (Number(d.volume)||0), 0);
  const interimCost = trip.dieselEntries.reduce((s,d)=> s + (Number(d.volume)||0)*(Number(d.rate)||0), 0);
  const closingVol = trip.closingFill ? (Number(trip.closingFill.volume)||0) : 0;
  const closingCost = trip.closingFill ? closingVol*(Number(trip.closingFill.rate)||0) : 0;
  const dieselUsedLtr = interimVol + closingVol;
  const dieselCost = interimCost + closingCost;
  const km = trip.closingFill ? (Number(trip.closingFill.odometer)||0) - (Number(trip.openingFill.odometer)||0) : null;
  const mileage = (km !== null && dieselUsedLtr > 0) ? km/dieselUsedLtr : null;

  const rtoTotal = trip.rtoEntries.reduce((s,r)=> s + (Number(r.amount)||0), 0);
  const otherTotal = trip.otherExpenses.reduce((s,o)=> s + (Number(o.amount)||0), 0);
  const totalExpenseExclDiesel = (Number(trip.loadingExpense)||0) + (Number(trip.unloadingExpense)||0) + rtoTotal + otherTotal;
  const balance = (Number(trip.driverAdvance)||0) - totalExpenseExclDiesel;

  return { dieselUsedLtr, dieselCost, km, mileage, rtoTotal, otherTotal, totalExpenseExclDiesel, balance };
}

/* ---------------------------------------------------------------------------
   VIEWS — pure functions returning HTML strings for each screen
--------------------------------------------------------------------------- */
const Views = {

  adminHome(){
    const vehicles = DB.get(K.vehicles, []);
    const trips = Trips.all();
    const cards = vehicles.map(v => {
      const open = trips.find(t => t.vehicleNumber === v && t.status === "open");
      return `
        <div class="click-card" onclick="App.goto({name:'vehicle', vehicle:${JSON.stringify(v)}})">
          <div class="plate">${esc(v)}</div>
          <div class="status ${open?'open':''}">${open ? "Trip in progress" : "No open trip"}</div>
        </div>`;
    }).join("") || `<p class="hint">No vehicles yet. Add one below to get started.</p>`;

    return `
      <div class="panel">
        <div class="panel-title">
          <h2>Fleet overview</h2>
          <span class="hint">${vehicles.length} vehicle(s)</span>
        </div>
        <div class="card-grid">${cards}</div>
      </div>
      <div class="road-divider"></div>
      <div class="field-row">
        <button class="secondary" onclick="App.goto({name:'vehicles'})">Manage vehicles</button>
        <button class="secondary" onclick="App.goto({name:'users'})">Manage users</button>
        <button class="secondary" onclick="App.goto({name:'settings'})">Company &amp; license settings</button>
      </div>
    `;
  },

  vehiclesMgmt(){
    const vehicles = DB.get(K.vehicles, []);
    const rows = vehicles.map(v => `
      <tr>
        <td class="mono">${esc(v)}</td>
        <td style="text-align:right">
          <button class="secondary small" onclick="Actions.removeVehicle(${JSON.stringify(v)})">Remove</button>
        </td>
      </tr>`).join("") || `<tr><td colspan="2" class="hint">No vehicles added yet.</td></tr>`;

    return `
      <button class="secondary small" onclick="App.goto({name:'adminHome'})">← Back to overview</button>
      <div class="panel" style="margin-top:14px;">
        <div class="panel-title"><h2>Vehicles</h2></div>
        <div class="field-row">
          <div class="field"><label for="newVehicleNo">Vehicle number</label><input id="newVehicleNo" placeholder="e.g. KA19AB1234"></div>
        </div>
        <button class="amber" onclick="Actions.addVehicle()">Add vehicle</button>
        <div class="road-divider"></div>
        <table><thead><tr><th>Vehicle</th><th></th></tr></thead><tbody>${rows}</tbody></table>
      </div>
    `;
  },

  usersMgmt(){
    const users = DB.get(K.users, []);
    const vehicles = DB.get(K.vehicles, []);
    const rows = users.map(u => `
      <tr>
        <td>${esc(u.username)}</td>
        <td><span class="role-pill" style="background:${u.role==='admin'?'var(--asphalt)':'var(--amber)'};color:${u.role==='admin'?'var(--paper)':'var(--asphalt)'}">${u.role}</span></td>
        <td class="mono">${u.vehicle ? esc(u.vehicle) : "—"}</td>
        <td style="text-align:right">
          ${users.length>1 ? `<button class="secondary small" onclick="Actions.removeUser(${JSON.stringify(u.id)})">Remove</button>` : `<span class="hint">Only admin</span>`}
        </td>
      </tr>`).join("");

    const vehicleOptions = vehicles.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join("");

    return `
      <button class="secondary small" onclick="App.goto({name:'adminHome'})">← Back to overview</button>
      <div class="panel" style="margin-top:14px;">
        <div class="panel-title"><h2>Users &amp; access</h2></div>
        <p class="hint">Admins can see every vehicle. A user account can only see the one vehicle it's assigned to.</p>
        <div class="field-row">
          <div class="field"><label for="nuName">Username</label><input id="nuName"></div>
          <div class="field"><label for="nuPass">Password</label><input id="nuPass" type="text"></div>
          <div class="field">
            <label for="nuRole">Role</label>
            <select id="nuRole" onchange="document.getElementById('nuVehicleField').classList.toggle('hidden', this.value!=='user')">
              <option value="user">User (one vehicle)</option>
              <option value="admin">Admin (all vehicles)</option>
            </select>
          </div>
          <div class="field" id="nuVehicleField">
            <label for="nuVehicle">Assigned vehicle</label>
            <select id="nuVehicle">${vehicleOptions || '<option value="">Add a vehicle first</option>'}</select>
          </div>
        </div>
        <button class="amber" onclick="Actions.addUser()">Add user</button>
        <div class="road-divider"></div>
        <table><thead><tr><th>Username</th><th>Role</th><th>Vehicle</th><th></th></tr></thead><tbody>${rows}</tbody></table>
      </div>
    `;
  },

  settings(){
    const company = DB.get(K.company);
    const lic = DB.get(K.license);
    const check = LicenseKit.validate(lic.key, CID);
    return `
      <button class="secondary small" onclick="App.goto({name:'adminHome'})">← Back to overview</button>

      <div class="panel" style="margin-top:14px;">
        <div class="panel-title"><h2>Company details</h2></div>
        <p class="hint">This name and contact info appear on every trip report.</p>
        <div class="field"><label for="stName">Company name</label><input id="stName" value="${esc(company.name)}"></div>
        <div class="field-row">
          <div class="field"><label for="stMobile">Mobile number</label><input id="stMobile" value="${esc(company.mobile)}"></div>
          <div class="field"><label for="stEmail">Company email</label><input id="stEmail" value="${esc(company.email)}"></div>
        </div>
        <button class="amber" onclick="Actions.saveCompany()">Save company details</button>
      </div>

      <div class="panel accent-amber">
        <div class="panel-title"><h2>License</h2></div>
        <p>Status: <strong style="color:${check.valid?'var(--green)':'var(--red)'}">${check.valid ? `Active — valid until ${check.expiry}` : "Invalid / expired"}</strong></p>
        <div class="field"><label for="renewKey">Enter renewal key from developer</label><input id="renewKey" placeholder="TRK-XXXX-YYYYMMDD-XXXXX"></div>
        <button onclick="Actions.renewLicense()">Apply renewal key</button>
      </div>
    `;
  },

  vehicleDashboard(vehicle){
    if(!vehicle){
      return `<div class="panel"><p>No vehicle is assigned to your account yet. Ask your admin to assign one.</p></div>`;
    }
    const isAdmin = App.currentUser.role === "admin";
    const backBtn = isAdmin ? `<button class="secondary small" onclick="App.goto({name:'adminHome'})">← Back to overview</button>` : "";
    const trips = Trips.byVehicle(vehicle);
    const open = trips.find(t => t.status === "open");
    const closed = trips.filter(t => t.status === "closed");

    let openSection;
    if(open){
      openSection = Views.openTripPanel(open);
    } else if(trips.length === 0){
      openSection = Views.firstTripForm(vehicle);
    } else {
      openSection = `<div class="panel"><p>No open trip. This shouldn't normally happen — every closed trip should start the next one automatically.</p></div>`;
    }

    const historyRows = closed.map(t => `
      <tr>
        <td>${esc(t.loadingLocation)} → ${esc(t.unloadingLocation||'—')}</td>
        <td>${new Date(t.createdAt).toLocaleDateString()}</td>
        <td class="mono">${t.calc ? fmtNum(t.calc.km,0) : "—"}</td>
        <td class="mono">${t.calc ? fmtNum(t.calc.mileage) : "—"}</td>
        <td class="mono ${t.calc && t.calc.balance<0 ? 'negative' : ''}">${t.calc ? fmtMoney(t.calc.balance) : "—"}</td>
        <td style="text-align:right"><button class="secondary small" onclick="App.goto({name:'report', tripId:${JSON.stringify(t.id)}})">Report</button></td>
      </tr>`).join("") || `<tr><td colspan="6" class="hint">No completed trips yet.</td></tr>`;

    return `
      ${backBtn}
      <h2 class="headline" style="font-size:1.8rem;margin:14px 0 4px;">Vehicle <span class="mono">${esc(vehicle)}</span></h2>
      ${openSection}
      <div class="road-divider"></div>
      <div class="panel">
        <div class="panel-title"><h2>Trip history</h2></div>
        <table>
          <thead><tr><th>Route</th><th>Started</th><th>KM</th><th>Mileage</th><th>Balance</th><th></th></tr></thead>
          <tbody>${historyRows}</tbody>
        </table>
      </div>
    `;
  },

  firstTripForm(vehicle){
    return `
      <div class="panel accent-amber">
        <div class="panel-title"><h2>Start the first trip</h2><span class="hint">One-time setup for this vehicle</span></div>
        <p class="hint">Enter the diesel fill taken at the loading point before departure — this sets the starting odometer reading for mileage tracking.</p>
        <div class="field-row">
          <div class="field"><label for="ft_vol">Diesel volume (L)</label><input id="ft_vol" type="number" step="0.01"></div>
          <div class="field"><label for="ft_rate">Rate (₹/L)</label><input id="ft_rate" type="number" step="0.01"></div>
          <div class="field"><label for="ft_km">Odometer (km)</label><input id="ft_km" type="number" step="1"></div>
        </div>
        <div class="field-row">
          <div class="field"><label for="ft_date">Fill date</label><input id="ft_date" type="date" value="${todayStr()}"></div>
          <div class="field"><label for="ft_photo">Photo (optional)</label><input id="ft_photo" type="file" accept="image/*" capture="environment"></div>
        </div>
        <div class="road-divider"></div>
        <div class="field-row">
          <div class="field"><label for="ft_advance">Driver advance (₹)</label><input id="ft_advance" type="number" step="0.01"></div>
          <div class="field"><label for="ft_advance_date">Advance date</label><input id="ft_advance_date" type="date" value="${todayStr()}"></div>
        </div>
        <div class="field-row">
          <div class="field">
            <label for="ft_loading">Loading location</label>
            <select id="ft_loading">${APP_CONFIG.LOADING_LOCATIONS.map(l=>`<option>${esc(l)}</option>`).join("")}</select>
          </div>
          <div class="field"><label for="ft_loadexp">Loading expense — cleaner (₹)</label><input id="ft_loadexp" type="number" step="0.01" value="0"></div>
        </div>
        <button class="amber" onclick="Actions.startFirstTrip(${JSON.stringify(vehicle)})">Start trip</button>
      </div>
    `;
  },

  openTripPanel(trip){
    const c = calcTrip(trip);
    const dieselRows = trip.dieselEntries.map(d => `
      <div class="entry-card">
        ${d.photo ? `<img class="thumb" src="${d.photo}">` : ""}
        <div class="meta">
          <span class="odometer">${fmtNum(d.volume)} L</span> @ ₹${fmtNum(d.rate)}/L
          ${d.km ? ` · odo ${fmtNum(d.km,0)}` : ""} · ${esc(d.date)}
        </div>
        <button class="danger small" onclick="Actions.removeDiesel(${JSON.stringify(trip.id)}, ${JSON.stringify(d.id)})">Remove</button>
      </div>`).join("") || `<p class="hint">No interim diesel fills logged yet.</p>`;

    const rtoRows = trip.rtoEntries.map(r => `
      <div class="entry-card">
        ${r.photo ? `<img class="thumb" src="${r.photo}">` : ""}
        <div class="meta">
          ${fmtMoney(r.amount)} · ${esc(r.date)}
          ${r.gps ? ` · <a class="gps-link" target="_blank" href="https://www.google.com/maps?q=${r.gps.lat},${r.gps.lng}">GPS ↗</a>` : `<span class="hint"> · no GPS</span>`}
        </div>
        <button class="danger small" onclick="Actions.removeRto(${JSON.stringify(trip.id)}, ${JSON.stringify(r.id)})">Remove</button>
      </div>`).join("") || `<p class="hint">No RTO entries yet.</p>`;

    const otherRows = trip.otherExpenses.map(o => `
      <div class="entry-card">
        ${o.photo ? `<img class="thumb" src="${o.photo}">` : ""}
        <div class="meta">${fmtMoney(o.amount)} · ${esc(o.date)} ${o.note ? " · "+esc(o.note) : ""}</div>
        <button class="danger small" onclick="Actions.removeOther(${JSON.stringify(trip.id)}, ${JSON.stringify(o.id)})">Remove</button>
      </div>`).join("") || `<p class="hint">No other expenses yet.</p>`;

    return `
    <div class="panel accent-green">
      <div class="panel-title"><h2>Trip in progress</h2><span class="hint">Started ${new Date(trip.createdAt).toLocaleDateString()}</span></div>

      <div class="stat-grid">
        <div class="stat"><div class="label">Driver advance</div><div class="value">${fmtMoney(trip.driverAdvance)}</div></div>
        <div class="stat"><div class="label">Expenses so far</div><div class="value">${fmtMoney(c.totalExpenseExclDiesel)}</div></div>
        <div class="stat"><div class="label">Running balance</div><div class="value ${c.balance<0?'negative':'positive'}">${fmtMoney(c.balance)}</div></div>
      </div>

      <table>
        <tbody>
          <tr><th>Loading location</th><td>${esc(trip.loadingLocation)}</td></tr>
          <tr><th>Loading expense (cleaner)</th><td>${fmtMoney(trip.loadingExpense)}</td></tr>
          <tr><th>Opening fill</th><td class="mono">${fmtNum(trip.openingFill.volume)} L @ ₹${fmtNum(trip.openingFill.rate)} · odo ${fmtNum(trip.openingFill.odometer,0)} km (${esc(trip.openingFill.date)})</td></tr>
        </tbody>
      </table>

      <div class="road-divider"></div>
      <h3>Diesel fills during trip</h3>
      ${dieselRows}
      <details><summary style="cursor:pointer;color:var(--ink-soft);font-size:.85rem;">Add a diesel fill</summary>
        <div class="field-row" style="margin-top:10px;">
          <div class="field"><label>Volume (L)</label><input id="d_vol_${trip.id}" type="number" step="0.01"></div>
          <div class="field"><label>Rate (₹/L)</label><input id="d_rate_${trip.id}" type="number" step="0.01"></div>
          <div class="field"><label>Odometer (optional, km)</label><input id="d_km_${trip.id}" type="number" step="1"></div>
        </div>
        <div class="field-row">
          <div class="field"><label>Date</label><input id="d_date_${trip.id}" type="date" value="${todayStr()}"></div>
          <div class="field"><label>Photo (optional)</label><input id="d_photo_${trip.id}" type="file" accept="image/*" capture="environment"></div>
        </div>
        <button class="secondary" onclick="Actions.addDiesel(${JSON.stringify(trip.id)})">Add fill</button>
      </details>

      <div class="road-divider"></div>
      <h3>RTO entries</h3>
      ${rtoRows}
      <details><summary style="cursor:pointer;color:var(--ink-soft);font-size:.85rem;">Add an RTO entry</summary>
        <div class="field-row" style="margin-top:10px;">
          <div class="field"><label>Amount (₹)</label><input id="r_amt_${trip.id}" type="number" step="0.01"></div>
          <div class="field"><label>Date</label><input id="r_date_${trip.id}" type="date" value="${todayStr()}"></div>
          <div class="field"><label>Photo (optional)</label><input id="r_photo_${trip.id}" type="file" accept="image/*" capture="environment"></div>
        </div>
        <button class="secondary" onclick="Actions.addRto(${JSON.stringify(trip.id)})">Capture GPS &amp; add entry</button>
      </details>

      <div class="road-divider"></div>
      <h3>Unloading</h3>
      ${trip.unloadingLocation ? `
        <table><tbody>
          <tr><th>Unloading location</th><td>${esc(trip.unloadingLocation)}</td></tr>
          <tr><th>Unloading expense (cleaner)</th><td>${fmtMoney(trip.unloadingExpense)}</td></tr>
        </tbody></table>
      ` : `
        <div class="field-row">
          <div class="field">
            <label>Unloading location</label>
            <select id="u_loc_${trip.id}">${APP_CONFIG.UNLOADING_LOCATIONS.map(l=>`<option>${esc(l)}</option>`).join("")}</select>
          </div>
          <div class="field"><label>Unloading expense — cleaner (₹)</label><input id="u_exp_${trip.id}" type="number" step="0.01" value="0"></div>
        </div>
        <button class="secondary" onclick="Actions.setUnloading(${JSON.stringify(trip.id)})">Save unloading details</button>
      `}

      <div class="road-divider"></div>
      <h3>Other expenses</h3>
      ${otherRows}
      <details><summary style="cursor:pointer;color:var(--ink-soft);font-size:.85rem;">Add another expense</summary>
        <div class="field-row" style="margin-top:10px;">
          <div class="field"><label>Amount (₹)</label><input id="o_amt_${trip.id}" type="number" step="0.01"></div>
          <div class="field"><label>Date</label><input id="o_date_${trip.id}" type="date" value="${todayStr()}"></div>
          <div class="field"><label>Note (optional)</label><input id="o_note_${trip.id}"></div>
          <div class="field"><label>Photo (optional)</label><input id="o_photo_${trip.id}" type="file" accept="image/*" capture="environment"></div>
        </div>
        <button class="secondary" onclick="Actions.addOther(${JSON.stringify(trip.id)})">Add expense</button>
      </details>

      <div class="road-divider"></div>
      <h3>Close this trip</h3>
      <p class="hint">Closing happens when diesel is filled again at the loading location for the next trip. The 1st fill of this trip is excluded from the diesel/mileage math; this closing fill plus any interim fills are summed instead.</p>
      <div class="field-row">
        <div class="field"><label>Closing fill volume (L)</label><input id="c_vol_${trip.id}" type="number" step="0.01"></div>
        <div class="field"><label>Rate (₹/L)</label><input id="c_rate_${trip.id}" type="number" step="0.01"></div>
        <div class="field"><label>Odometer (km)</label><input id="c_km_${trip.id}" type="number" step="1"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Fill date</label><input id="c_date_${trip.id}" type="date" value="${todayStr()}"></div>
        <div class="field"><label>Photo (optional)</label><input id="c_photo_${trip.id}" type="file" accept="image/*" capture="environment"></div>
      </div>
      <p class="hint">This same fill starts the next trip — enter its details below.</p>
      <div class="field-row">
        <div class="field"><label>Next driver advance (₹)</label><input id="n_adv_${trip.id}" type="number" step="0.01"></div>
        <div class="field"><label>Advance date</label><input id="n_advdate_${trip.id}" type="date" value="${todayStr()}"></div>
      </div>
      <div class="field-row">
        <div class="field">
          <label>Next loading location</label>
          <select id="n_loc_${trip.id}">${APP_CONFIG.LOADING_LOCATIONS.map(l=>`<option ${l===trip.loadingLocation?'selected':''}>${esc(l)}</option>`).join("")}</select>
        </div>
        <div class="field"><label>Next loading expense — cleaner (₹)</label><input id="n_loadexp_${trip.id}" type="number" step="0.01" value="0"></div>
      </div>
      <button class="amber full" onclick="Actions.closeTrip(${JSON.stringify(trip.id)})">Close trip &amp; start next</button>
    </div>
    `;
  },

  report(tripId){
    const trip = Trips.get(tripId);
    if(!trip) return `<p>Report not found.</p>`;
    const c = trip.calc || calcTrip(trip);
    const company = DB.get(K.company);

    const dieselRows = [
      `<tr><td>Opening fill (excluded from usage)</td><td class="mono">${fmtNum(trip.openingFill.volume)} L</td><td class="mono">₹${fmtNum(trip.openingFill.rate)}</td><td class="mono">${fmtNum(trip.openingFill.odometer,0)}</td><td>${esc(trip.openingFill.date)}</td></tr>`,
      ...trip.dieselEntries.map(d=>`<tr><td>Interim fill</td><td class="mono">${fmtNum(d.volume)} L</td><td class="mono">₹${fmtNum(d.rate)}</td><td class="mono">${d.km?fmtNum(d.km,0):"—"}</td><td>${esc(d.date)}</td></tr>`),
      trip.closingFill ? `<tr><td>Closing fill (next trip's opening)</td><td class="mono">${fmtNum(trip.closingFill.volume)} L</td><td class="mono">₹${fmtNum(trip.closingFill.rate)}</td><td class="mono">${fmtNum(trip.closingFill.odometer,0)}</td><td>${esc(trip.closingFill.date)}</td></tr>` : ""
    ].join("");

    const rtoRows = trip.rtoEntries.map(r=>`<tr><td>${esc(r.date)}</td><td class="mono">${fmtMoney(r.amount)}</td><td>${r.gps?`${r.gps.lat.toFixed(5)}, ${r.gps.lng.toFixed(5)}`:"—"}</td></tr>`).join("") || `<tr><td colspan="3" class="hint">None</td></tr>`;
    const otherRows = trip.otherExpenses.map(o=>`<tr><td>${esc(o.date)}</td><td class="mono">${fmtMoney(o.amount)}</td><td>${esc(o.note||"")}</td></tr>`).join("") || `<tr><td colspan="3" class="hint">None</td></tr>`;

    const emailBody = encodeURIComponent(
`Trip report — ${company.name}
Vehicle: ${trip.vehicleNumber}
Route: ${trip.loadingLocation} to ${trip.unloadingLocation||"-"}
Driver advance: ${fmtMoney(trip.driverAdvance)} (${trip.driverAdvanceDate})

Distance: ${c.km!==null?fmtNum(c.km,0):"-"} km
Diesel used: ${fmtNum(c.dieselUsedLtr)} L
Diesel cost: ${fmtMoney(c.dieselCost)}
Mileage: ${c.mileage!==null?fmtNum(c.mileage):"-"} km/L

Loading expense: ${fmtMoney(trip.loadingExpense)}
Unloading expense: ${fmtMoney(trip.unloadingExpense)}
RTO total: ${fmtMoney(c.rtoTotal)}
Other expenses: ${fmtMoney(c.otherTotal)}
Total expense (excl. diesel): ${fmtMoney(c.totalExpenseExclDiesel)}
Balance (advance - expenses): ${fmtMoney(c.balance)}

(Photos are stored in the app and are not included in this email. Use "Print / Save PDF" for a document with full detail, and attach it manually if needed.)`
    );
    const mailto = `mailto:${encodeURIComponent(company.email)}?subject=${encodeURIComponent(`Trip report — ${trip.vehicleNumber} — ${trip.loadingLocation} to ${trip.unloadingLocation||''}`)}&body=${emailBody}`;

    return `
      <div class="no-print" style="margin-bottom:14px;display:flex;gap:10px;flex-wrap:wrap;">
        <button class="secondary" onclick="App.goto({name:'vehicle', vehicle:${JSON.stringify(trip.vehicleNumber)}})">← Back to vehicle</button>
        <button class="amber" onclick="window.print()">Print / Save PDF</button>
        <a class="btn secondary" style="text-decoration:none;display:inline-flex;align-items:center;" href="${mailto}">Email to company address</a>
      </div>

      <div class="report panel">
        <h1>${esc(company.name)}</h1>
        <div class="report-meta">
          ${esc(company.mobile)} · ${esc(company.email)}<br>
          Vehicle <strong>${esc(trip.vehicleNumber)}</strong> · ${esc(trip.loadingLocation)} → ${esc(trip.unloadingLocation||"—")}
          · Trip started ${new Date(trip.createdAt).toLocaleDateString()}
        </div>

        <h3>Driver advance</h3>
        <table><tbody><tr><th>Amount</th><td>${fmtMoney(trip.driverAdvance)}</td><th>Date</th><td>${esc(trip.driverAdvanceDate)}</td></tr></tbody></table>

        <h3>Diesel fills</h3>
        <table>
          <thead><tr><th>Type</th><th>Volume</th><th>Rate</th><th>Odometer</th><th>Date</th></tr></thead>
          <tbody>${dieselRows}</tbody>
        </table>

        <h3>RTO entries</h3>
        <table><thead><tr><th>Date</th><th>Amount</th><th>GPS</th></tr></thead><tbody>${rtoRows}</tbody></table>

        <h3>Other expenses</h3>
        <table><thead><tr><th>Date</th><th>Amount</th><th>Note</th></tr></thead><tbody>${otherRows}</tbody></table>

        <div class="totals-box">
          <div><span>Distance covered</span><span class="mono">${c.km!==null?fmtNum(c.km,0)+" km":"—"}</span></div>
          <div><span>Diesel used (excl. opening fill)</span><span class="mono">${fmtNum(c.dieselUsedLtr)} L</span></div>
          <div><span>Diesel cost</span><span class="mono">${fmtMoney(c.dieselCost)}</span></div>
          <div><span>Mileage</span><span class="mono">${c.mileage!==null?fmtNum(c.mileage)+" km/L":"—"}</span></div>
          <div><span>Loading expense</span><span class="mono">${fmtMoney(trip.loadingExpense)}</span></div>
          <div><span>Unloading expense</span><span class="mono">${fmtMoney(trip.unloadingExpense)}</span></div>
          <div><span>RTO total</span><span class="mono">${fmtMoney(c.rtoTotal)}</span></div>
          <div><span>Other expenses</span><span class="mono">${fmtMoney(c.otherTotal)}</span></div>
          <div><span>Total expense (excl. diesel)</span><span class="mono">${fmtMoney(c.totalExpenseExclDiesel)}</span></div>
          <div class="grand"><span>Balance (advance − expenses)</span><span class="mono">${fmtMoney(c.balance)}</span></div>
        </div>
      </div>
    `;
  }
};

/* ---------------------------------------------------------------------------
   ACTIONS — mutate data, then re-render
--------------------------------------------------------------------------- */
const Actions = {
  saveCompany(){
    DB.set(K.company, {
      name: document.getElementById("stName").value.trim() || "Company",
      mobile: document.getElementById("stMobile").value.trim(),
      email: document.getElementById("stEmail").value.trim()
    });
    document.getElementById("hdrCompanyName").textContent = DB.get(K.company).name;
    App.render();
  },

  renewLicense(){
    const key = document.getElementById("renewKey").value.trim();
    const check = LicenseKit.validate(key, CID);
    if(!check.valid){ alert(check.reason || "Invalid key."); return; }
    DB.set(K.license, { key, expiry: check.expiry });
    document.getElementById("hdrLicenseNote").textContent = `License valid until ${check.expiry}`;
    App.render();
  },

  addVehicle(){
    const val = document.getElementById("newVehicleNo").value.trim().toUpperCase();
    if(!val) return;
    const vehicles = DB.get(K.vehicles, []);
    if(vehicles.includes(val)){ alert("That vehicle is already added."); return; }
    vehicles.push(val);
    DB.set(K.vehicles, vehicles);
    App.render();
  },
  removeVehicle(v){
    if(!confirm(`Remove vehicle ${v}? Its trip history is kept but it can no longer be assigned.`)) return;
    DB.set(K.vehicles, DB.get(K.vehicles, []).filter(x=>x!==v));
    App.render();
  },

  addUser(){
    const username = document.getElementById("nuName").value.trim();
    const password = document.getElementById("nuPass").value;
    const role = document.getElementById("nuRole").value;
    const vehicle = role === "user" ? document.getElementById("nuVehicle").value : null;
    if(!username || !password){ alert("Enter a username and password."); return; }
    if(role === "user" && !vehicle){ alert("Add a vehicle first, then assign it to this user."); return; }
    const users = DB.get(K.users, []);
    if(users.some(u=>u.username.toLowerCase()===username.toLowerCase())){ alert("That username is taken."); return; }
    users.push({ id: uid("usr"), username, password, role, vehicle });
    DB.set(K.users, users);
    App.render();
  },
  removeUser(id){
    if(!confirm("Remove this user account?")) return;
    DB.set(K.users, DB.get(K.users, []).filter(u=>u.id!==id));
    App.render();
  },

  async startFirstTrip(vehicle){
    const vol = document.getElementById("ft_vol").value;
    const rate = document.getElementById("ft_rate").value;
    const km = document.getElementById("ft_km").value;
    const date = document.getElementById("ft_date").value;
    if(!vol || !rate || !km || !date){ alert("Fill in the opening diesel fill (volume, rate, odometer, date)."); return; }
    const file = document.getElementById("ft_photo").files[0];
    const photo = file ? await compressImage(file) : null;
    Trips.startFirstTrip(
      vehicle,
      { volume:+vol, rate:+rate, odometer:+km, date, photo },
      document.getElementById("ft_advance").value,
      document.getElementById("ft_advance_date").value,
      document.getElementById("ft_loading").value,
      document.getElementById("ft_loadexp").value
    );
    App.render();
  },

  async addDiesel(tripId){
    const vol = document.getElementById(`d_vol_${tripId}`).value;
    const rate = document.getElementById(`d_rate_${tripId}`).value;
    if(!vol || !rate){ alert("Enter volume and rate."); return; }
    const km = document.getElementById(`d_km_${tripId}`).value;
    const date = document.getElementById(`d_date_${tripId}`).value || todayStr();
    const file = document.getElementById(`d_photo_${tripId}`).files[0];
    const photo = file ? await compressImage(file) : null;
    Trips.update(tripId, t => t.dieselEntries.push({ id: uid("d"), volume:+vol, rate:+rate, km: km?+km:null, date, photo }));
    App.render();
  },
  removeDiesel(tripId, id){
    Trips.update(tripId, t => t.dieselEntries = t.dieselEntries.filter(d=>d.id!==id));
    App.render();
  },

  async addRto(tripId){
    const amt = document.getElementById(`r_amt_${tripId}`).value;
    if(!amt){ alert("Enter an amount."); return; }
    const date = document.getElementById(`r_date_${tripId}`).value || todayStr();
    const file = document.getElementById(`r_photo_${tripId}`).files[0];
    const [photo, gps] = await Promise.all([
      file ? compressImage(file) : Promise.resolve(null),
      captureGPS()
    ]);
    if(!gps) alert("Could not get GPS location (permission denied or unavailable) — entry saved without it.");
    Trips.update(tripId, t => t.rtoEntries.push({ id: uid("r"), amount:+amt, date, photo, gps }));
    App.render();
  },
  removeRto(tripId, id){
    Trips.update(tripId, t => t.rtoEntries = t.rtoEntries.filter(r=>r.id!==id));
    App.render();
  },

  setUnloading(tripId){
    const loc = document.getElementById(`u_loc_${tripId}`).value;
    const exp = document.getElementById(`u_exp_${tripId}`).value || 0;
    Trips.update(tripId, t => { t.unloadingLocation = loc; t.unloadingExpense = +exp; });
    App.render();
  },

  async addOther(tripId){
    const amt = document.getElementById(`o_amt_${tripId}`).value;
    if(!amt){ alert("Enter an amount."); return; }
    const date = document.getElementById(`o_date_${tripId}`).value || todayStr();
    const note = document.getElementById(`o_note_${tripId}`).value.trim();
    const file = document.getElementById(`o_photo_${tripId}`).files[0];
    const photo = file ? await compressImage(file) : null;
    Trips.update(tripId, t => t.otherExpenses.push({ id: uid("o"), amount:+amt, date, note, photo }));
    App.render();
  },
  removeOther(tripId, id){
    Trips.update(tripId, t => t.otherExpenses = t.otherExpenses.filter(o=>o.id!==id));
    App.render();
  },

  async closeTrip(tripId){
    const trip = Trips.get(tripId);
    if(!trip.unloadingLocation){ alert("Save the unloading details before closing this trip."); return; }
    const vol = document.getElementById(`c_vol_${tripId}`).value;
    const rate = document.getElementById(`c_rate_${tripId}`).value;
    const km = document.getElementById(`c_km_${tripId}`).value;
    const date = document.getElementById(`c_date_${tripId}`).value;
    if(!vol || !rate || !km || !date){ alert("Enter the closing diesel fill (volume, rate, odometer, date)."); return; }
    if(+km <= trip.openingFill.odometer){ alert("Closing odometer must be greater than this trip's opening odometer."); return; }
    const advance = document.getElementById(`n_adv_${tripId}`).value;
    const advanceDate = document.getElementById(`n_advdate_${tripId}`).value;
    const loc = document.getElementById(`n_loc_${tripId}`).value;
    const loadexp = document.getElementById(`n_loadexp_${tripId}`).value || 0;
    const file = document.getElementById(`c_photo_${tripId}`).files[0];
    const photo = file ? await compressImage(file) : null;

    Trips.closeAndStartNext(
      tripId,
      { volume:+vol, rate:+rate, odometer:+km, date, photo },
      advance, advanceDate, loc, loadexp
    );
    App.render();
  }
};

/* ---------------------------------------------------------------------------
   Boot
--------------------------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => App.boot());
