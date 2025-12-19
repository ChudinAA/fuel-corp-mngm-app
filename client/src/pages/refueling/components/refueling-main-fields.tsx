
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import type { UseFormReturn } from "react-hook-form";
import type { Supplier, Customer, Base } from "@shared/schema";
import type { RefuelingFormData } from "../schemas";
import { PRODUCT_TYPES } from "../constants";
import { CUSTOMER_MODULE } from "@shared/constants";

interface RefuelingMainFieldsProps {
  form: UseFormReturn<RefuelingFormData>;
  refuelingSuppliers: Supplier[];
  customers: Customer[] | undefined;
  selectedSupplier: Supplier | undefined;
  selectedBasis: string;
  setSelectedBasis: (value: string) => void;
  availableBases: Base[];
}

export function RefuelingMainFields({
  form,
  refuelingSuppliers,
  customers,
  selectedSupplier,
  selectedBasis,
  setSelectedBasis,
  availableBases,
}: RefuelingMainFieldsProps) {
  return (
    <>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <FormField
          control={form.control}
          name="refuelingDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Дата заправки</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                      data-testid="input-refueling-date"
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
          name="productType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Продукт</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-product-type">
                    <SelectValue placeholder="Выберите продукт" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {PRODUCT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="aircraftNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Бортовой номер</FormLabel>
              <FormControl>
                <Input
                  placeholder="RA-12345"
                  data-testid="input-aircraft-number"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="orderNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Номер РТ</FormLabel>
              <FormControl>
                <Input
                  placeholder="RT-001234"
                  data-testid="input-order-number"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
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
                  {refuelingSuppliers.length > 0 ? (
                    refuelingSuppliers.map((supplier) => (
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
                  {customers?.filter(c => c.module === CUSTOMER_MODULE.REFUELING || c.module === CUSTOMER_MODULE.BOTH).map((buyer) => (
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
          <FormField
            control={form.control}
            name="basis"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Базис</FormLabel>
                <Select 
                  onValueChange={(value) => { 
                    field.onChange(value); 
                    setSelectedBasis(value); 
                  }} 
                  value={field.value || selectedBasis}
                  disabled={availableBases.length === 0}
                >
                  <FormControl>
                    <SelectTrigger data-testid="select-basis">
                      <SelectValue placeholder="Выберите базис" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {availableBases.map((base) => (
                      <SelectItem key={base.id} value={base.name}>
                        {base.name}
                      </SelectItem>
                    ))}
                    {availableBases.length === 0 && (
                      <SelectItem value="none" disabled>Нет данных</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : (
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center">Базис</label>
            <div className="flex items-center gap-2 h-10 px-3 bg-muted rounded-md">
              {selectedBasis || "—"}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
