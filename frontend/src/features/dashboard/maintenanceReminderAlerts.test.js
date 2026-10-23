import { getMaintenanceReminderAlerts } from './maintenanceReminderAlerts';

test('alerts when remaining service kilometres are below the configured reminder buffer', () => {
  const vehicles = [{
    _id: 'vehicle-1',
    vehicleNumber: 'KA01AB1234',
    lastKnownOdometer: 14500,
    maintenanceComponents: [{
      name: 'Engine Oil',
      startingOdometerKm: 10000,
      expectedKm: 5000,
      reminderKm: 600,
    }],
  }];

  expect(getMaintenanceReminderAlerts(vehicles)).toEqual([{
    key: 'vehicle-1-Engine Oil',
    vehicleNumber: 'KA01AB1234',
    componentName: 'Engine Oil',
    remainingKm: 500,
    overdue: false,
  }]);
});

test('alerts below the reminder threshold and keeps overdue components in the alert list', () => {
  const vehicle = {
    _id: 'vehicle-1',
    vehicleNumber: 'KA01AB1234',
    lastKnownOdometer: 14500,
    maintenanceComponents: [{
      name: 'Engine Oil',
      startingOdometerKm: 10000,
      expectedKm: 5000,
      reminderKm: 400,
    }],
  };
  expect(getMaintenanceReminderAlerts([vehicle])).toEqual([]);
  vehicle.lastKnownOdometer = 14601;
  expect(getMaintenanceReminderAlerts([vehicle])[0]).toMatchObject({
    remainingKm: 399,
    overdue: false,
  });
  vehicle.lastKnownOdometer = 15200;
  expect(getMaintenanceReminderAlerts([vehicle])[0]).toMatchObject({
    remainingKm: -200,
    overdue: true,
  });
});
