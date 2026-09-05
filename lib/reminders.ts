// @ts-nocheck
import { differenceInCalendarDays, endOfQuarter, isSameDay } from "date-fns";

const LABELS = {
  qTax: "Q-Tax",
  fitness: "Fitness Certificate",
  permit1Year: "1 Year Permit",
  permit5Year: "5 Year Permit",
  purging: "Purging Certificate",
  explosive: "Explosive License",
  pli: "PLI",
  insurance: "Vehicle Insurance",
  hydroCertificate: "Hydro Certificate",
};

/**
 * Decide, for a single document field, whether today is the day to send a reminder.
 * - QUARTER_END (Q-Tax only): fire on the last calendar day of every quarter, regardless
 *   of the stored expiryDate (the spec asks for an end-of-quarter reminder, not an
 *   expiry-based one).
 * - DAYS_BEFORE_15 (everything else): fire when today is exactly 15 days before expiryDate.
 * Returns a dedupe key to write back so the same period never re-fires.
 */
export function shouldRemind(docEntry, today = new Date()) {
  if (!docEntry) return null;

  if (docEntry.reminderRule === "QUARTER_END") {
    const qEnd = endOfQuarter(today);
    const key = `${today.getFullYear()}-Q${Math.floor(today.getMonth() / 3) + 1}`;
    if (isSameDay(today, qEnd) && docEntry.lastReminderSentFor !== key) {
      return key;
    }
    return null;
  }

  if (docEntry.reminderRule === "DAYS_BEFORE_15") {
    if (!docEntry.expiryDate) return null;
    const days = differenceInCalendarDays(new Date(docEntry.expiryDate), today);
    const key = new Date(docEntry.expiryDate).toISOString().slice(0, 10);
    if (days === 15 && docEntry.lastReminderSentFor !== key) {
      return key;
    }
    return null;
  }

  return null;
}

export function docLabel(fieldName) {
  return LABELS[fieldName] || fieldName;
}

export const DOCUMENT_FIELDS = Object.keys(LABELS);
