import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { DateInput } from "@/components/ui/date-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MOVEMENT_TYPE, PRODUCT_TYPE } from "@shared/constants";
import type { UseFormReturn } from "react-hook-form";
import type { MovementFormData } from "../schemas";

interface MovementFormHeaderProps {
  form: UseFormReturn<MovementFormData>;
}

export function MovementFormHeader({ form }: MovementFormHeaderProps) {
  return (
    <>
      <FormField
        control={form.control}
        name="movementDate"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Дата</FormLabel>
            <FormControl>
              <DateInput
                value={field.value ?? undefined}
                onChange={field.onChange}
                data-testid="input-movement-date"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="movementType"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Тип перемещения</FormLabel>
            <Select
              onValueChange={(val) => {
                field.onChange(val);
                form.setValue("supplierId", "", { shouldValidate: false });
                form.setValue("fromWarehouseId", "", { shouldValidate: false });
              }}
              value={field.value}
            >
              <FormControl>
                <SelectTrigger data-testid="select-movement-type">
                  <SelectValue placeholder="Выберите тип" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value={MOVEMENT_TYPE.SUPPLY}>Покупка</SelectItem>
                <SelectItem value={MOVEMENT_TYPE.INTERNAL}>
                  Внутреннее перемещение
                </SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="productType"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Тип продукта</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger data-testid="select-movement-product">
                  <SelectValue placeholder="Выберите тип" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value={PRODUCT_TYPE.KEROSENE}>Керосин</SelectItem>
                <SelectItem value={PRODUCT_TYPE.PVKJ}>ПВКЖ</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}
