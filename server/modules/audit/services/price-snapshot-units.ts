/**
 * Decode immutable historical audit snapshots into today's tariff units.
 * This is not an accepted business/API input format: restored rows are always
 * written in tonnes, while source litre quotes retain their rate unit.
 */
export function priceSnapshotToCurrentUnits(
  snapshot: Record<string, unknown>,
): Record<string, unknown> {
  const restored = { ...snapshot };
  const has = (key: string) => Object.prototype.hasOwnProperty.call(snapshot, key);
  const sourceRateUnit = snapshot.priceUnit ?? "kg";
  const sourceMassUnit = snapshot.volumeUnit ?? "kg";

  if (has("priceValues")) {
    if (!["kg", "tonne", "liter"].includes(String(sourceRateUnit))) {
      throw new TypeError("Неизвестная единица цены в исторической записи");
    }
    if (snapshot.priceValues !== null) {
      if (!Array.isArray(snapshot.priceValues)) {
        throw new TypeError("Некорректные ставки в исторической записи");
      }
      restored.priceValues = snapshot.priceValues.map((value) => {
        const parsed = typeof value === "string" ? JSON.parse(value) : value;
        const raw = typeof parsed === "number" ? parsed : parsed?.price;
        if (raw === null || raw === undefined || raw === "") {
          throw new TypeError("Пустая ставка в исторической записи");
        }
        const rate = Number(raw);
        if (!Number.isFinite(rate)) {
          throw new TypeError("Некорректная ставка в исторической записи");
        }
        // Shift the decimal exponent instead of multiplying binary floats:
        // 75.12345 must restore as 75123.45, not 75123.45000000001.
        const [coefficient, exponent = "0"] = String(rate).split(/e/i);
        const currentRate = sourceRateUnit === "kg"
          ? Number(`${coefficient}e${Number(exponent) + 3}`)
          : rate;
        if (!Number.isFinite(currentRate)) {
          throw new TypeError("Ставка исторической записи выходит за допустимый диапазон");
        }
        return JSON.stringify({
          price: currentRate,
        });
      });
    }
    restored.priceUnit = sourceRateUnit === "liter" ? "liter" : "tonne";
  } else if (has("priceUnit")) {
    if (sourceRateUnit !== "tonne" && sourceRateUnit !== "liter") {
      throw new TypeError("Историческая единица цены требует сохранённых ставок");
    }
  }

  if (has("volume") || has("soldVolume")) {
    if (sourceMassUnit !== "kg" && sourceMassUnit !== "tonne") {
      throw new TypeError("Неизвестная единица массы в исторической записи");
    }
    for (const key of ["volume", "soldVolume"]) {
      if (!has(key) || snapshot[key] === null) continue;
      const mass = Number(snapshot[key]);
      if (!Number.isFinite(mass)) {
        throw new TypeError("Некорректная масса в исторической записи");
      }
      restored[key] = (sourceMassUnit === "kg" ? mass / 1000 : mass).toFixed(5);
    }
    restored.volumeUnit = "tonne";
  } else if (has("volumeUnit") && sourceMassUnit !== "tonne") {
    throw new TypeError("Историческая единица массы требует сохранённого объёма");
  }
  return restored;
}
