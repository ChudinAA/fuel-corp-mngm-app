import { Combobox } from "@/components/ui/combobox";
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
  selectedBuyer: Customer | undefined;
  selectedBasis: string;
  setSelectedBasis: (value: string) => void;
  customerBasis: string;
  setCustomerBasis: (value: string) => void;
  availableBases: Base[];
  allBases: Base[] | undefined;
}

export function RefuelingMainFields({
  form,
  refuelingSuppliers,
  customers,
  selectedSupplier,
  selectedBuyer,
  selectedBasis,
  setSelectedBasis,
  customerBasis,
  setCustomerBasis,
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
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

        <FormField
          control={form.control}
          name="flightNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Номер рейса</FormLabel>
              <FormControl>
                <Input
                  placeholder="SU-123"
                  data-testid="input-order-number"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <FormField
          control={form.control}
          name="supplierId"
          render={({ field }) => (
            <FormItem className="col-span-1 min-w-0">
              <FormLabel>Поставщик</FormLabel>
              <div className="flex gap-1 items-center w-full">
                <FormControl>
                  <div className="flex-1 min-w-0">
                    <Combobox
                      options={refuelingSuppliers.map((s) => ({
                        value: s.id,
                        label: s.name,
                      }))}
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder="Выберите поставщика"
                      className="w-full"
                      dataTestId="select-supplier"
                    />
                  </div>
                </FormControl>
                {hasPermission("directories", "create") && (
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => setAddSupplierOpen(true)}
                    data-testid="button-add-supplier-inline"
                    className="shrink-0 h-9 w-9"
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
              <FormItem className="col-span-1 min-w-0">
                <FormLabel>Базис Поставщика</FormLabel>
                <FormControl>
                  <div className="w-full">
                    <Combobox
                      options={availableBases.map((base) => ({
                        value: base.name,
                        label: base.name,
                      }))}
                      value={field.value || selectedBasis}
                      onValueChange={(value) => {
                        field.onChange(value);
                        const base = allBases?.find((b) => b.name === value);
                        if (base) {
                          setSelectedBasis(value);
                          form.setValue("basisId", base.id);
                        }
                      }}
                      placeholder="Выберите базис"
                      dataTestId="select-basis"
                      className="w-full"
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : (
          <div className="space-y-2 col-span-1 min-w-0">
            <label className="text-sm font-medium flex items-center h-6">
              Базис Поставщика
            </label>
            <div className="flex items-center gap-2 h-9 px-3 bg-muted rounded-md text-sm overflow-hidden truncate">
              {selectedBasis || "—"}
            </div>
          </div>
        )}

        <FormField
          control={form.control}
          name="buyerId"
          render={({ field }) => (
            <FormItem className="col-span-1 min-w-0">
              <FormLabel>Покупатель</FormLabel>
              <div className="flex gap-1 items-center w-full">
                <FormControl>
                  <div className="flex-1 min-w-0">
                    <Combobox
                      options={(customers || [])
                        ?.filter(
                          (c) =>
                            c.module === CUSTOMER_MODULE.REFUELING ||
                            c.module === CUSTOMER_MODULE.BOTH,
                        )
                        .map((c) => ({ value: c.id, label: c.name }))}
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder="Выберите покупателя"
                      className="w-full"
                      dataTestId="select-buyer"
                    />
                  </div>
                </FormControl>
                {hasPermission("directories", "create") && (
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => setAddCustomerOpen(true)}
                    data-testid="button-add-customer-inline"
                    className="shrink-0 h-9 w-9"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {selectedBuyer ? (
          <FormField
            control={form.control}
            name="customerBasis"
            render={({ field }) => (
              <FormItem className="col-span-1 min-w-0">
                <FormLabel>Базис Покупателя</FormLabel>
                <FormControl>
                  <div className="w-full">
                    <Combobox
                      options={
                        selectedBuyer?.baseIds &&
                        selectedBuyer.baseIds.length > 0
                          ? (selectedBuyer.baseIds
                              .map((baseId) => {
                                const base = allBases?.find(
                                  (b) => b.id === baseId,
                                );
                                return base
                                  ? { value: base.name, label: base.name }
                                  : null;
                              })
                              .filter(Boolean) as any)
                          : refuelingBases.map((b) => ({
                              value: b.name,
                              label: b.name,
                            }))
                      }
                      value={field.value || customerBasis}
                      onValueChange={(value) => {
                        field.onChange(value);
                        const base = allBases?.find((b) => b.name === value);
                        if (base) {
                          setCustomerBasis(value);
                          form.setValue("customerBasisId", base.id);
                        }
                      }}
                      placeholder="Выберите базис"
                      dataTestId="select-buyer-basis"
                      className="w-full"
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : (
          <div className="space-y-2 col-span-1 min-w-0">
            <label className="text-sm font-medium flex items-center h-6">
              Базис Покупателя
            </label>
            <div className="flex items-center gap-2 h-9 px-3 bg-muted rounded-md text-sm overflow-hidden truncate">
              {customerBasis || "—"}
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
