import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import * as api from '../api/api';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import AdvanceSection from '../components/trip/AdvanceSection';
import LoadingDetailsForm from '../components/trip/LoadingDetailsForm';
import LoadingDetailsSummary from '../components/trip/LoadingDetailsSummary';
import TurnDetailsForm from '../components/trip/TurnDetailsForm';
import TurnDetailsSummary from '../components/trip/TurnDetailsSummary';
import UnloadingTurnForm from '../components/trip/UnloadingTurnForm';
import UnloadingTurnSummary from '../components/trip/UnloadingTurnSummary';
import DieselForm from '../components/trip/DieselForm';
import DieselSummary from '../components/trip/DieselSummary';
import RtoSummary from '../components/trip/RtoSummary';
import RtoForm from '../components/trip/RtoForm';
import OtherExpenseForm from '../components/trip/OtherExpenseForm';
import OtherExpenseSummary from '../components/trip/OtherExpenseSummary';
import UnloadingForm from '../components/trip/UnloadingForm';
import UnloadingDetailsSummary from '../components/trip/UnloadingDetailsSummary';
import EntriesSummary from '../components/trip/EntriesSummary';

export default function TripDetail() {
  const { tripId } = useParams();
  const { user } = useAuth() || {};
  const [trip, setTrip] = useState(null);
  const [meta, setMeta] = useState({ loadingLocations: [], unloadingLocations: [], routeKmTable: [] });
  const [editingLoadingDetails, setEditingLoadingDetails] = useState(false);
  const [editingUnloadingDetails, setEditingUnloadingDetails] = useState(false);
  const [editingTurnDetails, setEditingTurnDetails] = useState(false);

  function load() {
    api.getTrip(tripId).then((res) => setTrip(res.data.trip));
  }
  useEffect(load, [tripId]);
  // Location lists / KM table change rarely - fetch once per page visit, not after every save.
  useEffect(() => {
    api.getMeta().then((res) => setMeta(res.data));
  }, []);

  if (!trip) return <Layout><p>Loading...</p></Layout>;

  const hasLoadingDetails = Boolean(trip.loadingLocation && trip.loadingDate);
  const hasUnloadingDetails = Boolean(trip.unloadingLocation && trip.unloadingDate);
  const hasTurnDetails = trip.turnNumber != null && trip.turnDate;
  const hasUnloadingTurnDetails = trip.unTurnNumber != null && trip.unTurnDate;
  // Keep the editable Load Turn form (and its Manual KM Return field) visible whenever KM
  // couldn't be resolved from the table, even if turn number/date were already saved, so it's
  // never hidden behind the read-only "Load Turn Added" summary.
  const manualKmMissingForClose = trip.corporationKmSource === 'manual_required' && trip.manualKmReturn == null;
  const formatDate = (value) => (value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '');
  const loadingDateText = formatDate(trip.loadingDate);
  const unloadingDateText = formatDate(trip.unloadingDate);

  const routeUnloadingOptions = Array.from(new Set((meta.routeKmTable || []).map((row) => row.unloadingLocation).filter(Boolean)));
  // The driver can no longer edit a trip they've already Trip Closed - only admins can adjust it.
  const lockedForDriver = user?.role === 'vehicle_user' && trip.status !== 'open';

  return (
    <Layout>
      <Link to="/">&larr; Back to vehicles and trips</Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 12 }}>
        <h2 className="section-title" style={{ margin: 0 }}>
          Trip: {trip.loadingLocation}{loadingDateText ? ` (${loadingDateText})` : ''} &rarr; {trip.unloadingLocation || '(unloading pending)'}{unloadingDateText ? ` (${unloadingDateText})` : ''}
          {trip.isDiverted && trip.divertUnloadingLocation ? ` \u2192 ${trip.divertUnloadingLocation}${trip.divertDate ? ` (${formatDate(trip.divertDate)})` : ''} - Divert` : ''}
        </h2>
        <span className={`badge ${trip.status}`}>{trip.status}</span>
      </div>
      <div style={{ marginTop: 12, marginBottom: 12 }}>
        <p style={{ color: '#666', margin: 0 }}>
          Customer: {trip.customer?.companyName || 'Unknown'}
        </p>
      </div>

      <fieldset disabled={lockedForDriver} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <>
        <AdvanceSection trip={trip} tripId={tripId} onSaved={load} />
        <div className="card">
          <h3 className="section-title" style={{ marginTop: 0 }}>Loading Details & Expenses</h3>
          {hasLoadingDetails && (
            <LoadingDetailsSummary trip={trip} onEdit={() => setEditingLoadingDetails(true)} />
          )}
          {(!hasLoadingDetails || editingLoadingDetails) && (
            <LoadingDetailsForm
              tripId={tripId}
              trip={trip}
              meta={meta}
              onSaved={() => { setEditingLoadingDetails(false); load(); }}
            />
          )}
        </div>
        <div className="card">
          <DieselSummary trip={trip} tripId={tripId} onSaved={load} />
          <div style={{ marginTop: 14 }}>
            <DieselForm tripId={tripId} trip={trip} onSaved={load} title="" />
          </div>
        </div>
        <div className="card">
          <RtoSummary trip={trip} onSaved={load} />
          <div style={{ marginTop: 14 }}>
            <RtoForm tripId={tripId} trip={trip} onSaved={load} />
          </div>
        </div>
        {hasUnloadingTurnDetails ? (
          <UnloadingTurnSummary trip={trip} onDeleted={load} />
        ) : (
          <UnloadingTurnForm tripId={tripId} trip={trip} onSaved={load} />
        )}
        {hasUnloadingDetails && <UnloadingDetailsSummary trip={trip} onEdit={() => setEditingUnloadingDetails(true)} />}
        {(!hasUnloadingDetails || editingUnloadingDetails) && (
          <UnloadingForm
            tripId={tripId}
            meta={meta}
            trip={trip}
            routeUnloadingOptions={routeUnloadingOptions}
            onSaved={() => { setEditingUnloadingDetails(false); load(); }}
          />
        )}
        <div className="card">
          <OtherExpenseSummary trip={trip} tripId={tripId} onSaved={load} />
          <div style={{ marginTop: 14 }}>
            <OtherExpenseForm tripId={tripId} trip={trip} onSaved={load} />
          </div>
        </div>
        {hasTurnDetails && !manualKmMissingForClose && <TurnDetailsSummary trip={trip} onEdit={() => setEditingTurnDetails(true)} />}
        {(!hasTurnDetails || editingTurnDetails || manualKmMissingForClose) && (
          <TurnDetailsForm
            tripId={tripId}
            trip={trip}
            meta={meta}
            onSaved={() => { setEditingTurnDetails(false); load(); }}
          />
        )}
        </>

      </fieldset>
      <EntriesSummary
        trip={trip}
        corporationKm={(meta.routeKmTable || []).find((row) => (
          String(row.loadingLocation || '').trim() === String(trip.loadingLocation || '').trim() &&
          String(row.unloadingLocation || '').trim() === String(trip.unloadingLocation || '').trim()
        ))?.km}
        calculatedCorporationKm={trip.corporationKm}
      />
    </Layout>
  );
}
