// Money-mask a price input as the admin types digits only, e.g. "3090" ->
// "30,90" (last two digits are always cents) - the standard BRL currency
// input pattern, so nobody has to type the comma/period themselves.
export function formatPriceInput(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  const cents = parseInt(digits, 10);
  return (cents / 100).toFixed(2).replace('.', ',');
}

// Inverse, for validation/submission - parseFloat can't read a comma decimal.
export function parsePriceInput(masked: string): number {
  return parseFloat(masked.replace(',', '.')) || 0;
}
