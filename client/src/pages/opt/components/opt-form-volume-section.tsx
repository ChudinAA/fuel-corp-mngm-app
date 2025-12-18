
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { UseFormReturn } from "react-hook-form";
import type { OptFormData } from "../schemas";
import { CalculatedField } from "./calculated-field";
import { formatNumber } from "../utils";

interface OptFormVolumeSectionProps {
  form: UseFormReturn<OptFormData>;
  inputMode: "liters" | "kg";
  setInputMode: (mode: "liters" | "kg") => void;
  calculatedKg: string;
}

export function OptFormVolumeSection({
  form,
  inputMode,
  setInputMode,
  calculatedKg,
}: OptFormVolumeSectionProps) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-lg">Объем топлива</CardTitle>
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">Литры/Плотность</Label>
            <Switch
              checked={inputMode === "kg"}
              onCheckedChange={(checked) => setInputMode(checked ? "kg" : "liters")}
              data-testid="switch-input-mode"
            />
            <Label className="text-sm text-muted-foreground">КГ</Label>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          {inputMode === "liters" ? (
            <>
              <FormField
                control={form.control}
                name="quantityLiters"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Литры</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        data-testid="input-liters"
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
                    <FormLabel>Плотность</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.0001"
                        placeholder="0.8000"
                        data-testid="input-density"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <CalculatedField
                label="КГ (расчет)"
                value={formatNumber(calculatedKg)}
                suffix=" кг"
              />
            </>
          ) : (
            <FormField
              control={form.control}
              name="quantityKg"
              render={({ field }) => (
                <FormItem className="md:col-span-3">
                  <FormLabel>Количество (КГ)</FormLabel>
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
