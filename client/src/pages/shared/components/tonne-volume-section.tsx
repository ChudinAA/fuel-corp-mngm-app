import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  litresAndDensityToTonnes,
  formatTonnes,
  formatTonnesForInput,
} from "@shared/units";
import type { UseFormReturn } from "react-hook-form";

export type TonneVolumeInputMode = "liters" | "tonnes";

interface TonneVolumeSectionProps {
  form: UseFormReturn<any>;
  setInputMode: (mode: TonneVolumeInputMode) => void;
}

function getCalculatedTonnes(
  litersValue: string | number | null | undefined,
  densityValue: string | number | null | undefined,
): number | null {
  const liters = Number(litersValue);
  const density = Number(densityValue);
  if (
    !Number.isFinite(liters) ||
    liters <= 0 ||
    !Number.isFinite(density) ||
    density <= 0
  ) {
    return null;
  }
  return litresAndDensityToTonnes(liters, density);
}

export function TonneVolumeSection({
  form,
  setInputMode,
}: TonneVolumeSectionProps) {
  const watchLiters = form.watch("quantityLiters");
  const watchDensity = form.watch("density");
  const inputMode = form.watch("inputMode") ?? "tonnes";
  const calculatedTonnes = getCalculatedTonnes(watchLiters, watchDensity);

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-lg">Объём и масса</CardTitle>
          <FormField
            control={form.control}
            name="inputMode"
            render={({ field }) => (
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground">Литры</Label>
                <Switch
                  checked={field.value === "tonnes"}
                  onCheckedChange={(checked) => {
                    const mode: TonneVolumeInputMode = checked
                      ? "tonnes"
                      : "liters";
                    if (mode === "tonnes") {
                      const tonnes = getCalculatedTonnes(
                        form.getValues("quantityLiters"),
                        form.getValues("density"),
                      );
                      form.setValue(
                        "quantityTonnes",
                        tonnes === null ? "" : formatTonnesForInput(tonnes),
                        {
                          shouldDirty: true,
                          shouldValidate: true,
                        },
                      );
                    } else {
                      const tonnes = Number(form.getValues("quantityTonnes"));
                      const density = Number(form.getValues("density"));
                      form.setValue(
                        "quantityLiters",
                        Number.isFinite(tonnes) && tonnes > 0 && density > 0
                          ? ((tonnes * 1_000) / density).toString()
                          : "",
                        { shouldDirty: true, shouldValidate: true },
                      );
                    }
                    field.onChange(mode);
                    setInputMode(mode);
                  }}
                  data-testid="switch-input-mode"
                />
                <Label className="text-sm text-muted-foreground">Тонны</Label>
              </div>
            )}
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          <FormField
            control={form.control}
            name="quantityLiters"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Объём (л)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    data-testid="input-liters"
                    disabled={inputMode === "tonnes"}
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="density"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Плотность (кг/л)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    step="0.0001"
                    placeholder="0.8000"
                    data-testid="input-density"
                    disabled={inputMode === "tonnes"}
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {inputMode === "liters" ? (
            <div className="space-y-2">
              <Label>Расчётная масса</Label>
              <div className="flex h-10 items-center rounded-md border bg-muted/30 px-3 text-sm tabular-nums">
                {calculatedTonnes === null
                  ? "—"
                  : `${formatTonnes(calculatedTonnes)} т`}
              </div>
            </div>
          ) : (
            <FormField
              control={form.control}
              name="quantityTonnes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Масса (т)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      step="0.00001"
                      placeholder="0"
                      data-testid="input-quantity-tonnes"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
