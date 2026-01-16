import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Plus } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import type { UseFormReturn } from "react-hook-form";
import type { Supplier, Customer, Base } from "@shared/schema";
import type { RefuelingFormData } from "../schemas";
import { PRODUCT_TYPES } from "../constants";
import { BASE_TYPE, CUSTOMER_MODULE } from "@shared/constants";
import { useState } from "react";
import { AddSupplierDialog } from "@/pages/counterparties/suppliers-dialog";
import { AddCustomerDialog } from "@/pages/counterparties/customers-dialog";
import { useAuth } from "@/hooks/use-auth";

interface RefuelingMainFieldsProps {
  form: UseFormReturn<RefuelingFormData>;
  refuelingSuppliers: Supplier[];
  customers: Customer[] | undefined;
  selectedSupplier: Supplier | undefined;
  selectedBasis: string;
  setSelectedBasis: (value: string) => void;
  availableBases: Base[];
  allBases: Base[] | undefined;
}

export function RefuelingMainFields({
  form,
  refuelingSuppliers,
  customers,
  selectedSupplier,
  selectedBasis,
  setSelectedBasis,
  availableBases,
  allBases,
}: RefuelingMainFieldsProps) {
  const { hasPermission } = useAuth();

  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [addSupplierOpen, setAddSupplierOpen] = useState(false);

  const handleCustomerCreated = (id: string) => {
    form.setValue("buyerId", id);
  };

  const handleSupplierCreated = (id: string) => {
    form.setValue("supplierId", id);
  };

  const refuelingBases =
    allBases?.filter((b) => b.baseType === BASE_TYPE.REFUELING) || [];

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
                      {field.value
                        ? format(field.value, "dd.MM.yyyy", { locale: ru })
                        : "Выберите дату"}
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

      <div className="grid gap-4 md:grid-cols-3">
        <FormField
          control={form.control}
          name="supplierId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Поставщик</FormLabel>
              <div className="flex gap-1">
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger
                      data-testid="select-supplier"
                      className="flex-1"
                    >
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
                      <SelectItem value="none" disabled>
                        Нет данных
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {hasPermission("directories", "create") && (
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => setAddSupplierOpen(true)}
                    data-testid="button-add-supplier-inline"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              </div>
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
              <div className="flex gap-1">
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger
                      data-testid="select-buyer"
                      className="flex-1"
                    >
                      <SelectValue placeholder="Выберите покупателя" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {customers
                      ?.filter(
                        (c) =>
                          c.module === CUSTOMER_MODULE.REFUELING ||
                          c.module === CUSTOMER_MODULE.BOTH,
                      )
                      .map((buyer) => (
                        <SelectItem key={buyer.id} value={buyer.id}>
                          {buyer.name}
                        </SelectItem>
                      )) || (
                      <SelectItem value="none" disabled>
                        Нет данных
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {hasPermission("directories", "create") && (
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => setAddCustomerOpen(true)}
                    data-testid="button-add-customer-inline"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {selectedSupplier &&
        selectedSupplier.baseIds &&
        selectedSupplier.baseIds.length > 0 ? (
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
                      <SelectItem value="none" disabled>
                        Нет данных
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : (
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center">
              Базис
            </label>
            <div className="flex items-center gap-2 h-10 px-3 bg-muted rounded-md">
              {selectedBasis || "—"}
            </div>
          </div>
        )}
      </div>

      <AddSupplierDialog
        bases={refuelingBases}
        isInline
        inlineOpen={addSupplierOpen}
        onInlineOpenChange={setAddSupplierOpen}
        onCreated={handleSupplierCreated}
      />

      <AddCustomerDialog
        isInline
        inlineOpen={addCustomerOpen}
        onInlineOpenChange={setAddCustomerOpen}
        onCreated={handleCustomerCreated}
      />
    </>
  );
}
