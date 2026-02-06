
import { useMemo } from "react";

interface UseQuantityCalculationProps {
  inputMode: "liters" | "kg";
  quantityLiters: string;
  density: string;
  quantityKg: string;
}

export function useQuantityCalculation({
  inputMode,
  quantityLiters,
  density,
  quantityKg,
}: UseQuantityCalculationProps) {
  const calculatedKg = useMemo(() => {
    if (inputMode === "liters" && quantityLiters && density) {
      return (parseFloat(quantityLiters) * parseFloat(density)).toFixed(0);
    }
    return quantityKg || "0";
  }, [inputMode, quantityLiters, density, quantityKg]);

  const finalKg = parseFloat(calculatedKg || "0");

  return {
    calculatedKg,
    finalKg,
  };
}
