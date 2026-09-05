// @ts-nocheck
import { useState } from "react";
import { upload } from "@vercel/blob/client";

export default function PhotoExpenseEntry({ tripId, type, onSaved }) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const label = type === "rto" ? "RTO entry" : "Other expense";

  function getGps() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      let photo = null;
      if (file) {
        const gps = await getGps();
        const blob = await upload(`${type}/${tripId}/${Date.now()}-${file.name}`, file, { access: "public", handleUploadUrl: "/api/upload" });
        photo = { url: blob.url, gps };
      }
      const response = await fetch(`/api/trips/${tripId}/${type === "rto" ? "rto" : "expense"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount), date, note: note || undefined, photo }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Could not save ${label.toLowerCase()}`);
      setAmount(""); setNote(""); setFile(null);
      onSaved?.(result);
    } finally {
      setBusy(false);
    }
  }

  return <form onSubmit={submit} className="field"><label>{label}</label><input required type="number" min="0" step="0.01" placeholder="Amount (Rs)" value={amount} onChange={(event) => setAmount(event.target.value)} /><input required type="date" value={date} onChange={(event) => setDate(event.target.value)} />{type !== "rto" && <input placeholder="Note (optional)" value={note} onChange={(event) => setNote(event.target.value)} />}<input type="file" accept="image/*" capture="environment" onChange={(event) => setFile(event.target.files[0] || null)} /><button className="button button-secondary" disabled={busy} type="submit">{busy ? "Saving..." : `Add ${label}`}</button></form>;
}
