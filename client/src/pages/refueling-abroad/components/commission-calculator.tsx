import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HelpCircle, Calculator } from "lucide-react";
import { evaluateCommissionFormula, validateCommissionFormula, formatCurrency } from "../utils";

interface CommissionCalculatorProps {
  purchasePrice: number;
  salePrice: number;
  quantity: number;
  exchangeRate: number;
  commissionFormula?: string;
  manualCommissionUsd?: string;
  onFormulaChange: (formula: string) => void;
  onManualCommissionChange?: (value: string) => void;
  onCommissionCalculated?: (usd: number | null, rub: number | null) => void;
}

export function CommissionCalculator({
  purchasePrice,
  salePrice,
  quantity,
  exchangeRate,
  commissionFormula = "",
  manualCommissionUsd = "",
  onFormulaChange,
  onManualCommissionChange,
  onCommissionCalculated,
}: CommissionCalculatorProps) {
  const formula = commissionFormula;
  const manualCommission = manualCommissionUsd;
  const [isFormulaValid, setIsFormulaValid] = useState(true);
  const [calculatedValue, setCalculatedValue] = useState<number | null>(null);

  useEffect(() => {
    if (formula.trim() === "") {
      setIsFormulaValid(true);
      setCalculatedValue(null);
      return;
    }
    
    const isValid = validateCommissionFormula(formula);
    setIsFormulaValid(isValid);
    
    if (isValid) {
      const result = evaluateCommissionFormula(formula, {
        purchasePrice,
        salePrice,
        quantity,
        exchangeRate,
      });
      setCalculatedValue(result);
    } else {
      setCalculatedValue(null);
    }
  }, [formula, purchasePrice, salePrice, quantity, exchangeRate]);

  useEffect(() => {
    if (onCommissionCalculated) {
      const manualValue = manualCommission ? parseFloat(manualCommission) : null;
      // If manual input is active, we should use it. 
      // The jerkiness happens because calculatedValue might still be updating.
      const finalUsd = manualValue !== null ? manualValue : calculatedValue;
      const finalRub = finalUsd !== null ? finalUsd * exchangeRate : null;
      onCommissionCalculated(finalUsd, finalRub);
    }
  }, [calculatedValue, manualCommission, exchangeRate]); // Removed onCommissionCalculated from deps to avoid loops if parent isn't memoized

  const presetFormulas = [
    { label: "% от продажи", formula: "(salePrice - purchasePrice) * quantity * 0.05", description: "5% от маржи" },
    { label: "Фикс за кг", formula: "quantity * 0.02", description: "$0.02 за кг" },
    { label: "% от суммы", formula: "salePrice * quantity * 0.03", description: "3% от суммы продажи" },
  ];

  return (
    <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium flex items-center gap-2">
          <Calculator className="h-4 w-4" />
          Комиссия посредника
        </Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <HelpCircle className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            <div className="space-y-2 text-sm">
              <p className="font-medium">Доступные переменные:</p>
              <ul className="space-y-1 text-muted-foreground">
                <li><code className="text-xs bg-muted px-1 rounded">purchasePrice</code> — цена закупки (USD/кг)</li>
                <li><code className="text-xs bg-muted px-1 rounded">salePrice</code> — цена продажи (USD/кг)</li>
                <li><code className="text-xs bg-muted px-1 rounded">quantity</code> — объем (кг)</li>
                <li><code className="text-xs bg-muted px-1 rounded">exchangeRate</code> — курс USD/RUB</li>
              </ul>
              <p className="font-medium mt-3">Примеры формул:</p>
              <ul className="space-y-1 text-muted-foreground">
                <li><code className="text-xs bg-muted px-1 rounded">quantity * 0.05</code> — $0.05 за кг</li>
                <li><code className="text-xs bg-muted px-1 rounded">(salePrice - purchasePrice) * quantity * 0.1</code> — 10% от маржи</li>
              </ul>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex flex-wrap gap-1">
        {presetFormulas.map((preset) => (
          <Badge
            key={preset.label}
            variant="outline"
            className="cursor-pointer hover-elevate"
            onClick={() => onFormulaChange(preset.formula)}
            data-testid={`preset-formula-${preset.label}`}
          >
            {preset.label}
          </Badge>
        ))}
      </div>

      <div className="space-y-2">
        <Input
          placeholder="Введите формулу или оставьте пустым"
          value={formula}
          onChange={(e) => onFormulaChange(e.target.value)}
          className={!isFormulaValid ? "border-destructive" : ""}
          data-testid="input-commission-formula"
        />
        {!isFormulaValid && (
          <p className="text-xs text-destructive">Некорректная формула</p>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1">
          <Label className="text-xs text-muted-foreground">Или введите вручную (USD)</Label>
          <Input
            type="number"
            step="0.01"
            placeholder="0.00"
            value={manualCommission}
            onChange={(e) => {
              // Ensure we pass the raw value for the input to remain responsive
              onManualCommissionChange?.(e.target.value);
            }}
            data-testid="input-manual-commission"
          />
        </div>
        <div className="flex-1">
          <Label className="text-xs text-muted-foreground">Расчетная комиссия</Label>
          <div className="h-9 px-3 flex items-center bg-background border rounded-md text-sm font-medium">
            {manualCommission ? formatCurrency(parseFloat(manualCommission), "USD") : formatCurrency(calculatedValue, "USD")}
          </div>
        </div>
      </div>
    </div>
  );
}
