// @ts-nocheck
import { useState } from "react";
import { upload } from "@vercel/blob/client";

/**
 * Captures one diesel fill: volume, rate (value auto-computed), optional odometer,
 * and an optional photo taken with the phone camera or uploaded from gallery,
 * tagged with the device's GPS position.
 *
 * `capture="environment"` on the file input opens the rear camera directly on mobile
 * browsers, but still lets the user pick an existing photo instead - satisfying
 * "take photo OR upload photo" from the spec.
 */
export default function DieselFillEntry({ tripId, onSaved }) {
  const [volume, setVolume] = useState("");
  const [rate, setRate] = useState("");
  const [odometerKm, setOdometerKm] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);

  function getGpsPosition() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      let photo = null;
      if (file) {
        const gps = await getGpsPosition();
        const blob = await upload(`diesel/${tripId}/${Date.now()}-${file.name}`, file, {
          access: "public",
          handleUploadUrl: "/api/upload", // see pages/api/upload.js in the README
        });
        photo = { url: blob.url, gps };
      }

      const res = await fetch(`/api/trips/${tripId}/diesel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          volume: parseFloat(volume),
          rate: parseFloat(rate),
          odometerKm: odometerKm ? parseFloat(odometerKm) : undefined,
          photo,
        }),
      });
      const data = await res.json();
      onSaved?.(data);
      setVolume(""); setRate(""); setOdometerKm(""); setFile(null);
    } finally {
      setBusy(false);
    }
  }

  const value = volume && rate ? (parseFloat(volume) * parseFloat(rate)).toFixed(2) : "0.00";

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 8, maxWidth: 360 }}>
      <label>Volume (L) <input type="number" step="0.01" value={volume} onChange={(e) => setVolume(e.target.value)} required /></label>
      <label>Rate (Rs/L) <input type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} required /></label>
      <div>Value: Rs {value}</div>
      <label>Odometer (km, optional) <input type="number" value={odometerKm} onChange={(e) => setOdometerKm(e.target.value)} /></label>
      <label>Photo (optional) <input type="file" accept="image/*" capture="environment" onChange={(e) => setFile(e.target.files[0])} /></label>
      <button type="submit" disabled={busy}>{busy ? "Saving..." : "Add Diesel Fill"}</button>
    </form>
  );
}
