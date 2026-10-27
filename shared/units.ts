export const KILOGRAMS_PER_TON = 1_000;

function assertFinite(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number`);
  }
  return value;
}

/** Converts a mass in kilograms to metric tonnes without display rounding. */
export function kilogramsToTonnes(kilograms: number): number {
  return assertFinite(kilograms, "kilograms") / KILOGRAMS_PER_TON;
}

/** Converts a mass in metric tonnes to kilograms without display rounding. */
export function tonnesToKilograms(tonnes: number): number {
  return assertFinite(tonnes, "tonnes") * KILOGRAMS_PER_TON;
}

/** Converts a unit price in currency/kg to currency/tonne. */
export function pricePerKilogramToPerTonne(pricePerKilogram: number): number {
  return assertFinite(pricePerKilogram, "pricePerKilogram") * KILOGRAMS_PER_TON;
}

/** Converts a unit price in currency/tonne to currency/kg. */
export function pricePerTonneToPerKilogram(pricePerTonne: number): number {
  return assertFinite(pricePerTonne, "pricePerTonne") / KILOGRAMS_PER_TON;
}

/** Displays tonnes to five decimal places; this is formatting, not calculation rounding. */
export function formatTonnes(value: number | string): string {
  const tonnes = typeof value === "number" ? value : Number(value);
  assertFinite(tonnes, "tonnes");
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 5,
    maximumFractionDigits: 5,
  }).format(tonnes);
}

/** Displays a price per tonne to two decimal places. */
export function formatPricePerTonne(value: number | string): string {
  const price = typeof value === "number" ? value : Number(value);
  assertFinite(price, "pricePerTonne");
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}
