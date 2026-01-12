import { useState } from "react";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Plus } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import type { UseFormReturn } from "react-hook-form";
import type { Supplier, Customer, LogisticsCarrier, Base } from "@shared/schema";
import type { OptFormData } from "../schemas";
import { CUSTOMER_MODULE } from "@shared/constants";
import { AddCustomerDialog } from "@/pages/directories/customers-dialog";
import { AddSupplierDialog } from "@/pages/directories/suppliers-dialog";

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
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [addSupplierOpen, setAddSupplierOpen] = useState(false);

  const handleCustomerCreated = (id: string) => {
    form.setValue("buyerId", id);
  };

  const handleSupplierCreated = (id: string) => {
    form.setValue("supplierId", id);
  };
  
  return (
    <div className="grid gap-4 md:grid-cols-4">
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
            <div className="flex gap-1">
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-supplier" className="flex-1">
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
              <Button 
                type="button" 
                size="icon" 
                variant="outline"
                onClick={() => setAddSupplierOpen(true)}
                data-testid="button-add-supplier-inline"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <FormMessage />
          </FormItem>
        )}
      />

      {selectedSupplier && selectedSupplier.baseIds && selectedSupplier.baseIds.length > 0 ? (
        <FormItem>
          <FormLabel>Базис</FormLabel>
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
          <label className="text-sm font-medium flex items-center">Базис</label>
          <div className="flex items-center gap-2 h-10 px-3 bg-muted rounded-md">
            {selectedBasis || "—"}
          </div>
        </div>
      )}
      
      <FormField
        control={form.control}
        name="buyerId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Покупатель</FormLabel>
            <div className="flex gap-1">
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-buyer" className="flex-1">
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
              <Button 
                type="button" 
                size="icon" 
                variant="outline"
                onClick={() => setAddCustomerOpen(true)}
                data-testid="button-add-customer-inline"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <FormMessage />
          </FormItem>
        )}
      />

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
