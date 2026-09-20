// Barrel: re-exports every trip handler/helper so existing importers keep working unchanged.
const {
  getClosingDieselDate,
  getMissingTripRouteFields,
  hasValidGpsCoordinates,
} = require('./trip/tripHelpers');

module.exports = {
  getClosingDieselDate,
  getMissingTripRouteFields,
  hasValidGpsCoordinates,
  ...require('./trip/tripLifecycleController'),
  ...require('./trip/tripEntriesController'),
  ...require('./trip/tripReportController'),
};
