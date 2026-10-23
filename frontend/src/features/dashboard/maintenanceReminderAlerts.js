export function getMaintenanceReminderAlerts(vehicles = []) {
  return vehicles.flatMap((vehicle) => (
    (vehicle.maintenanceComponents || []).flatMap((component) => {
      const currentOdometer = Number(vehicle.lastKnownOdometer);
      const startingOdometer = Number(component.startingOdometerKm);
      const expectedKm = Number(component.expectedKm);
      const reminderKm = Number(component.reminderKm);
      if (
        vehicle.lastKnownOdometer == null
        || component.startingOdometerKm == null
        || component.expectedKm == null
        || component.reminderKm == null
        || ![currentOdometer, startingOdometer, expectedKm, reminderKm].every(Number.isFinite)
        || currentOdometer < startingOdometer
        || expectedKm < 0
        || reminderKm < 0
      ) return [];

      const remainingKm = expectedKm - (currentOdometer - startingOdometer);
      if (remainingKm > 0 && remainingKm >= reminderKm) return [];
      return [{
        key: `${vehicle._id}-${component.name}`,
        vehicleNumber: vehicle.vehicleNumber,
        componentName: component.name,
        remainingKm,
        overdue: remainingKm < 0,
      }];
    })
  ));
}
