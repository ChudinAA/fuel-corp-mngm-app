
import { useMemo } from "react";

interface UseQuantityCalculationProps {
  inputMode: "liters" | "kg";
  quantityLiters: string;
  density: string;
  quantityKg: string;
  isAbroad?: boolean;
}

export function useQuantityCalculation({
  inputMode,
  quantityLiters,
  density,
  quantityKg,
  isAbroad = false,
}: UseQuantityCalculationProps) {
  const calculatedKg = useMemo(() => {
    if (inputMode === "liters" && quantityLiters) {
      if (isAbroad) {
        return quantityLiters;
      }
      if (density) {
        return (parseFloat(quantityLiters) * parseFloat(density)).toFixed(0);
      }
    }
    return quantityKg || "0";
  }, [inputMode, quantityLiters, density, quantityKg, isAbroad]);

  const finalKg = parseFloat(calculatedKg || "0");

  return {
    calculatedKg,
    finalKg,
  };
}
