
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
import type { Supplier, Customer, Warehouse } from "@shared/schema";
import type { OptFormData } from "../schemas";
import { CUSTOMER_MODULE } from "@shared/constants";

interface OptMainFieldsProps {
  form: UseFormReturn<OptFormData>;
  wholesaleSuppliers: Supplier[];
  customers: Customer[] | undefined;
  selectedSupplier: Supplier | undefined;
  selectedBasis: string;
  setSelectedBasis: (value: string) => void;
  wholesaleBases: any[];
}

export function OptMainFields({
  form,
  wholesaleSuppliers,
  customers,
  selectedSupplier,
  selectedBasis,
  setSelectedBasis,
  wholesaleBases,
}: OptMainFieldsProps) {
  return (
    <div className="grid gap-6 md:grid-cols-4">
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
                {customers?.filter(c => c.module === CUSTOMER_MODULE.WHOLESALE || c.module === CUSTOMER_MODULE.BOTH).map((buyer) => (
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

      {selectedSupplier && selectedSupplier.baseIds && selectedSupplier.baseIds.length > 1 ? (
        <FormItem>
          <FormLabel className="flex items-center gap-2">Базис</FormLabel>
          <Select 
            value={selectedBasis} 
            onValueChange={(value) => {
              const base = wholesaleBases?.find(b => b.name === value);
              if (base) setSelectedBasis(base.name);
            }}
          >
            <FormControl>
              <SelectTrigger data-testid="select-basis">
                <SelectValue placeholder="Выберите базис" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {selectedSupplier.baseIds.map((baseId) => {
                const base = wholesaleBases?.find(b => b.id === baseId);
                return base ? (
                  <SelectItem key={base.id} value={base.name}>
                    {base.name}
                  </SelectItem>
                ) : null;
              })}
            </SelectContent>
          </Select>
        </FormItem>
      ) : (
        <div className="space-y-2">
          <label className="text-sm font-medium">Базис</label>
          <div className="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm">
            {selectedBasis || "—"}
          </div>
        </div>
      )}
    </div>
  );
}
