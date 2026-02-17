export function formatNumber(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "—";
  
  // Add 'k' suffix for numbers >= 1000
  // Временно убираем логику кило-форматирования
  // if (Math.abs(num) >= 1000) {
  //   const kValue = num / 1000;
  //   return kValue.toLocaleString("ru-RU", { 
  //     minimumFractionDigits: 1, 
  //     maximumFractionDigits: 1 
  //   }) + "к";
  // }
  
  return num.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatCurrency(value: number | string | null | undefined, currency: string = "USD"): string {
  if (value === null || value === undefined || value === "") return "—";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "—";
  const symbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : "₽";
  return `${symbol}${formatNumber(num)}`;
}

export function evaluateCommissionFormula(
  formula: string,
  variables: { purchasePrice: number; salePrice: number; quantity: number; exchangeRate: number }
): number | null {
  try {
    if (!formula || formula.trim() === "") return null;
    
    let expression = formula
      .replace(/purchasePrice/gi, variables.purchasePrice.toString())
      .replace(/salePrice/gi, variables.salePrice.toString())
      .replace(/quantity/gi, variables.quantity.toString())
      .replace(/qty/gi, variables.quantity.toString())
      .replace(/exchangeRate/gi, variables.exchangeRate.toString())
      .replace(/rate/gi, variables.exchangeRate.toString());
    
    const safeExpression = expression.replace(/[^0-9+\-*/().%\s]/g, "");
    
    if (safeExpression.trim() === "") return null;
    
    const fn = new Function(`return (${safeExpression})`);
    const result = fn();
    
    if (typeof result === "number" && !isNaN(result) && isFinite(result)) {
      return result;
    }
    return null;
  } catch {
    return null;
  }
}

export function validateCommissionFormula(formula: string): boolean {
  try {
    const testVars = { purchasePrice: 100, salePrice: 120, quantity: 1000, exchangeRate: 90 };
    const result = evaluateCommissionFormula(formula, testVars);
    return result !== null;
  } catch {
    return false;
  }
}
