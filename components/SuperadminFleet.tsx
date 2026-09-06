import { useEffect, useState } from "react";

export default function SuperadminFleet() {
  const [vehicles, setVehicles] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [error, setError] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState("");

  useEffect(() => {
    Promise.all([fetch("/api/vehicles"), fetch("/api/customers")])
      .then(async ([vehicleResponse, customerResponse]) => {
        const vehicleResult = await vehicleResponse.json();
        const customerResult = await customerResponse.json();
        if (!vehicleResponse.ok || !customerResponse.ok) throw new Error("Could not load total fleet");
        setVehicles(vehicleResult);
        setCustomers(customerResult);
      })
      .catch((loadError) => setError(loadError.message));
  }, []);

  const customerName = (customerId) => customers.find((customer) => customer._id === customerId)?.name || "Customer fleet";
  const filteredVehicles = selectedCustomer ? vehicles.filter((vehicle) => vehicle.customerId === selectedCustomer) : vehicles;

  return <div className="panel">
    <div className="panel-heading"><div><h2>Total fleet vehicles</h2><p>Includes vehicles from every customer fleet.</p></div><strong className="fleet-total">{filteredVehicles.length}</strong></div>
    <div className="field fleet-filter"><label>Customer fleet</label><select value={selectedCustomer} onChange={(event) => setSelectedCustomer(event.target.value)}><option value="">All customer fleets</option>{customers.map((customer) => <option key={customer._id} value={customer._id}>{customer.name}</option>)}</select></div>
    {error ? <div className="notice notice-error">{error}</div> : filteredVehicles.length ? <div className="fleet-table-wrap"><table className="fleet-table"><thead><tr><th>Customer fleet</th><th>Fleet number</th></tr></thead><tbody>{filteredVehicles.map((vehicle) => <tr key={vehicle._id}><td>{customerName(vehicle.customerId)}</td><td><strong>{vehicle.vehicleNumber}</strong></td></tr>)}</tbody></table></div> : <p className="empty">No vehicles in this customer fleet yet.</p>}
  </div>;
}
