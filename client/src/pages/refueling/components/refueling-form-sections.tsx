import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import type { UseFormReturn } from "react-hook-form";
import { CalculatedField } from "../calculated-field";
import { formatTonnes } from "@shared/units";
import type { RefuelingFormData } from "../schemas";

interface VolumeInputSectionProps {
  form: UseFormReturn<RefuelingFormData>;
  setInputMode: (mode: "liters" | "tonnes") => void;
  calculatedTonnes: number;
}

export function VolumeInputSection({
  form,
  setInputMode,
  calculatedTonnes,
}: VolumeInputSectionProps) {
  const watchLiters = form.watch("quantityLiters");
  const watchDensity = form.watch("density");
  const inputMode = form.watch("inputMode");

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-lg">Объем топлива</CardTitle>
          <FormField
            control={form.control}
            name="inputMode"
            render={({ field }) => (
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground">
                  Литры/Плотность
                </Label>
                <Switch
                  checked={field.value === "tonnes"}
                  onCheckedChange={(checked) => {
                    const mode = checked ? "tonnes" : "liters";
                    field.onChange(mode);
                    setInputMode(mode);
                  }}
                  data-testid="switch-input-mode"
                />
                <Label className="text-sm text-muted-foreground">Т</Label>
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
                <FormLabel className="flex items-center gap-2">Литры</FormLabel>
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
                <FormLabel className="flex items-center gap-2">
                  Плотность
                </FormLabel>
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
            <CalculatedField
              label="Масса"
              value={
                watchLiters && calculatedTonnes > 0
                  ? formatTonnes(calculatedTonnes)
                  : "—"
              }
              suffix={watchLiters && calculatedTonnes > 0 ? " т" : ""}
              alignWithInputs
            />
          ) : (
            <FormField
              control={form.control}
              name="quantityTonnes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    Масса (т)
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      step="0.00001"
                      placeholder="0.00000"
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
