import React, { useEffect, useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import * as api from '../../api/api';

// "Get the mobile app" card: a QR code drivers scan to install LPG Fleet Driver. The link is
// saved on the server so every super admin sees the same code (APK link now, Play Store later).
export default function MobileAppCard() {
  const [savedUrl, setSavedUrl] = useState('');
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const canvasWrapRef = useRef(null);

  useEffect(() => {
    api.getMeta()
      .then((res) => {
        const current = res.data.mobileAppUrl || '';
        setSavedUrl(current);
        setUrl(current);
      })
      .catch(() => {});
  }, []);

  async function save(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setSaving(true);
    try {
      const res = await api.updateMobileAppUrl(url.trim());
      setSavedUrl(res.data.mobileAppUrl);
      setMessage('Link saved. The QR code below is what drivers scan.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save the link');
    } finally {
      setSaving(false);
    }
  }

  function downloadPng() {
    const canvas = canvasWrapRef.current?.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'lpg-fleet-driver-app-qr.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  const previewUrl = url.trim() || savedUrl;

  return (
    <div className="card superadmin-app-section" style={{ marginBottom: 20 }}>
      <h3 className="section-title" style={{ marginTop: 0 }}>LPG Fleet Driver — Mobile App</h3>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div ref={canvasWrapRef} style={{ textAlign: 'center' }}>
          {previewUrl ? (
            <>
              <div style={{ background: '#fff', padding: 12, border: '1px solid var(--border)', borderRadius: 12, display: 'inline-block' }}>
                <QRCodeCanvas value={previewUrl} size={200} level="M" includeMargin={false} />
              </div>
              <div style={{ marginTop: 8 }}>
                <button type="button" className="btn secondary" onClick={downloadPng}>Download QR image</button>
              </div>
            </>
          ) : (
            <div style={{ width: 224, height: 224, border: '1px dashed var(--border)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: 13, padding: 16, textAlign: 'center' }}>
              QR code appears here once an app link is saved
            </div>
          )}
        </div>
        <form onSubmit={save} style={{ flex: 1, minWidth: 280, border: 0, padding: 0, background: 'transparent' }}>
          <p style={{ color: '#666', fontSize: 13, marginTop: 0 }}>
            Drivers and admins scan this code with their phone camera to install the app. Paste the download link
            here — the APK link from the Expo build page for now, or the Google Play link once the app is published.
          </p>
          <div className="field">
            <label>App download link</label>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://expo.dev/artifacts/... or https://play.google.com/store/apps/details?id=in.kpstechnology.lpgfleet" />
          </div>
          {error && <div className="error-text">{error}</div>}
          {message && <div style={{ color: 'var(--green-700)', fontWeight: 700, marginBottom: 8 }}>{message}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" disabled={saving || url.trim() === savedUrl}>{saving ? 'Saving...' : 'Save link'}</button>
            {savedUrl && (
              <a className="btn secondary" href={savedUrl} target="_blank" rel="noreferrer">Open link</a>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
