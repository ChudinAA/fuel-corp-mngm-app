import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
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
import { Plus, Loader2, Building2, MapPin } from "lucide-react";
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
  defaultBaseId: z.string().optional(),
  location: z.string().optional(),
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
      defaultBaseId: undefined,
      location: "",
    },
  });

  const selectedType = form.watch("type");

  useEffect(() => {
    form.setValue("location", "");
  }, [selectedType, form]);

  const createMutation = useMutation({
    mutationFn: async (data: WholesaleFormData) => {
      let endpoint = "";
      let payload: Record<string, unknown> = {};

      if (data.type === "supplier") {
        endpoint = editItem ? `/api/wholesale/suppliers/${editItem.data.id}` : "/api/wholesale/suppliers";
        payload = {
          name: data.name,
          description: data.description,
          defaultBaseId: data.defaultBaseId || null,
          isActive: data.isActive,
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
      form.reset({
        type: editItem.type,
        name: data.name,
        description: data.description || "",
        defaultBaseId: data.defaultBaseId || undefined,
        location: data.location || "",
        isActive: data.isActive,
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
      <DialogContent className="max-w-md">
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
              <FormField
                control={form.control}
                name="defaultBaseId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Базис поставки</FormLabel>
                    <Select 
                        onValueChange={field.onChange} 
                        value={field.value || ""}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-wholesale-supplier-basis">
                            <SelectValue placeholder="Выберите базис" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {bases.map((b) => (
                            <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
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