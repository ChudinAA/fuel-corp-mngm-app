import { Combobox } from "@/components/ui/combobox";
import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Loader2, X } from "lucide-react";
import type { Supplier, Base } from "@shared/schema";
import { BaseTypeBadge } from "@/components/base-type-badge";

const supplierFormSchema = z.object({
  name: z.string().min(1, "Укажите название"),
  description: z.string().optional(),
  baseIds: z
    .array(z.string().min(1, "Выберите базис"))
    .min(1, "Добавьте хотя бы один базис"),
  servicePrice: z.coerce.number().optional(),
  pvkjPrice: z.coerce.number().optional(),
  agentFee: z.coerce.number().optional(),
  isWarehouse: z.boolean().default(false),
  storageCost: z.coerce.number().optional(),
  isActive: z.boolean().default(true),
});

type SupplierFormData = z.infer<typeof supplierFormSchema>;

interface AddSupplierDialogProps {
  bases: Base[];
  editItem?: Supplier | null;
  onEditComplete?: () => void;
  isInline?: boolean;
  inlineOpen?: boolean;
  onInlineOpenChange?: (open: boolean) => void;
  onCreated?: (id: string) => void;
}

export function AddSupplierDialog({
  bases,
  editItem,
  onEditComplete,
  isInline = false,
  inlineOpen = false,
  onInlineOpenChange,
  onCreated,
}: AddSupplierDialogProps) {
  const { toast } = useToast();
  const [localOpen, setLocalOpen] = useState(false);

  const open = isInline ? inlineOpen : localOpen;
  const setOpen = isInline ? onInlineOpenChange || setLocalOpen : setLocalOpen;

  const form = useForm<SupplierFormData>({
    resolver: zodResolver(supplierFormSchema),
    defaultValues: {
      name: "",
      description: "",
      baseIds: [""],
      servicePrice: undefined,
      pvkjPrice: undefined,
      agentFee: undefined,
      isWarehouse: false,
      storageCost: undefined,
      isActive: true,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "baseIds",
  });

  // Ensure at least one field is always present
  useEffect(() => {
    if (fields.length === 0) {
      append("");
    }
  }, [fields.length, append]);

  const isWarehouse = form.watch("isWarehouse");

  const createMutation = useMutation({
    mutationFn: async (data: SupplierFormData) => {
      const endpoint = editItem
        ? `/api/suppliers/${editItem.id}`
        : "/api/suppliers";
      const filteredBaseIds = data.baseIds.filter(
        (id) => id && id.trim() !== "",
      );
      const payload = {
        name: data.name,
        description: data.description,
        baseIds: filteredBaseIds.length > 0 ? filteredBaseIds : null,
        servicePrice: data.servicePrice ? String(data.servicePrice) : null,
        pvkjPrice: data.pvkjPrice ? String(data.pvkjPrice) : null,
        agentFee: data.agentFee ? String(data.agentFee) : null,
        isWarehouse: data.isWarehouse,
        storageCost:
          data.isWarehouse && data.storageCost
            ? String(data.storageCost)
            : null,
        isActive: data.isActive,
      };

      const res = await apiRequest(
        editItem ? "PATCH" : "POST",
        endpoint,
        payload,
      );
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
      toast({
        title: editItem ? "Поставщик обновлен" : "Поставщик добавлен",
        description: editItem
          ? "Изменения сохранены"
          : "Новый поставщик сохранен в справочнике",
      });
      form.reset({
        name: "",
        description: "",
        baseIds: [""],
        servicePrice: undefined,
        pvkjPrice: undefined,
        agentFee: undefined,
        isWarehouse: false,
        storageCost: undefined,
        isActive: true,
      });
      setOpen(false);
      if (onCreated && data?.id) {
        onCreated(data.id);
      }
      if (onEditComplete) {
        onEditComplete();
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (editItem) {
      setOpen(true);
      const baseIdsArray =
        editItem.baseIds && editItem.baseIds.length > 0
          ? editItem.baseIds
          : [""];
      form.reset({
        name: editItem.name,
        description: editItem.description || "",
        baseIds: baseIdsArray,
        servicePrice: editItem.servicePrice
          ? parseFloat(editItem.servicePrice)
          : undefined,
        pvkjPrice: editItem.pvkjPrice
          ? parseFloat(editItem.pvkjPrice)
          : undefined,
        agentFee: editItem.agentFee ? parseFloat(editItem.agentFee) : undefined,
        isWarehouse: editItem.isWarehouse || false,
        storageCost: editItem.storageCost
          ? parseFloat(editItem.storageCost)
          : undefined,
        isActive: editItem.isActive,
      });
    }
  }, [editItem, form]);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      form.reset({
        name: "",
        description: "",
        baseIds: [""],
        servicePrice: undefined,
        pvkjPrice: undefined,
        agentFee: undefined,
        isWarehouse: false,
        storageCost: undefined,
        isActive: true,
      });
      if (onEditComplete) {
        onEditComplete();
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!isInline && (
        <DialogTrigger asChild>
          <Button size="sm" data-testid="button-add-supplier">
            <Plus className="mr-2 h-4 w-4" />
            Добавить
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editItem ? "Редактирование поставщика" : "Новый поставщик"}
          </DialogTitle>
          <DialogDescription>
            {editItem
              ? "Изменение записи в справочнике"
              : "Добавление нового поставщика"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit((data) => createMutation.mutate(data))(e);
            }}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Название</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Название"
                      data-testid="input-supplier-name"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <FormLabel>Базисы</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append("")}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-2 items-center">
                  <div className="flex-1 min-w-0">
                    <Combobox
                      options={bases.map((b) => ({
                        value: b.id,
                        label: b.name,
                        render: (
                          <div className="flex items-center gap-2">
                            {b.name}
                            <BaseTypeBadge type={b.baseType} />
                          </div>
                        )
                      }))}
                      value={form.watch(`baseIds.${index}`) || ""}
                      onValueChange={(value) =>
                        form.setValue(`baseIds.${index}`, value)
                      }
                      placeholder="Выберите базис"
                      className="w-full"
                      dataTestId={`select-base-${index}`}
                    />
                    {form.formState.errors.baseIds?.[index] && (
                      <p className="text-sm text-destructive mt-1">
                        {form.formState.errors.baseIds[index]?.message}
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
              {form.formState.errors.baseIds &&
                !Array.isArray(form.formState.errors.baseIds) && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.baseIds.message}
                  </p>
                )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="servicePrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Стоимость услуги</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="0.00"
                        type="number"
                        step="0.01"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="pvkjPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Стоимость ПВКЖ</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="0.00"
                        type="number"
                        step="0.01"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="agentFee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Агентские/прочие</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="0.00"
                        type="number"
                        step="0.01"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="isWarehouse"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-is-warehouse"
                    />
                  </FormControl>
                  <FormLabel className="font-normal cursor-pointer">
                    Этот поставщик является складом
                  </FormLabel>
                </FormItem>
              )}
            />

            {isWarehouse && (
              <FormField
                control={form.control}
                name="storageCost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Стоимость хранения на складе (₽)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        data-testid="input-storage-cost"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Описание</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Дополнительная информация..."
                      className="resize-none"
                      data-testid="input-supplier-description"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-supplier-active"
                    />
                  </FormControl>
                  <FormLabel className="font-normal cursor-pointer">
                    Активен
                  </FormLabel>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Отмена
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                data-testid="button-save-supplier"
                onClick={(e) => e.stopPropagation()}
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Сохранение...
                  </>
                ) : editItem ? (
                  "Сохранить"
                ) : (
                  "Создать"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
