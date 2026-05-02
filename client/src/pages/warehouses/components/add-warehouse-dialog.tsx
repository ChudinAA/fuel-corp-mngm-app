
import React, { useState } from "react";
import { Combobox } from "@/components/ui/combobox";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Loader2, X, Building2, Globe2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useErrorModal } from "@/hooks/use-error-modal";
import type { Warehouse } from "@shared/schema";
import { EQUIPMENT_TYPE } from "@shared/constants";
import { newWarehouseFormSchema } from "../schemas";
import type { NewWarehouseFormValues } from "../types";
import { BaseTypeBadge } from "@/components/base-type-badge";
import { useAuth } from "@/hooks/use-auth";
import { AddBaseDialog } from "@/pages/directories/bases-dialog";

interface AddWarehouseDialogProps {
  warehouseToEdit: Warehouse | null;
  onSave: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const SERVICE_TYPE_OPTIONS = [
  { value: "royalty_per_ton", label: "Роялти с тонны" },
  { value: "percent_of_amount", label: "Процент от суммы" },
  { value: "fixed", label: "Фиксированная сумма" },
];

const SERVICE_TYPE_PLACEHOLDER: Record<string, string> = {
  royalty_per_ton: "₽ / тонну",
  percent_of_amount: "% от суммы",
  fixed: "Фикс. сумма (₽)",
};

export function AddWarehouseDialog({ 
  warehouseToEdit, 
  onSave, 
  open: externalOpen, 
  onOpenChange: externalOnOpenChange 
}: AddWarehouseDialogProps) {

  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const { showError, ErrorModalComponent } = useErrorModal();
  const [internalOpen, setInternalOpen] = useState(false);
  const [addBaseOpen, setAddBaseOpen] = useState(false);

  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = externalOnOpenChange || setInternalOpen;

  const isEditing = !!warehouseToEdit;

  const { data: bases } = useQuery({
    queryKey: ["/api/bases"],
  });

  const allBases = (bases?.map(b => ({ id: b.id, name: b.name, baseType: b.baseType })) || [])
    .sort((a, b) => a.name.localeCompare(b.name));

  const form = useForm<NewWarehouseFormValues>({
    resolver: zodResolver(newWarehouseFormSchema),
    defaultValues: {
      name: "",
      bases: [{ baseId: "" }],
      storageCost: "",
      createSupplier: false,
      isBase: false,
      isExport: false,
      services: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "bases",
  });

  const {
    fields: serviceFields,
    append: appendService,
    remove: removeService,
  } = useFieldArray({
    control: form.control,
    name: "services",
  });

  React.useEffect(() => {
    if (warehouseToEdit) {
      const basesList = warehouseToEdit.baseIds && warehouseToEdit.baseIds.length > 0 
        ? warehouseToEdit.baseIds.map(id => ({ baseId: id }))
        : [{ baseId: "" }];
      
      form.reset({
        name: warehouseToEdit.name,
        bases: basesList,
        storageCost: warehouseToEdit.storageCost || "",
        createSupplier: !!warehouseToEdit.supplierId,
        isBase: warehouseToEdit.equipmentType === EQUIPMENT_TYPE.LIK,
        isExport: warehouseToEdit.isExport ?? false,
        services: (warehouseToEdit.services || []).map(s => ({
          serviceType: s.serviceType,
          serviceValue: s.serviceValue,
        })),
      });
    } else {
      form.reset({
        name: "",
        bases: [{ baseId: "" }],
        storageCost: "",
        createSupplier: false,
        isBase: false,
        isExport: false,
        services: [],
      });
    }
  }, [warehouseToEdit, form]);

  const mutation = useMutation({
    mutationFn: async (data: NewWarehouseFormValues) => {
      const payload = {
        ...data,
        baseIds: data.bases.map(b => b.baseId),
        ...(data.storageCost && { storageCost: data.storageCost }),
        equipmentType: data.isBase ? EQUIPMENT_TYPE.LIK : EQUIPMENT_TYPE.COMMON,
        isExport: data.isExport,
        services: data.services,
      };
      const url = isEditing ? `/api/warehouses/${warehouseToEdit?.id}` : "/api/warehouses";
      const method = isEditing ? "PATCH" : "POST";
      const res = await apiRequest(method, url, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      toast({ 
        title: isEditing ? "Склад обновлен" : "Склад создан", 
        description: isEditing 
          ? "Информация о складе успешно изменена" 
          : "Новый склад успешно добавлен" 
      });
      form.reset();
      setOpen(false);
      onSave();
    },
    onError: (error: Error) => {
      showError(error);
    },
  });

  return (
    <>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Редактирование склада" : "Новый склад"}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? "Изменение информации о складе" 
              : "Добавление нового склада в систему"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Название</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Название склада" 
                      data-testid="input-warehouse-name" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <FormLabel>Базисы поставки</FormLabel>
                <div className="flex items-center gap-2">
                  {hasPermission("directories", "create") && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setAddBaseOpen(true)}
                      data-testid="button-add-base-inline"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Создать новый
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const lastField = fields[fields.length - 1];
                      if (lastField && !form.watch(`bases.${fields.length - 1}.baseId`)) {
                        return;
                      }
                      append({ baseId: "" });
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-2 items-center">
                  <div className="flex-1 min-w-0">
                    <Combobox
                      options={allBases.map((base) => ({
                        value: base.id,
                        label: base.name,
                        render: (
                          <div className="flex items-center gap-2">
                            {base.name}
                            <BaseTypeBadge type={base.baseType} />
                          </div>
                        )
                      }))}
                      value={form.watch(`bases.${index}.baseId`) || ""}
                      onValueChange={(value) => form.setValue(`bases.${index}.baseId`, value)}
                      placeholder="Выберите базис"
                      className="w-full"
                      dataTestId={`select-warehouse-basis-${index}`}
                    />
                    {form.formState.errors.bases?.[index]?.baseId && (
                      <p className="text-sm text-destructive mt-1">
                        {form.formState.errors.bases[index]?.baseId?.message}
                      </p>
                    )}
                  </div>
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(index)}
                      className="shrink-0 h-9 w-9"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              {fields.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Нажмите + для добавления базиса
                </p>
              )}
            </div>

            <FormField
              control={form.control}
              name="storageCost"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Стоимость хранения (₽/т)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Стоимость хранения" 
                      type="number"
                      min="0"
                      step="0.000001"
                      data-testid="input-storage-cost" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Warehouse Services */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <FormLabel>Услуги склада</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => appendService({ serviceType: "", serviceValue: "" })}
                  data-testid="button-add-warehouse-service"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Добавить услугу
                </Button>
              </div>
              {serviceFields.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Дополнительные услуги не добавлены
                </p>
              )}
              {serviceFields.map((field, index) => {
                const currentType = form.watch(`services.${index}.serviceType`);
                return (
                  <div key={field.id} className="border rounded-md p-3 space-y-2">
                    <div className="flex gap-2 items-start">
                      <div className="flex-1 space-y-1">
                        <label className="text-xs text-muted-foreground">Тип услуги</label>
                        <Select
                          value={form.watch(`services.${index}.serviceType`) || ""}
                          onValueChange={(val) => {
                            form.setValue(`services.${index}.serviceType`, val);
                            form.setValue(`services.${index}.serviceValue`, "");
                          }}
                        >
                          <SelectTrigger data-testid={`select-service-type-${index}`}>
                            <SelectValue placeholder="Выберите тип" />
                          </SelectTrigger>
                          <SelectContent>
                            {SERVICE_TYPE_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {form.formState.errors.services?.[index]?.serviceType && (
                          <p className="text-sm text-destructive">
                            {form.formState.errors.services[index]?.serviceType?.message}
                          </p>
                        )}
                      </div>
                      <div className="flex-1 space-y-1">
                        <label className="text-xs text-muted-foreground">Значение</label>
                        <Input
                          placeholder={currentType ? SERVICE_TYPE_PLACEHOLDER[currentType] : "Значение"}
                          type="number"
                          min="0"
                          step="0.000001"
                          {...form.register(`services.${index}.serviceValue`)}
                          data-testid={`input-service-value-${index}`}
                          disabled={!currentType}
                        />
                        {form.formState.errors.services?.[index]?.serviceValue && (
                          <p className="text-sm text-destructive">
                            {form.formState.errors.services[index]?.serviceValue?.message}
                          </p>
                        )}
                      </div>
                      <div className="pt-5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeService(index)}
                          className="shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <FormField
              control={form.control}
              name="isExport"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-is-export"
                    />
                  </FormControl>
                  <div className="flex items-center gap-1">
                    <Globe2 className="h-4 w-4 text-blue-500" />
                    <FormLabel className="font-normal cursor-pointer">
                      Без НДС (экспорт)
                    </FormLabel>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isBase"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={(checked) => {
                        field.onChange(checked);
                        if (checked) {
                          form.setValue("createSupplier", true);
                        }
                      }}
                      data-testid="switch-is-base"
                    />
                  </FormControl>
                  <div className="flex items-center gap-1">
                    <Building2 className="h-4 w-4 text-green-500" />
                    <FormLabel className="font-normal cursor-pointer">
                      Сделать склад базовым (Обособленное подразделение)
                    </FormLabel>
                  </div>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="createSupplier"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl>
                    <Switch 
                      checked={field.value} 
                      onCheckedChange={(checked) => {
                        field.onChange(checked);
                        if (!checked) {
                          form.setValue("isBase", false);
                        }
                      }}
                      data-testid="switch-create-supplier" 
                    />
                  </FormControl>
                  <FormLabel className="font-normal cursor-pointer">
                    Создать поставщика
                  </FormLabel>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-4 pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={mutation.isPending} data-testid="button-save-warehouse">
                {mutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isEditing ? "Сохранение..." : "Создание..."}
                  </>
                ) : (
                  isEditing ? "Сохранить" : "Создать"
                )}
              </Button>
            </div>
          </form>
        </Form>

        <AddBaseDialog
          isInline
          inlineOpen={addBaseOpen}
          onInlineOpenChange={setAddBaseOpen}
        />
      </DialogContent>
    </Dialog>
    <ErrorModalComponent />
    </>
  );
}
