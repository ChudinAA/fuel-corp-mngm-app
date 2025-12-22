
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
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
            <Popover>
              <PopoverTrigger asChild>
                <FormControl>
                  <Button variant="outline" className="w-full justify-start text-left font-normal" data-testid="input-movement-date">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {field.value ? format(field.value, "dd.MM.yyyy", { locale: ru }) : "Выберите дату"}
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={field.value} onSelect={field.onChange} locale={ru} />
              </PopoverContent>
            </Popover>
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
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger data-testid="select-movement-type">
                  <SelectValue placeholder="Выберите тип" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value={MOVEMENT_TYPE.SUPPLY}>Покупка</SelectItem>
                <SelectItem value={MOVEMENT_TYPE.INTERNAL}>Внутреннее перемещение</SelectItem>
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
