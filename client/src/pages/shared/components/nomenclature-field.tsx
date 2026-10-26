import { useEffect } from "react";
import { getNomenclatureSelection } from "../utils/nomenclature-selection";
import { useQuery } from "@tanstack/react-query";
import type { UseFormReturn } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function NomenclatureField({
  form,
  productType,
  preserveLegacySelection = false,
}: {
  form: UseFormReturn<any>;
  productType: string;
  preserveLegacySelection?: boolean;
}) {
  const { data: items = [], isSuccess } = useQuery<any[]>({ queryKey: ["/api/nomenclature"] });
  const options = items.filter((item) => item.productType === productType);
  const value = form.watch("nomenclatureId");

  useEffect(() => {
    const next = getNomenclatureSelection(items, productType, value, isSuccess, preserveLegacySelection);
    if (next !== undefined) form.setValue("nomenclatureId", next, { shouldValidate: true });
  }, [productType, items, value, preserveLegacySelection, isSuccess]);

  if (!["kerosene", "pvkj", "service"].includes(productType)) return null;
  return (
    <FormField
      control={form.control}
      name="nomenclatureId"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Номенклатура</FormLabel>
          <Select value={field.value || ""} onValueChange={field.onChange}>
            <FormControl><SelectTrigger><SelectValue placeholder="Выберите номенклатуру" /></SelectTrigger></FormControl>
            <SelectContent>
              {options.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name} ({item.unitShortName}){item.isDefault ? " ✓" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
