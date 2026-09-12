const fs = require('fs');
const path = require('path');
const express = require('express');
const router = express.Router();
const { LOADING_LOCATIONS, UNLOADING_LOCATIONS, ROUTE_KM_TABLE, ROLES } = require('../config/constants');
const { requireRole } = require('../middleware/auth');

const ROUTE_KM_TABLE_FILE = path.join(__dirname, '../config/routeKmTable.json');

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

function loadRouteKmTable() {
  try {
    if (!fs.existsSync(ROUTE_KM_TABLE_FILE)) {
      return normalizeRouteKmTable([...ROUTE_KM_TABLE]);
    }

    const saved = fs.readFileSync(ROUTE_KM_TABLE_FILE, 'utf8');
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed) && parsed.length >= 0) {
      return normalizeRouteKmTable(parsed);
    }
  } catch (err) {
    // Fall back to the default seed values when the file is missing or invalid.
  }

  return normalizeRouteKmTable([...ROUTE_KM_TABLE]);
}

function persistRouteKmTable(rows) {
  const normalized = normalizeRouteKmTable(rows || []);
  fs.writeFileSync(ROUTE_KM_TABLE_FILE, JSON.stringify(normalized, null, 2), 'utf8');
  routeKmTable = normalized;
  return normalized;
}

let routeKmTable = loadRouteKmTable();

function buildLocationOptions(rows = routeKmTable) {
  const tableRows = Array.isArray(rows) ? rows : [];
  const sortLocations = (locations) => Array.from(new Set(locations.filter(Boolean)))
    .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }));
  const loadingFromTable = tableRows.map((row) => String(row?.loadingLocation || '').trim());
  const unloadingFromTable = tableRows.map((row) => String(row?.unloadingLocation || '').trim());

  if (tableRows.length > 0) {
    return {
      loadingLocations: sortLocations(loadingFromTable),
      unloadingLocations: sortLocations(unloadingFromTable),
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
  routeKmTable = loadRouteKmTable();
  const { loadingLocations, unloadingLocations } = buildLocationOptions();
  res.json({
    loadingLocations,
    unloadingLocations,
    routeKmTable,
  });
});

router.put('/route-km', requireRole(ROLES.SUPER_ADMIN), (req, res) => {
  try {
    const { rowId, row } = req.body || {};
    if (rowId && row) {
      routeKmTable = persistRouteKmTable(updateRouteKmRowById(routeKmTable, rowId, row));
      return res.json({ routeKmTable });
    }

    routeKmTable = persistRouteKmTable(normalizeRouteKmTable(req.body?.routeKmTable || []));
    res.json({ routeKmTable });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to update route km table' });
  }
});

module.exports = router;
