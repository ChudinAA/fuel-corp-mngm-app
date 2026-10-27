import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CalculatedField } from "../calculated-field";
import { formatTonnes } from "@shared/units";

export interface RefuelingVolume {
  inputMode: "liters" | "tonnes";
  quantityLiters: string;
  density: string;
  quantityTonnes: string;
}

interface ProductVolumeSectionProps {
  productLabel: string;
  value: RefuelingVolume;
  onChange: (value: RefuelingVolume) => void;
  kgOnly?: boolean;
}

function getTonnes(volume: RefuelingVolume): number {
  if (volume.inputMode === "tonnes") {
    const tonnes = Number.parseFloat(volume.quantityTonnes);
    return Number.isFinite(tonnes) ? tonnes : 0;
  }
  const liters = Number.parseFloat(volume.quantityLiters);
  const density = Number.parseFloat(volume.density);
  return Number.isFinite(liters) && Number.isFinite(density)
    ? (liters * density) / 1_000
    : 0;
}

export function ProductVolumeSection({
  productLabel,
  value,
  onChange,
  kgOnly = false,
}: ProductVolumeSectionProps) {
  const calculatedTonnes = useMemo(() => getTonnes(value), [value]);
  const mode = kgOnly ? "tonnes" : value.inputMode;

  const setMode = (nextMode: "liters" | "tonnes") => {
    if (nextMode === mode) return;
    if (nextMode === "tonnes") {
      onChange({
        ...value,
        inputMode: "tonnes",
        quantityTonnes:
          calculatedTonnes > 0
            ? String(calculatedTonnes)
            : value.quantityTonnes,
      });
      return;
    }
    const density = Number.parseFloat(value.density) || 0.8;
    onChange({
      ...value,
      inputMode: "liters",
      density: String(density),
      quantityLiters:
        calculatedTonnes > 0
          ? String((calculatedTonnes * 1_000) / density)
          : value.quantityLiters,
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
                checked={mode === "tonnes"}
                onCheckedChange={(checked) =>
                  setMode(checked ? "tonnes" : "liters")
                }
              />
              <Label className="text-sm text-muted-foreground">Тонны</Label>
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
                  disabled={mode === "tonnes"}
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
                  disabled={mode === "tonnes"}
                  onChange={(event) =>
                    onChange({ ...value, density: event.target.value })
                  }
                />
              </div>
            </>
          )}
          {mode === "liters" ? (
            <CalculatedField
              label="Масса (т)"
              value={
                calculatedTonnes > 0 ? formatTonnes(calculatedTonnes) : "—"
              }
              suffix={calculatedTonnes > 0 ? " т" : ""}
              alignWithInputs
            />
          ) : (
            <div className="space-y-2">
              <Label>Масса (т)</Label>
              <Input
                type="number"
                min="0"
                step="0.00001"
                value={value.quantityTonnes}
                onChange={(event) =>
                  onChange({ ...value, quantityTonnes: event.target.value })
                }
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
