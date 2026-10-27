import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CalculatedField } from "../calculated-field";
import { formatNumber } from "../utils";

export interface RefuelingVolume {
  inputMode: "liters" | "kg";
  quantityLiters: string;
  density: string;
  quantityKg: string;
}

interface ProductVolumeSectionProps {
  productLabel: string;
  value: RefuelingVolume;
  onChange: (value: RefuelingVolume) => void;
  kgOnly?: boolean;
}

function getKg(volume: RefuelingVolume): number {
  if (volume.inputMode === "kg") {
    const kg = Number.parseFloat(volume.quantityKg);
    return Number.isFinite(kg) ? kg : 0;
  }
  const liters = Number.parseFloat(volume.quantityLiters);
  const density = Number.parseFloat(volume.density);
  return Number.isFinite(liters) && Number.isFinite(density)
    ? liters * density
    : 0;
}

export function ProductVolumeSection({
  productLabel,
  value,
  onChange,
  kgOnly = false,
}: ProductVolumeSectionProps) {
  const calculatedKg = useMemo(() => getKg(value), [value]);
  const mode = kgOnly ? "kg" : value.inputMode;

  const setMode = (nextMode: "liters" | "kg") => {
    if (nextMode === mode) return;
    if (nextMode === "kg") {
      onChange({
        ...value,
        inputMode: "kg",
        quantityKg: calculatedKg > 0 ? String(calculatedKg) : value.quantityKg,
      });
      return;
    }
    const density = Number.parseFloat(value.density) || 0.8;
    onChange({
      ...value,
      inputMode: "liters",
      density: String(density),
      quantityLiters:
        calculatedKg > 0 ? String(calculatedKg / density) : value.quantityLiters,
    });
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-base">Объем топлива · {productLabel}</CardTitle>
          {!kgOnly && (
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground">Литры/Плотность</Label>
              <Switch
                checked={mode === "kg"}
                onCheckedChange={(checked) => setMode(checked ? "kg" : "liters")}
              />
              <Label className="text-sm text-muted-foreground">КГ</Label>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          {!kgOnly && (
            <>
              <div className="space-y-2">
                <Label>Литры</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={value.quantityLiters}
                  disabled={mode === "kg"}
                  onChange={(event) =>
                    onChange({ ...value, quantityLiters: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Плотность</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.0001"
                  value={value.density}
                  disabled={mode === "kg"}
                  onChange={(event) =>
                    onChange({ ...value, density: event.target.value })
                  }
                />
              </div>
            </>
          )}
          {mode === "liters" ? (
            <CalculatedField
              label="КГ (расчет)"
              value={calculatedKg > 0 ? formatNumber(calculatedKg) : "—"}
              suffix={calculatedKg > 0 ? " кг" : ""}
              alignWithInputs
            />
          ) : (
            <div className="space-y-2">
              <Label>Количество (КГ)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={value.quantityKg}
                onChange={(event) =>
                  onChange({ ...value, quantityKg: event.target.value })
                }
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
