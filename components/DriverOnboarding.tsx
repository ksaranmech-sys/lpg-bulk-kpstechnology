// @ts-nocheck
import { useEffect, useState } from "react";

export default function DriverOnboarding() {
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({ customerId: "", name: "", mobileNumber: "", licenseNumber: "", username: "", password: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { fetch("/api/customers").then((response) => response.json()).then(setCustomers).catch(() => setError("Could not load customers")); }, []);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/drivers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not onboard driver");
      setMessage(`Driver ${result.name} onboarded. Credentials are ready.`);
      setForm({ customerId: "", name: "", mobileNumber: "", licenseNumber: "", username: "", password: "" });
    } catch (submitError) { setError(submitError.message); } finally { setBusy(false); }
  }
  return <div className="panel"><div className="panel-heading"><div><h2>Onboard driver</h2><p>Create customer-level driver credentials.</p></div></div>{error && <div className="notice notice-error">{error}</div>}{message && <div className="notice notice-success">{message}</div>}<form onSubmit={submit} className="form-grid"><div className="field field-full"><label>Customer fleet</label><select required value={form.customerId} onChange={(event) => setForm({ ...form, customerId: event.target.value })}><option value="">Select customer</option>{customers.map((customer) => <option key={customer._id} value={customer._id}>{customer.name}</option>)}</select></div><div className="field"><label>Driver name</label><input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div><div className="field"><label>Mobile number</label><input required value={form.mobileNumber} onChange={(event) => setForm({ ...form, mobileNumber: event.target.value })} /></div><div className="field"><label>License number</label><input value={form.licenseNumber} onChange={(event) => setForm({ ...form, licenseNumber: event.target.value })} /></div><div className="field"><label>Driver username</label><input required value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} /></div><div className="field"><label>Driver password</label><input required type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></div><button className="button button-primary field-full" disabled={busy}>Create driver credentials</button></form></div>;
}
