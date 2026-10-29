function historicalRatePerTonne(value: unknown): string | null {
  if (value == null || (typeof value === "string" && value.trim() === "")) {
    return null;
  }
  const perKilogram = Number(value);
  if (!Number.isFinite(perKilogram)) {
    throw new TypeError("Некорректная историческая ставка поставщика");
  }
  return (perKilogram * 1000).toFixed(6);
}

export function supplierBasisPriceSnapshotToCurrentUnits(
  snapshot: Record<string, unknown>,
): Record<string, unknown> {
  const restored = { ...snapshot };
  let basisPrices = snapshot.basisPrices;

  if (typeof basisPrices === "string") {
    try {
      basisPrices = JSON.parse(basisPrices);
    } catch {
      throw new TypeError("Некорректные исторические ставки поставщика");
    }
  }
  if (basisPrices == null) return restored;
  if (!Array.isArray(basisPrices)) {
    throw new TypeError("Некорректные исторические ставки поставщика");
  }

  restored.basisPrices = basisPrices.map((entry) => {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      throw new TypeError("Некорректная историческая ставка поставщика");
    }
    const row = { ...(entry as Record<string, unknown>) };
    for (const [legacyKey, tonneKey] of [
      ["servicePrice", "servicePricePerTonne"],
      ["pvkjPrice", "pvkjPricePerTonne"],
      ["agentFee", "agentFeePerTonne"],
    ]) {
      if (row[tonneKey] == null && row[legacyKey] != null) {
        row[tonneKey] = historicalRatePerTonne(row[legacyKey]);
      }
      delete row[legacyKey];
    }
    return row;
  });

  return restored;
}
