const express = require('express');
const router = express.Router();
const { LOADING_LOCATIONS, UNLOADING_LOCATIONS, ROLES } = require('../config/constants');
const { requireRole } = require('../middleware/auth');
const settings = require('../utils/settings');
const { rules } = require('../middleware/validate');

function normalizeRouteKmTable(rows) {
  if (!Array.isArray(rows)) throw new Error('routeKmTable must be an array');
  return rows.map((row, index) => ({
    loadingLocation: String(row?.loadingLocation || '').trim(),
    corporation: String(row?.corporation || '').trim(),
    unloadingLocation: String(row?.unloadingLocation || '').trim(),
    km: Number(row?.km),
    id: row?.id || `row-${index}`,
  })).filter((row) => {
    const hasRequiredFields = row.loadingLocation && row.unloadingLocation && row.corporation && Number.isFinite(row.km) && row.km >= 0;
    return hasRequiredFields;
  }).sort((left, right) => (
    left.corporation.localeCompare(right.corporation, undefined, { sensitivity: 'base' }) ||
    left.loadingLocation.localeCompare(right.loadingLocation, undefined, { sensitivity: 'base' }) ||
    left.unloadingLocation.localeCompare(right.unloadingLocation, undefined, { sensitivity: 'base' })
  ));
}

function updateRouteKmRowById(rows, rowId, nextRow) {
  if (!Array.isArray(rows)) throw new Error('routeKmTable must be an array');
  const normalizedNextRow = normalizeRouteKmTable([nextRow])[0];
  if (!normalizedNextRow) {
    throw new Error('Route KM row is incomplete');
  }

  return rows.map((row) => {
    const currentRowId = row?.id || `${row?.loadingLocation}-${row?.unloadingLocation}`;
    return currentRowId === rowId ? { ...row, ...normalizedNextRow, id: row?.id || rowId } : row;
  });
}

// Synchronous read of the cached table (loaded from Mongo at startup) - used by trip and salary code.
function loadRouteKmTable() {
  return normalizeRouteKmTable(settings.getRouteKmTable());
}

async function persistRouteKmTable(rows) {
  return settings.saveRouteKmTable(normalizeRouteKmTable(rows || []));
}

function buildLocationOptions(rows = loadRouteKmTable()) {
  const tableRows = Array.isArray(rows) ? rows : [];
  const sortLocations = (locations) => Array.from(new Set(locations.filter(Boolean)))
    .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }));
  const loadingFromTable = tableRows.map((row) => String(row?.loadingLocation || '').trim());
  const unloadingFromTable = tableRows.map((row) => String(row?.unloadingLocation || '').trim());

  if (tableRows.length > 0) {
    return {
      loadingLocations: sortLocations([...loadingFromTable, ...unloadingFromTable]),
      unloadingLocations: sortLocations([...loadingFromTable, ...unloadingFromTable]),
    };
  }

  return {
    loadingLocations: Array.from(new Set(Array.isArray(LOADING_LOCATIONS) ? LOADING_LOCATIONS : [])),
    unloadingLocations: Array.from(new Set(Array.isArray(UNLOADING_LOCATIONS) ? UNLOADING_LOCATIONS : [])),
  };
}

router.normalizeRouteKmTable = normalizeRouteKmTable;
router.updateRouteKmRowById = updateRouteKmRowById;
router.loadRouteKmTable = loadRouteKmTable;
router.persistRouteKmTable = persistRouteKmTable;
router.buildLocationOptions = buildLocationOptions;

// Public-ish (still requires login) so both the website and mobile app pull
// dropdown options from one place instead of hardcoding them per-client.
router.get('/', (req, res) => {
  const routeKmTable = loadRouteKmTable();
  const { loadingLocations, unloadingLocations } = buildLocationOptions(routeKmTable);
  res.json({
    loadingLocations,
    unloadingLocations,
    routeKmTable,
    mobileAppUrl: settings.getMobileAppUrl(),
  });
});

router.put('/route-km', requireRole(ROLES.SUPER_ADMIN), async (req, res) => {
  try {
    const { rowId, row } = req.body || {};
    if (rowId && row) {
      const routeKmTable = await persistRouteKmTable(updateRouteKmRowById(loadRouteKmTable(), rowId, row));
      return res.json({ routeKmTable });
    }

    const routeKmTable = await persistRouteKmTable(normalizeRouteKmTable(req.body?.routeKmTable || []));
    res.json({ routeKmTable });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to update route km table' });
  }
});

// Where the "Get the mobile app" QR code on the super admin dashboard points (APK or store link).
router.put('/mobile-app-url', requireRole(ROLES.SUPER_ADMIN), rules.mobileAppUrl, async (req, res) => {
  const mobileAppUrl = await settings.saveMobileAppUrl(req.body.mobileAppUrl || '');
  res.json({ mobileAppUrl });
});

module.exports = router;
