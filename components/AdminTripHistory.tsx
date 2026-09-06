import { useEffect, useState } from "react";

export default function AdminTripHistory() {
  const [trips, setTrips] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([fetch("/api/trips"), fetch("/api/vehicles")])
      .then(async ([tripResponse, vehicleResponse]) => {
        const tripResult = await tripResponse.json();
        const vehicleResult = await vehicleResponse.json();
        if (!tripResponse.ok || !vehicleResponse.ok || !Array.isArray(tripResult) || !Array.isArray(vehicleResult)) {
          throw new Error("Could not load trip history");
        }
        setTrips(tripResult);
        setVehicles(vehicleResult);
      })
      .catch((loadError) => setError(loadError.message));
  }, []);

  const vehicleNumber = (vehicleId) => vehicles.find((vehicle) => vehicle._id === vehicleId)?.vehicleNumber || "Unknown vehicle";
  const date = (value) => value ? new Date(value).toLocaleDateString() : "-";

  return <div className="panel admin-trip-history">
    <div className="panel-heading"><div><h2>Trip history</h2><p>Open and closed trips for your customer fleet.</p></div></div>
    {error ? <div className="notice notice-error">{error}</div> : trips.length ? <div className="trip-table-wrap"><table className="trip-table"><thead><tr><th>Vehicle</th><th>Driver</th><th>Status</th><th>Started</th><th>Closed</th></tr></thead><tbody>{trips.map((trip) => <tr key={trip._id}><td><strong>{vehicleNumber(trip.vehicleId)}</strong></td><td>{trip.driverId?.name || "-"}</td><td><span className={`status ${trip.status === "open" ? "status-open" : "status-closed"}`}>{trip.status === "open" ? "Open" : "Closed"}</span></td><td>{date(trip.createdAt)}</td><td>{date(trip.closedAt)}</td></tr>)}</tbody></table></div> : <p className="empty">No trips recorded for your fleet yet.</p>}
  </div>;
}
