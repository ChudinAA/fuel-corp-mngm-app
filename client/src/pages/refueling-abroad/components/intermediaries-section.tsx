import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Users, GripVertical } from "lucide-react";
import { CommissionCalculator } from "./commission-calculator";
import { Supplier } from "@shared/schema";
import { formatCurrency } from "../utils";

interface IntermediaryItem {
  id?: string;
  intermediaryId: string;
  orderIndex: number;
  commissionFormula: string;
  commissionUsd: number | null;
  commissionRub: number | null;
  buyCurrencyId?: string;
  sellCurrencyId?: string;
  buyExchangeRate?: number;
  sellExchangeRate?: number;
  crossConversionCost?: number;
  notes: string;
}

interface IntermediariesSectionProps {
  intermediaries: IntermediaryItem[];
  onChange: (intermediaries: IntermediaryItem[]) => void;
  purchasePrice: number;
  salePrice: number;
  quantity: number;
  exchangeRate: number;
  currencies: any[];
}

const formatNumber = (value: number | null | undefined, decimals = 2) => {
  if (value === null || value === undefined) return "-";
  return value.toLocaleString("ru-RU", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

export function IntermediariesSection({
  intermediaries,
  onChange,
  purchasePrice,
  salePrice,
  quantity,
  exchangeRate,
  currencies,
}: IntermediariesSectionProps) {
  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  const intermediarySuppliers = suppliers.filter((s) => s.isIntermediary);

  const handleAdd = () => {
    const newItem: IntermediaryItem = {
      intermediaryId: "",
      orderIndex: intermediaries.length,
      commissionFormula: "",
      commissionUsd: null,
      commissionRub: null,
      notes: "",
    };
    onChange([...intermediaries, newItem]);
  };

  const handleRemove = (index: number) => {
    const updated = intermediaries
      .filter((_, i) => i !== index)
      .map((item, i) => ({ ...item, orderIndex: i }));
    onChange(updated);
  };

  const handleUpdate = (index: number, field: keyof IntermediaryItem, value: any) => {
    const updated = [...intermediaries];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const handleCommissionChange = (
    index: number,
    commissionUsd: number | null,
    commissionRub: number | null,
    formula: string
  ) => {
    const updated = [...intermediaries];
    updated[index] = {
      ...updated[index],
      commissionFormula: formula,
      commissionUsd,
      commissionRub,
    };
    onChange(updated);
  };

  const totalCommissionUsd = intermediaries.reduce(
    (sum, item) => sum + (Number(item.commissionUsd) || 0),
    0
  );
  const totalCommissionRub = intermediaries.reduce(
    (sum, item) => sum + (Number(item.commissionRub) || 0),
    0
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Посредники ({intermediaries.length})
          </CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAdd}
            data-testid="button-add-intermediary"
          >
            <Plus className="h-4 w-4 mr-1" />
            Добавить
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {intermediaries.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            Нет посредников. Нажмите "Добавить" для добавления.
          </div>
        ) : (
          <>
            {intermediaries.map((item, index) => (
              <div
                key={index}
                className="border rounded-md p-4 space-y-4 bg-muted/30"
                data-testid={`intermediary-item-${index}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Посредник #{index + 1}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemove(index)}
                    data-testid={`button-remove-intermediary-${index}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Посредник
                    </label>
                    <Select
                      value={item.intermediaryId || "none"}
                      onValueChange={(value) =>
                        handleUpdate(index, "intermediaryId", value === "none" ? "" : value)
                      }
                    >
                      <SelectTrigger data-testid={`select-intermediary-${index}`}>
                        <SelectValue placeholder="Выберите посредника" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Не выбран</SelectItem>
                        {intermediarySuppliers.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Заметки
                    </label>
                    <Input
                      placeholder="Заметки о посреднике"
                      value={item.notes}
                      onChange={(e) => handleUpdate(index, "notes", e.target.value)}
                      data-testid={`input-intermediary-notes-${index}`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-muted/50 p-3 rounded-md">
                  <div>
                    <label className="text-xs font-medium mb-1 block">Валюта закупа</label>
                    <Select
                      value={item.buyCurrencyId || "none"}
                      onValueChange={(val) => handleUpdate(index, "buyCurrencyId", val === "none" ? undefined : val)}
                    >
                      <SelectTrigger size="default">
                        <SelectValue placeholder="Валюта" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Не выбрана</SelectItem>
                        {currencies.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.code}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Курс закупа</label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={item.buyExchangeRate || ""}
                      onChange={(e) => handleUpdate(index, "buyExchangeRate", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Валюта продажи</label>
                    <Select
                      value={item.sellCurrencyId || "none"}
                      onValueChange={(val) => handleUpdate(index, "sellCurrencyId", val === "none" ? undefined : val)}
                    >
                      <SelectTrigger size="default">
                        <SelectValue placeholder="Валюта" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Не выбрана</SelectItem>
                        {currencies.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.code}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Курс продажи</label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={item.sellExchangeRate || ""}
                      onChange={(e) => handleUpdate(index, "sellExchangeRate", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <CommissionCalculator
                  purchasePrice={purchasePrice}
                  salePrice={salePrice}
                  quantity={quantity}
                  exchangeRate={exchangeRate}
                  commissionFormula={item.commissionFormula || ""}
                  manualCommissionUsd={item.commissionUsd !== null && item.commissionUsd !== undefined ? item.commissionUsd.toString() : ""}
                  buyCurrencyId={item.buyCurrencyId}
                  sellCurrencyId={item.sellCurrencyId}
                  buyExchangeRate={item.buyExchangeRate}
                  sellExchangeRate={item.sellExchangeRate}
                  onFormulaChange={(formula) =>
                    handleUpdate(index, "commissionFormula", formula)
                  }
                  onManualCommissionChange={(usd) => {
                    const parsed = usd === "" ? null : parseFloat(usd);
                    const updated = [...intermediaries];
                    updated[index] = {
                      ...updated[index],
                      commissionUsd: parsed,
                      commissionRub: parsed === null ? null : parsed * exchangeRate
                    };
                    onChange(updated);
                  }}
                  onCommissionCalculated={(usd, rub, crossCost) => {
                    // Update the specific intermediary item directly
                    const updated = [...intermediaries];
                    if (
                      updated[index].commissionUsd !== usd || 
                      updated[index].commissionRub !== rub ||
                      updated[index].crossConversionCost !== crossCost
                    ) {
                      updated[index] = {
                        ...updated[index],
                        commissionUsd: usd,
                        commissionRub: rub,
                        crossConversionCost: crossCost || 0
                      };
                      onChange(updated);
                    }
                  }}
                />
              </div>
            ))}

            {intermediaries.length > 0 && (
              <div className="bg-primary/10 rounded-md p-3">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Итого комиссия посредников:</span>
                  <div className="text-right">
                    <div className="font-medium" data-testid="text-total-commission">
                      {formatCurrency(totalCommissionUsd, "USD")} / {formatCurrency(totalCommissionRub, "RUB")}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
