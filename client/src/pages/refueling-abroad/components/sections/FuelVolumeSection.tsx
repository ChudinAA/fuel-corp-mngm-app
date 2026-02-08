import { useFormContext } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

export function FuelVolumeSection() {
  const { control, watch } = useFormContext();
  const inputMode = watch("inputMode");

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Объем топлива</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField
          control={control}
          name="inputMode"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <RadioGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="kg" id="mode-kg" />
                    <Label htmlFor="mode-kg">Ввод в кг</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="liters" id="mode-liters" />
                    <Label htmlFor="mode-liters">Ввод в литрах</Label>
                  </div>
                </RadioGroup>
              </FormControl>
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {inputMode === "liters" ? (
            <>
              <FormField
                control={control}
                name="quantityLiters"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Литры</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        value={field.value || ""}
                        data-testid="input-quantity-liters"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="density"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Плотность</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.0001"
                        {...field}
                        value={field.value || ""}
                        data-testid="input-density"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </>
          ) : (
            <FormField
              control={control}
              name="quantityKg"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Килограммы</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      {...field}
                      value={field.value || ""}
                      data-testid="input-quantity-kg"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          )}
        </div>

        <FormField
          control={control}
          name="isApproxVolume"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-2">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>Объем по требованию (приблизительный)</FormLabel>
              </div>
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
}
