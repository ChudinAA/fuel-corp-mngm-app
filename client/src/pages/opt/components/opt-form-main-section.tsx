
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import type { UseFormReturn } from "react-hook-form";
import type { OptFormData } from "../schemas";
import type { Supplier, Customer, Base } from "@shared/schema";

interface OptFormMainSectionProps {
  form: UseFormReturn<OptFormData>;
  suppliers?: Supplier[];
  customers?: Customer[];
  bases?: Base[];
  selectedSupplier?: Supplier;
  supplierWarehouseName?: string;
  isWarehouseSupplier: boolean;
}

export function OptFormMainSection({
  form,
  suppliers,
  customers,
  bases,
  selectedSupplier,
  supplierWarehouseName,
  isWarehouseSupplier,
}: OptFormMainSectionProps) {
  const wholesaleSuppliers = suppliers?.filter(supplier => {
    if (!supplier.baseIds || supplier.baseIds.length === 0) return false;
    return bases?.some(base =>
      supplier.baseIds.includes(base.id) && base.baseType === 'wholesale'
    );
  }) || [];

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      <FormField
        control={form.control}
        name="dealDate"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Дата сделки</FormLabel>
            <Popover>
              <PopoverTrigger asChild>
                <FormControl>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    data-testid="input-deal-date"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {field.value ? format(field.value, "dd.MM.yyyy", { locale: ru }) : "Выберите дату"}
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={field.value}
                  onSelect={field.onChange}
                  locale={ru}
                />
              </PopoverContent>
            </Popover>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="supplierId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Поставщик</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger data-testid="select-supplier">
                  <SelectValue placeholder="Выберите поставщика" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {wholesaleSuppliers.length > 0 ? (
                  wholesaleSuppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>Нет данных</SelectItem>
                )}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="buyerId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Покупатель</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger data-testid="select-buyer">
                  <SelectValue placeholder="Выберите покупателя" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {customers?.filter(c => c.module === "wholesale" || c.module === "both").map((buyer) => (
                  <SelectItem key={buyer.id} value={buyer.id}>
                    {buyer.name}
                  </SelectItem>
                )) || (
                  <SelectItem value="none" disabled>Нет данных</SelectItem>
                )}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormItem>
        <FormLabel>Склад</FormLabel>
        <FormControl>
          <Input
            value={
              isWarehouseSupplier && supplierWarehouseName
                ? supplierWarehouseName
                : "Объем не со склада"
            }
            disabled
            className="bg-muted"
          />
        </FormControl>
      </FormItem>
    </div>
  );
}
