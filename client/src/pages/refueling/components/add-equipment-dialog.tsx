import React from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Equipment, Warehouse } from "@shared/schema";
import { z } from "zod";

const formSchema = z.object({
  name: z.string().min(1, "Название обязательно"),
  warehouseId: z.string().uuid("Выберите материнский склад"),
});

type FormValues = z.infer<typeof formSchema>;

interface AddEquipmentDialogProps {
  equipmentToEdit: Equipment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  likWarehouses: Warehouse[];
}

export function AddEquipmentDialog({
  equipmentToEdit,
  open,
  onOpenChange,
  likWarehouses,
}: AddEquipmentDialogProps) {
  const { toast } = useToast();
  const isEditing = !!equipmentToEdit;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      warehouseId: likWarehouses[0]?.id || "",
    },
  });

  React.useEffect(() => {
    if (equipmentToEdit) {
      form.reset({
        name: equipmentToEdit.name,
        warehouseId: likWarehouses[0]?.id || "", // In a real app we'd fetch current link
      });
    } else {
      form.reset({
        name: "",
        warehouseId: likWarehouses[0]?.id || "",
      });
    }
  }, [equipmentToEdit, likWarehouses, form]);

  const mutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const method = isEditing ? "PATCH" : "POST";
      const url = isEditing 
        ? `/api/warehouses-equipment/${equipmentToEdit?.id}` 
        : "/api/warehouses-equipment";
      
      const res = await apiRequest(method, url, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses-equipment"] });
      toast({
        title: isEditing ? "Обновлено" : "Создано",
        description: "Средство заправки успешно сохранено",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Редактирование ТЗК" : "Новое средство заправки (ТЗК)"}
          </DialogTitle>
          <DialogDescription>
            Укажите название и привяжите к складу ЛИК
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Название / Номер ТЗК</FormLabel>
                  <FormControl>
                    <Input placeholder="Например, ТЗК-01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="warehouseId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Материнский склад (ЛИК)</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите склад" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {likWarehouses.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? "Сохранить" : "Создать"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
