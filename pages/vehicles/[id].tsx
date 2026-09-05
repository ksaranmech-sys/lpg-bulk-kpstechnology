// @ts-nocheck
import { useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/router";
import TripHistory from "../../components/TripHistory";

const loadingLocations = ["MRPL", "Total-Mangalore", "AEGIS-Mangalore", "IPPL-Chennai", "CPCL", "Tuthugudi", "KRL"];
const documentFields = [["qTax", "Q-Tax"], ["fitness", "Fitness"], ["permit1Year", "1 Year Permit"], ["permit5Year", "5 Year Permit"], ["purging", "Purging"], ["explosive", "Explosive"], ["pli", "PLI"], ["insurance", "Insurance"], ["hydroCertificate", "Hydro certificate"]];
const today = () => new Date().toISOString().slice(0, 10);

export default function VehicleDetails() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [vehicle, setVehicle] = useState(null), [trips, setTrips] = useState([]), [drivers, setDrivers] = useState([]), [selectedDriver, setSelectedDriver] = useState("");
  const [error, setError] = useState(""), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  const role = session?.user?.role;
  const canManage = role === "admin" || role === "superadmin";

  async function load() {
    const vehicleResponse = await fetch(`/api/vehicles/${router.query.id}`);
    const tripsResponse = await fetch(`/api/trips?vehicleId=${router.query.id}`);
    if (!vehicleResponse.ok || !tripsResponse.ok) throw new Error("Could not load vehicle details");
    const nextVehicle = await vehicleResponse.json();
    const nextTrips = await tripsResponse.json();
    const driverResponse = await fetch(`/api/drivers?customerId=${nextVehicle.customerId}`);
    if (!driverResponse.ok) throw new Error("Could not load fleet drivers");
    const nextDrivers = await driverResponse.json();
    setVehicle(nextVehicle); setTrips(nextTrips); setDrivers(nextDrivers);
    setSelectedDriver((current) => current || nextTrips.find((trip) => trip.driverId)?.driverId?._id || nextDrivers[0]?._id || "");
  }
  useEffect(() => { if (status === "authenticated" && router.query.id) load().catch((loadError) => setError(loadError.message)); }, [status, router.query.id]);

  async function post(url, body, success) {
    setBusy(true); setError(""); setMessage("");
    try { const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Request failed"); setMessage(success); await load(); return result; }
    catch (requestError) { setError(requestError.message); return null; } finally { setBusy(false); }
  }
  async function startTrip(event) { event.preventDefault(); const form = new FormData(event.currentTarget); const result = await post("/api/trips", { vehicleId: vehicle._id, driverId: selectedDriver || undefined, driverAdvance: { amount: Number(form.get("advance")), date: form.get("advanceDate") }, loadingLocation: form.get("loadingLocation"), loadingExpense: Number(form.get("loadingExpense") || 0), firstDieselFill: { volume: Number(form.get("firstVolume")), rate: Number(form.get("firstRate")), odometerKm: form.get("firstKm") ? Number(form.get("firstKm")) : undefined, date: form.get("firstDate") } }, "Trip started with assigned driver."); if (result) event.currentTarget.reset(); }
  async function saveDocuments(event) { event.preventDefault(); const form = new FormData(event.currentTarget); const documents = {}; documentFields.forEach(([key]) => { documents[key] = { expiryDate: form.get(key) || null }; }); setBusy(true); setError(""); setMessage(""); try { const response = await fetch(`/api/vehicles/${vehicle._id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documents }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Could not save documents"); setVehicle(result); setMessage("Document readiness dates saved."); } catch (saveError) { setError(saveError.message); } finally { setBusy(false); } }

  if (status === "loading") return <div className="page"><p className="empty">Loading vehicle...</p></div>;
  if (!vehicle) return <div className="page"><p className="empty">{error || "Vehicle not found."}</p></div>;
  const openTrip = trips.some((trip) => trip.status === "open");

  return <div className="shell"><Header session={session} /><main className="page"><div className="page-heading"><div><button className="button button-secondary button-small" onClick={() => router.push("/dashboard")}>Back to fleet</button><div className="eyebrow" style={{ marginTop: 20 }}>Vehicle detail</div><h1>{vehicle.vehicleNumber}</h1><p>Manage trip records and document readiness for this vehicle.</p></div></div>{error && <div className="notice notice-error">{error}</div>}{message && <div className="notice notice-success">{message}</div>}<div className="workspace"><section>{!openTrip && canManage && <div className="panel"><div className="panel-heading"><div><h2>Start trip</h2><p>Select an onboarded driver. The last used driver is selected by default.</p></div></div><form onSubmit={startTrip} className="form-grid"><Field label="Trip driver"><select value={selectedDriver} onChange={(event) => setSelectedDriver(event.target.value)}><option value="">No driver selected</option>{drivers.map((driver) => <option key={driver._id} value={driver._id}>{driver.name}  -  {driver.mobileNumber}</option>)}</select></Field><Field label="Driver advance (Rs)"><input required name="advance" type="number" min="0" step="0.01" /></Field><Field label="Advance date"><input required name="advanceDate" type="date" defaultValue={today()} /></Field><Field label="Loading location"><select required name="loadingLocation"><option value="">Select location</option>{loadingLocations.map((location) => <option key={location}>{location}</option>)}</select></Field><Field label="Loading cleaner expense"><input name="loadingExpense" type="number" min="0" step="0.01" defaultValue="0" /></Field><Field label="Opening diesel volume (L)"><input required name="firstVolume" type="number" min="0" step="0.01" /></Field><Field label="Opening diesel rate"><input required name="firstRate" type="number" min="0" step="0.01" /></Field><Field label="Opening odometer (optional)"><input name="firstKm" type="number" min="0" /></Field><Field label="Opening fill date"><input required name="firstDate" type="date" defaultValue={today()} /></Field><button className="button button-primary field-full" disabled={busy}>Start trip</button></form></div>}{openTrip && <div className="panel"><div className="panel-heading"><div><h2>Trip in progress</h2><p>Continue this trip from the driver or operations portal.</p></div><span className="status status-open">Open</span></div></div>}<div className="panel"><div className="panel-heading"><div><h2>Trip history</h2><p>{trips.length} recorded trips</p></div></div>{trips.length ? <div className="entry-list">{trips.map((trip) => <div className="entry" key={trip._id}><span><strong>{trip.driverId?.name || "No driver recorded"}</strong><br /><small>{trip.loadingLocation}{trip.unloadingLocation ? ` to ${trip.unloadingLocation}` : "  -  In progress"}  -  {new Date(trip.createdAt).toLocaleDateString("en-IN")}</small></span><span className={`status ${trip.status === "open" ? "status-open" : "status-closed"}`}>{trip.status}</span></div>)}</div> : <p className="empty">No trips recorded for this vehicle.</p>}</div><div className="panel"><div className="panel-heading"><div><h2>Complete trip details</h2><p>Expand a trip to inspect every recorded amount and calculation.</p></div></div><TripHistory trips={trips} /></div></section><aside><div className="panel"><div className="panel-heading"><div><h2>Document readiness</h2><p>Customers maintain dates here. Reminder rules run automatically.</p></div></div><form onSubmit={saveDocuments} className="document-grid">{documentFields.map(([key, label]) => <div className="document-item" key={key}><label>{label}</label><input name={key} type="date" disabled={!canManage} defaultValue={vehicle.documents?.[key]?.expiryDate ? new Date(vehicle.documents[key].expiryDate).toISOString().slice(0, 10) : ""} /></div>)}{canManage && <button className="button button-secondary field-full" disabled={busy}>Save document dates</button>}</form></div><div className="panel"><div className="panel-heading"><div><h2>Fleet drivers</h2><p>Available for assignment on any trip.</p></div></div>{drivers.length ? <div className="entry-list">{drivers.map((driver) => <div className="entry" key={driver._id}><span><strong>{driver.name}</strong><br /><small>{driver.mobileNumber}{driver.licenseNumber ? `  -  ${driver.licenseNumber}` : ""}</small></span></div>)}</div> : <p className="empty">No drivers onboarded yet.</p>}</div></aside></div></main></div>;
}

function Header({ session }) { return <header className="topbar"><div className="brand"><span className="brand-mark">K</span><div><div className="brand-name">KPS Technology</div><div className="brand-caption">Fleet operations</div></div></div><div className="topbar-actions"><span className="user-chip">{session.user.username}  -  {session.user.role}</span><button className="button button-secondary button-small" onClick={() => signOut({ callbackUrl: "/login" })}>Sign out</button></div></header>; }
function Field({ label, children }) { return <div className="field"><label>{label}</label>{children}</div>; }
