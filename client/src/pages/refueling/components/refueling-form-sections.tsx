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
import { formatNumber } from "../utils";
import type { RefuelingFormData } from "../schemas";

interface VolumeInputSectionProps {
  form: UseFormReturn<RefuelingFormData>;
  inputMode: "liters" | "kg";
  setInputMode: (mode: "liters" | "kg") => void;
  calculatedKg: string;
}

export function VolumeInputSection({
  form,
  inputMode,
  setInputMode,
  calculatedKg,
}: VolumeInputSectionProps) {
  const watchLiters = form.watch("quantityLiters");
  const watchDensity = form.watch("density");

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-lg">Объем топлива</CardTitle>
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">
              Литры/Плотность
            </Label>
            <Switch
              checked={inputMode === "kg"}
              onCheckedChange={(checked) =>
                setInputMode(checked ? "kg" : "liters")
              }
              data-testid="switch-input-mode"
            />
            <Label className="text-sm text-muted-foreground">КГ</Label>
          </div>
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
                    disabled={inputMode === "kg"}
                    {...field}
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
                    disabled={inputMode === "kg"}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {inputMode === "liters" ? (
            <CalculatedField
              label="КГ (расчет)"
              value={
                watchLiters && watchDensity ? formatNumber(calculatedKg) : "—"
              }
              suffix={watchLiters && watchDensity ? " кг" : ""}
            />
          ) : (
            <FormField
              control={form.control}
              name="quantityKg"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    Количество (КГ)
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      data-testid="input-kg"
                      {...field}
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
