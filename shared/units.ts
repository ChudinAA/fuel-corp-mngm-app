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
 * Resolves a historical deal's mass from its saved legacy kilogram value.
 * Litres and density are retained in the signature for existing callers, but
 * must not be used to reconstruct a historical mass.
 */
export function legacyDealMassToTonnes(
  kilograms: number | string | null | undefined,
  _litres: number | string | null | undefined,
  _densityKilogramsPerLitre: number | string | null | undefined,
): number | null {
  const parseOptionalFinite = (value: number | string | null | undefined) => {
    if (value === null || value === undefined || value === "") return null;
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const massKg = parseOptionalFinite(kilograms);
  return massKg === null ? null : kilogramsToTonnes(massKg);
}

/** Converts a unit price in currency/kg to currency/tonne. */
export function pricePerKilogramToPerTonne(pricePerKilogram: number): number {
  return assertFinite(pricePerKilogram, "pricePerKilogram") * KILOGRAMS_PER_TON;
}

/** Converts a unit price in currency/tonne to currency/kg. */
export function pricePerTonneToPerKilogram(pricePerTonne: number): number {
  return assertFinite(pricePerTonne, "pricePerTonne") / KILOGRAMS_PER_TON;
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
