import { useState } from "react";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Plus } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import type { UseFormReturn } from "react-hook-form";
import type { Supplier, Customer } from "@shared/schema";
import type { OptFormData } from "../schemas";
import { CUSTOMER_MODULE } from "@shared/constants";
import { AddCustomerDialog } from "@/pages/counterparties/customers-dialog";
import { AddSupplierDialog } from "@/pages/counterparties/suppliers-dialog";
import { useAuth } from "@/hooks/use-auth";

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
  const { hasPermission } = useAuth();
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [addSupplierOpen, setAddSupplierOpen] = useState(false);

  const handleCustomerCreated = (id: string) => {
    form.setValue("buyerId", id);
  };

  const handleSupplierCreated = (id: string) => {
    form.setValue("supplierId", id);
  };

  return (
    <div className="grid gap-2 md:grid-cols-5">
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
        name="supplierId"
        render={({ field }) => (
          <FormItem className="col-span-1 min-w-0">
            <FormLabel>Поставщик</FormLabel>
            <div className="flex gap-1 items-center w-full">
              <FormControl>
                <div className="flex-1 min-w-0">
                  <Combobox
                    options={wholesaleSuppliers.map((s) => ({
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
                    options={
                      selectedSupplier.baseIds
                        .map((baseId) => {
                          const base = wholesaleBases?.find(
                            (b) => b.id === baseId,
                          );
                          return base
                            ? { value: base.name, label: base.name }
                            : null;
                        })
                        .filter(Boolean) as any
                    }
                    value={field.value || selectedBasis}
                    onValueChange={(value) => {
                      field.onChange(value);
                      const base = wholesaleBases?.find(
                        (b) => b.name === value,
                      );
                      if (base) setSelectedBasis(base.name);
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
                      .filter(
                        (c) =>
                          c.module === CUSTOMER_MODULE.WHOLESALE ||
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

      <div className="space-y-2 col-span-1 min-w-0">
        <label className="text-sm font-medium flex items-center h-6">
          Базис Покупателя
        </label>
        <div className="flex items-center gap-2 h-9 px-3 bg-muted rounded-md text-sm overflow-hidden truncate">
          {selectedBasis || "—"}
        </div>
      </div>

      <AddSupplierDialog
        bases={wholesaleBases}
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
    </div>
  );
}
