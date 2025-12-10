
import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Loader2, Building2, MapPin, X } from "lucide-react";
import type { WholesaleSupplier, WholesaleBase } from "@shared/schema";

const WHOLESALE_TYPES = [
  { value: "supplier", label: "Поставщик", icon: Building2 },
  { value: "basis", label: "Базис поставки", icon: MapPin },
] as const;

const wholesaleFormSchema = z.object({
  type: z.enum(["supplier", "basis"]),
  name: z.string().min(1, "Укажите название"),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  baseIds: z.array(z.string()).optional(),
  location: z.string().optional(),
  isWarehouse: z.boolean().default(false),
  storageCost: z.coerce.number().optional(),
});

type WholesaleFormData = z.infer<typeof wholesaleFormSchema>;

export function AddWholesaleDialog({ 
  suppliers, 
  bases, 
  editItem,
  onEditComplete
}: { 
  suppliers: WholesaleSupplier[]; 
  bases: WholesaleBase[]; 
  editItem?: { type: "supplier" | "basis"; data: WholesaleSupplier | WholesaleBase } | null;
  onEditComplete?: () => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const form = useForm<WholesaleFormData>({
    resolver: zodResolver(wholesaleFormSchema),
    defaultValues: {
      type: "supplier",
      name: "",
      description: "",
      isActive: true,
      baseIds: [""],
      location: "",
      isWarehouse: false,
      storageCost: undefined,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "baseIds"
  });

  const selectedType = form.watch("type");
  const isWarehouse = form.watch("isWarehouse");

  useEffect(() => {
    form.setValue("location", "");
    form.setValue("isWarehouse", false);
    form.setValue("storageCost", "");
  }, [selectedType, form]);

  const createMutation = useMutation({
    mutationFn: async (data: WholesaleFormData) => {
      let endpoint = "";
      let payload: Record<string, unknown> = {};

      if (data.type === "supplier") {
        endpoint = editItem ? `/api/wholesale/suppliers/${editItem.data.id}` : "/api/wholesale/suppliers";
        const filteredBaseIds = (data.baseIds || []).filter(id => id && id.trim() !== "");
        payload = {
          name: data.name,
          description: data.description,
          baseIds: filteredBaseIds.length > 0 ? filteredBaseIds : null,
          isActive: data.isActive,
          isWarehouse: data.isWarehouse,
          storageCost: data.storageCost && data.isWarehouse ? data.storageCost : null,
        };
      } else if (data.type === "basis") {
        endpoint = editItem ? `/api/wholesale/bases/${editItem.data.id}` : "/api/wholesale/bases";
        payload = {
          name: data.name,
          location: data.location,
          isActive: data.isActive,
        };
      }

      const res = await apiRequest(editItem ? "PATCH" : "POST", endpoint, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wholesale/suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wholesale/bases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
      toast({ 
        title: editItem ? "Запись обновлена" : "Запись добавлена", 
        description: editItem ? "Изменения сохранены" : "Новая запись сохранена в справочнике" 
      });
      form.reset();
      setOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (editItem) {
      setOpen(true);
      const data = editItem.data as any;
      const baseIdsArray = data.baseIds && data.baseIds.length > 0 ? data.baseIds : [""];
      form.reset({
        type: editItem.type,
        name: data.name,
        description: data.description || "",
        baseIds: baseIdsArray,
        location: data.location || "",
        isActive: data.isActive,
        isWarehouse: data.isWarehouse || false,
        storageCost: data.storageCost ? parseFloat(data.storageCost) : undefined,
      });
    }
  }, [editItem, form]);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      form.reset();
      if (onEditComplete) {
        onEditComplete();
      }
    } else if (isOpen && !editItem) {
      form.reset({
        type: "supplier",
        name: "",
        description: "",
        isActive: true,
        baseIds: [""],
        location: "",
        isWarehouse: false,
        storageCost: undefined,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="button-add-wholesale">
          <Plus className="mr-2 h-4 w-4" />
          Добавить
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editItem ? "Редактирование записи: ОПТ" : "Новая запись: ОПТ"}</DialogTitle>
          <DialogDescription>{editItem ? "Изменение записи в справочнике" : "Добавление записи в справочник оптовых операций"}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Тип</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-wholesale-type">
                        <SelectValue placeholder="Выберите тип" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {WHOLESALE_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          <div className="flex items-center gap-2">
                            <t.icon className="h-4 w-4" />
                            {t.label}
                          </div>
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
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Название</FormLabel>
                  <FormControl>
                    <Input placeholder="Название" data-testid="input-wholesale-name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedType === "supplier" && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <FormLabel>Базисы поставки</FormLabel>
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
                    <div key={field.id} className="flex gap-2">
                      <Select
                        value={form.watch(`baseIds.${index}`) || ""}
                        onValueChange={(value) => form.setValue(`baseIds.${index}`, value)}
                      >
                        <SelectTrigger data-testid={`select-base-${index}`}>
                          <SelectValue placeholder="Выберите базис" />
                        </SelectTrigger>
                        <SelectContent>
                          {bases.map((b) => (
                            <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => remove(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {fields.length === 0 && (
                    <p className="text-sm text-muted-foreground">Нажмите + для добавления базиса</p>
                  )}
                </div>

                <FormField
                  control={form.control}
                  name="isWarehouse"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-is-warehouse" />
                      </FormControl>
                      <FormLabel className="font-normal cursor-pointer">Этот поставщик является складом</FormLabel>
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
              </>
            )}

            {selectedType === "basis" && (
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Местоположение</FormLabel>
                    <FormControl>
                      <Input placeholder="Местоположение" data-testid="input-wholesale-location" {...field} />
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
                    <Textarea placeholder="Дополнительная информация..." className="resize-none" data-testid="input-wholesale-description" {...field} />
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
                    <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-wholesale-active" />
                  </FormControl>
                  <FormLabel className="font-normal cursor-pointer">Активен</FormLabel>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-4 pt-4">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Отмена</Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-wholesale">
                {createMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Сохранение...</> : editItem ? "Сохранить" : "Создать"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
