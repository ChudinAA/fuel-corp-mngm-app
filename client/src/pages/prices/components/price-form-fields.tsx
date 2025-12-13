
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, X, Plus } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import type { Control, FieldArrayWithId, UseFieldArrayRemove, UseFieldArrayAppend } from "react-hook-form";
import type { PriceFormData } from "../types";
import type { Base, Supplier, Customer } from "@shared/schema";

interface PriceFormFieldsProps {
  control: Control<PriceFormData>;
  contractors: Array<Supplier | Customer>;
  availableBases: Base[];
  fields: FieldArrayWithId<PriceFormData, "priceValues", "id">[];
  remove: UseFieldArrayRemove;
  append: UseFieldArrayAppend<PriceFormData, "priceValues">;
}

export function PriceFormFields({ control, contractors, availableBases, fields, remove, append }: PriceFormFieldsProps) {
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
                    <Button variant="outline" className="w-full justify-start text-left font-normal" data-testid="input-date-from">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {field.value ? format(field.value, "dd.MM.yyyy", { locale: ru }) : "Выберите"}
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
          control={control}
          name="dateTo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Срок действия ДО</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button variant="outline" className="w-full justify-start text-left font-normal" data-testid="input-date-to">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {field.value ? format(field.value, "dd.MM.yyyy", { locale: ru }) : "Выберите"}
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
                  <SelectItem value="wholesale">ОПТ</SelectItem>
                  <SelectItem value="refueling">Заправка ВС</SelectItem>
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
                  <SelectItem value="supplier">Поставщик</SelectItem>
                  <SelectItem value="buyer">Покупатель</SelectItem>
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
          name="counterpartyId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Контрагент</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-counterparty">
                    <SelectValue placeholder="Выберите контрагента" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {contractors?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  )) || <SelectItem value="none" disabled>Нет данных</SelectItem>}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="productType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Тип продукта</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-product-type">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="kerosine">Керосин</SelectItem>
                  <SelectItem value="service">Услуга</SelectItem>
                  <SelectItem value="pvkj">ПВКЖ</SelectItem>
                  <SelectItem value="agent">Агентские</SelectItem>
                  <SelectItem value="storage">Хранение</SelectItem>
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
          name="basis"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Базис (место поставки/заправки)</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-basis">
                    <SelectValue placeholder="Выберите базис" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {availableBases?.length > 0 ? availableBases.map((b) => (
                    <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
                  )) : <SelectItem value="none" disabled>Нет доступных базисов</SelectItem>}
                </SelectContent>
              </Select>
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
                      step="0.0001" 
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
              <Input placeholder="№ договора" data-testid="input-contract-number" {...field} />
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
              <Textarea placeholder="Дополнительная информация" data-testid="input-notes" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}
