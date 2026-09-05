// @ts-nocheck
import { z } from "zod";

export const driverOnboardingSchema = z.object({
  customerId: z.string().min(1),
  name: z.string().trim().min(2).max(100),
  mobileNumber: z.string().trim().min(7).max(20),
  licenseNumber: z.string().trim().max(40).optional().or(z.literal("")),
  username: z.string().trim().min(3).max(50),
  password: z.string().min(8).max(100),
});

export const vehicleUserSchema = z.object({
  username: z.string().trim().min(3).max(50),
  password: z.string().min(8).max(100),
  vehicleId: z.string().min(1),
});

export const tripStartSchema = z.object({
  vehicleId: z.string().min(1),
  driverId: z.string().min(1).optional(),
  driverAdvance: z.object({ amount: z.coerce.number().nonnegative(), date: z.coerce.date() }),
  loadingLocation: z.string().min(1),
  loadingExpense: z.coerce.number().nonnegative().default(0),
  firstDieselFill: z.object({
    volume: z.coerce.number().positive(),
    rate: z.coerce.number().positive(),
    odometerKm: z.coerce.number().nonnegative().optional(),
    date: z.coerce.date(),
  }).optional(),
  previousUnloadingLocation: z.string().optional(),
  previousUnloadingExpense: z.coerce.number().nonnegative().default(0),
});

export const documentUpdateSchema = z.object({
  documents: z.record(z.object({ expiryDate: z.string().date().nullable().or(z.literal("")) })),
});

export const dieselEntrySchema = z.object({
  volume: z.coerce.number().positive(),
  rate: z.coerce.number().positive(),
  odometerKm: z.coerce.number().nonnegative().optional(),
  photo: z.object({ url: z.string().url(), gps: z.object({ lat: z.number(), lng: z.number() }).nullable().optional() }).nullable().optional(),
});

export const expenseEntrySchema = z.object({
  amount: z.coerce.number().nonnegative(),
  date: z.coerce.date(),
  note: z.string().max(200).optional(),
  photo: z.unknown().optional(),
});

export type DriverOnboardingInput = z.infer<typeof driverOnboardingSchema>;
export type TripStartInput = z.infer<typeof tripStartSchema>;
