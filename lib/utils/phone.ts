// lib/utils/phone.ts

/**
 * Normalizes Kenyan phone numbers to +254 format.
 * Handles: 07..., 01..., 254..., +254..., 7..., 1...
 */
export function normalizeKenyanPhone(phone: string): string {
  const raw = phone.replace(/\s/g, "");

  if (raw.startsWith("+254")) return raw;
  if (raw.startsWith("254")) return `+${raw}`;
  if (raw.startsWith("0")) return `+254${raw.slice(1)}`;

  // Handles cases where user starts directly with 7... or 1...
  return `+254${raw}`;
}

export const KENYAN_PHONE_REGEX = /^(\+?254|0)[17]\d{8}$/;
