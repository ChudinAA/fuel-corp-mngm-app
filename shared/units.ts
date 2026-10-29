export const KILOGRAMS_PER_TON = 1_000;

function assertFinite(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number`);
  }
  return value;
}

/** Converts liquid volume and its deal density to metric tonnes. */
export function litresAndDensityToTonnes(
  litres: number,
  densityKilogramsPerLitre: number,
): number {
  assertFinite(litres, "litres");
  assertFinite(densityKilogramsPerLitre, "densityKilogramsPerLitre");
  if (litres < 0) throw new RangeError("litres must not be negative");
  if (densityKilogramsPerLitre <= 0) {
    throw new RangeError("densityKilogramsPerLitre must be greater than zero");
  }
  return (litres * densityKilogramsPerLitre) / KILOGRAMS_PER_TON;
}

/**
 * Converts a price per litre to its equivalent price per tonne at the deal's
 * density (kg/litre). The source amount remains litres × price/litre.
 */
export function pricePerLitreToPerTonne(
  pricePerLitre: number,
  densityKilogramsPerLitre: number,
): number {
  assertFinite(pricePerLitre, "pricePerLitre");
  assertFinite(densityKilogramsPerLitre, "densityKilogramsPerLitre");
  if (densityKilogramsPerLitre <= 0) {
    throw new RangeError("densityKilogramsPerLitre must be greater than zero");
  }
  return (pricePerLitre * KILOGRAMS_PER_TON) / densityKilogramsPerLitre;
}

/** Displays tonnes to at most five decimal places, without trailing zeroes. */
export function formatTonnes(value: number | string): string {
  const tonnes = typeof value === "number" ? value : Number(value);
  assertFinite(tonnes, "tonnes");
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 5,
  }).format(tonnes);
}

/** Formats tonnes for numeric inputs, preserving dot decimals and at most five places. */
export function formatTonnesForInput(value: number | string): string {
  const tonnes = typeof value === "number" ? value : Number(value);
  assertFinite(tonnes, "tonnes");
  const formatted = tonnes.toFixed(5).replace(/\.?0+$/, "");
  return formatted === "-0" ? "0" : formatted;
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
