export function cnicDigits(value: string): string {
  return (value ?? "").replace(/\D/g, "");
}

export function formatCnic(value: string): string {
  const digits = cnicDigits(value).slice(0, 13);
  const parts = [digits.slice(0, 5), digits.slice(5, 12), digits.slice(12, 13)];
  return parts.filter(Boolean).join("-");
}

export function isValidCnic(value: string): boolean {
  return cnicDigits(value).length === 13;
}

/** A mobile number is valid when it contains 10–15 digits (allows +, spaces, dashes). */
export function isValidMobile(value: string): boolean {
  if (!value || !value.trim()) return true;
  const digits = cnicDigits(value);
  return digits.length >= 10 && digits.length <= 15;
}

/**
 * Keeps only digits, caps the input at `maxDigits`, and formats it as a
 * Pakistani mobile number: 0300-1234567 (dash after the first 4 digits).
 */
export function formatPhoneNumber(value: string, maxDigits = 11): string {
  const digits = cnicDigits(value).slice(0, maxDigits);
  const parts = [digits.slice(0, 4), digits.slice(4)];
  return parts.filter(Boolean).join("-");
}

/** Employee phone must be exactly `maxDigits` digits (11 for a Pakistani mobile). */
export function isValidPhoneNumber(value: string, maxDigits = 11): boolean {
  if (!value || !value.trim()) return true;
  return cnicDigits(value).length === maxDigits;
}
