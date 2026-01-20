
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
import { Plus, Loader2, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Warehouse } from "@shared/schema";
import { newWarehouseFormSchema } from "../schemas";
import type { NewWarehouseFormValues } from "../types";
import { BaseTypeBadge } from "@/components/base-type-badge";

interface AddWarehouseDialogProps {
  warehouseToEdit: Warehouse | null;
  onSave: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AddWarehouseDialog({ 
  warehouseToEdit, 
  onSave, 
  open: externalOpen, 
  onOpenChange: externalOnOpenChange 
}: AddWarehouseDialogProps) {
  const { toast } = useToast();
  const [internalOpen, setInternalOpen] = useState(false);

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
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "bases",
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
      });
    } else {
      form.reset({
        name: "",
        bases: [{ baseId: "" }],
        storageCost: "",
        createSupplier: false,
      });
    }
  }, [warehouseToEdit, form]);

  const mutation = useMutation({
    mutationFn: async (data: NewWarehouseFormValues) => {
      const payload = {
        ...data,
        baseIds: data.bases.map(b => b.baseId),
        ...(data.storageCost && { storageCost: data.storageCost }),
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
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl">
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
                  <FormLabel>Стоимость хранения (₽)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Стоимость хранения" 
                      type="number" 
                      data-testid="input-storage-cost" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
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
                      onCheckedChange={field.onChange} 
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
      </DialogContent>
    </Dialog>
  );
}
