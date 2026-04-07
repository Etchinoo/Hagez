// Arabic-Indic numeral conversion (US-063)
// Use for: party size, ratings, review counts, UI counts
// Do NOT use for: booking refs, EGP amounts, phone numbers

const AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

export function toArabic(n: number | string): string {
  return String(n).replace(/\d/g, (d) => AR_DIGITS[+d]);
}
