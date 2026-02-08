import { Combobox } from "@/components/ui/combobox";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarIcon, X, Plus } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import type {
  Control,
  FieldArrayWithId,
  UseFieldArrayRemove,
  UseFieldArrayAppend,
} from "react-hook-form";
import { useWatch } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import type { PriceFormData } from "../types";
import type { Base, Supplier, Customer, Currency } from "@shared/schema";
import {
  PRODUCT_TYPE,
  COUNTERPARTY_TYPE,
  COUNTERPARTY_ROLE,
} from "@shared/constants";
import { AddBaseDialog } from "@/pages/directories/bases-dialog";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { BaseTypeBadge } from "@/components/base-type-badge";

interface PriceFormFieldsProps {
  control: Control<PriceFormData>;
  contractors: Array<Supplier | Customer>;
  availableBases: Base[];
  fields: FieldArrayWithId<PriceFormData, "priceValues", "id">[];
  remove: UseFieldArrayRemove;
  append: UseFieldArrayAppend<PriceFormData, "priceValues">;
}

export function PriceFormFields({
  control,
  contractors,
  availableBases,
  fields,
  remove,
  append,
}: PriceFormFieldsProps) {
  const { hasPermission } = useAuth();
  const [addBaseOpen, setAddBaseOpen] = useState(false);
  
  const counterpartyType = useWatch({ control, name: "counterpartyType" });
  const { data: currencies } = useQuery<Currency[]>({ 
    queryKey: ["/api/currencies"] 
  });

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={control}
          name="dateFrom"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Срок действия ОТ</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                      data-testid="input-date-from"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {field.value
                        ? format(field.value, "dd.MM.yyyy", { locale: ru })
                        : "Выберите"}
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
          control={control}
          name="dateTo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Срок действия ДО</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                      data-testid="input-date-to"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {field.value
                        ? format(field.value, "dd.MM.yyyy", { locale: ru })
                        : "Выберите"}
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
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={control}
          name="counterpartyType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Тип сделки</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-counterparty-type">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={COUNTERPARTY_TYPE.WHOLESALE}>
                    ОПТ
                  </SelectItem>
                  <SelectItem value={COUNTERPARTY_TYPE.REFUELING}>
                    Заправка ВС
                  </SelectItem>
                  <SelectItem value={COUNTERPARTY_TYPE.REFUELING_ABROAD}>
                    Заправка ВС Зарубеж
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="counterpartyRole"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Роль контрагента</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-counterparty-role">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={COUNTERPARTY_ROLE.SUPPLIER}>
                    Поставщик
                  </SelectItem>
                  <SelectItem value={COUNTERPARTY_ROLE.BUYER}>
                    Покупатель
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="currencyId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Валюта</FormLabel>
              <FormControl>
                <Combobox
                  options={currencies?.map(c => ({ value: c.id, label: c.code })) || []}
                  value={field.value}
                  onValueChange={(val) => {
                    field.onChange(val);
                    const selected = currencies?.find(c => c.id === val);
                    if (selected) {
                      control._formValues.currency = selected.code;
                    }
                  }}
                  placeholder="Выберите валюту"
                  className="w-full"
                  dataTestId="select-currency"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={control}
          name="counterpartyId"
          render={({ field }) => (
            <FormItem className="col-span-1 min-w-0">
              <FormLabel>Контрагент</FormLabel>
              <FormControl>
                <div className="w-full">
                  <Combobox
                    options={contractors?.map((c) => ({ value: c.id, label: c.name })) || []}
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder="Выберите контрагента"
                    className="w-full"
                    dataTestId="select-counterparty"
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="productType"
          render={({ field }) => (
            <FormItem className="col-span-1 min-w-0">
              <FormLabel>Тип продукта</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-product-type">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={PRODUCT_TYPE.KEROSENE}>Керосин</SelectItem>
                  <SelectItem value={PRODUCT_TYPE.SERVICE}>Услуга</SelectItem>
                  <SelectItem value={PRODUCT_TYPE.PVKJ}>ПВКЖ</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={control}
          name="basisId"
          render={({ field }) => (
            <FormItem className="col-span-1 min-w-0">
              <FormLabel>Базис (место поставки/заправки)</FormLabel>
              <div className="flex gap-1 items-center w-full">
                <FormControl>
                  <div className="flex-1 min-w-0">
                    <Combobox
                      options={availableBases?.map((b) => ({
                        value: b.id,
                        label: b.name,
                        render: (
                          <div className="flex items-center gap-2">
                            {b.name}
                            <BaseTypeBadge type={b.baseType} short={true} />
                          </div>
                        )
                      })) || []}
                      value={field.value}
                      onValueChange={(val) => {
                        field.onChange(val);
                        const selectedBase = availableBases.find(b => b.id === val);
                        if (selectedBase) {
                          control._formValues.basis = selectedBase.name;
                        }
                      }}
                      placeholder="Выберите базис"
                      className="w-full"
                      dataTestId="select-basis"
                    />
                  </div>
                </FormControl>
                {hasPermission("directories", "create") && (
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => setAddBaseOpen(true)}
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

        <FormField
          control={control}
          name="volume"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Объем по договору (кг)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Объем поставки"
                  data-testid="input-volume"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="space-y-3">
        <FormLabel>Цены (добавьте одну или несколько)</FormLabel>
        {fields.map((field, index) => (
          <div key={field.id} className="flex gap-2 items-end">
            <FormField
              control={control}
              name={`priceValues.${index}.price`}
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <Input
                      type="number"
                      step="0.00001"
                      min="0"
                      placeholder="Цена за кг (₽)"
                      data-testid={`input-price-${index}`}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {fields.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => remove(index)}
                data-testid={`button-remove-price-${index}`}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            {index === fields.length - 1 && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => append({ price: "" })}
                data-testid="button-add-price-field"
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>

      <FormField
        control={control}
        name="contractNumber"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Номер договора (опционально)</FormLabel>
            <FormControl>
              <Input
                placeholder="№ договора"
                data-testid="input-contract-number"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="notes"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Примечание (опционально)</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Дополнительная информация"
                data-testid="input-notes"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <AddBaseDialog
        isInline
        inlineOpen={addBaseOpen}
        onInlineOpenChange={setAddBaseOpen}
      />
    </>
  );
}
