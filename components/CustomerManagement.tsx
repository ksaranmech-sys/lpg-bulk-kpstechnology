import { useEffect, useState } from "react";

export default function CustomerManagement() {
  const [customers, setCustomers] = useState([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  async function loadCustomers() {
    const response = await fetch("/api/customers");
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not load customers");
    setCustomers(result);
  }

  useEffect(() => { loadCustomers().catch((loadError) => setError(loadError.message)); }, []);

  async function updateCustomer(customer, method, body) {
    setBusyId(customer._id);
    setError("");
    try {
      if (method === "DELETE" && !window.confirm(`Delete ${customer.name} and all of its fleet records?`)) return;
      const response = await fetch("/api/customers", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: customer._id, ...body }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Customer update failed");
      if (method === "PATCH" && result.customer) {
        setCustomers((currentCustomers) => currentCustomers.map((currentCustomer) => currentCustomer._id === customer._id ? result.customer : currentCustomer));
      } else {
        await loadCustomers();
      }
    } catch (updateError) {
      setError(updateError.message);
    } finally {
      setBusyId("");
    }
  }

  function toggleCustomer(customer) {
    return updateCustomer(customer, "PATCH", { blocked: !customer.blocked });
  }

  return <div className="panel customer-access-panel">
    <div className="panel-heading"><div><h2>Customer access</h2><p>Block access temporarily or remove a customer and its fleet records.</p></div></div>
    {error && <div className="notice notice-error">{error}</div>}
    {customers.length ? <div className="customer-list customer-access-list">{customers.map((customer) => <div className="customer-row" key={customer._id}>
      <div><strong>{customer.name}</strong><small>{customer.email} · {customer.mobileNumber}</small></div>
      <div className="customer-actions">
        <button type="button" className={`status status-toggle ${customer.blocked ? "status-blocked" : "status-closed"}`} disabled={busyId === customer._id} onClick={() => toggleCustomer(customer)}>{customer.blocked ? "Deactive" : "Active"}</button>
        <button type="button" className="button button-danger button-small" disabled={busyId === customer._id} onClick={() => updateCustomer(customer, "DELETE", {})}>Delete</button>
      </div>
    </div>)}</div> : <p className="empty">No customers created yet.</p>}
  </div>;
}
