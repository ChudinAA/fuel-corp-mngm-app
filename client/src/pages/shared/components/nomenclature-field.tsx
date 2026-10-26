import { useEffect } from "react";
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
  const { data: items = [] } = useQuery<any[]>({ queryKey: ["/api/nomenclature"] });
  const options = items.filter((item) => item.typeCode === productType);
  const value = form.watch("nomenclatureId");

  useEffect(() => {
    if (preserveLegacySelection && !value) return;
    if (!options.some((item) => item.id === value)) {
      const preferred = options.find((item) => item.isDefault);
      form.setValue("nomenclatureId", preferred?.id || "", { shouldValidate: true });
    }
  }, [productType, items, value, preserveLegacySelection]);

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
                  {item.name} ({item.unitShortName}){item.isDefault ? " · по умолчанию" : ""}
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
