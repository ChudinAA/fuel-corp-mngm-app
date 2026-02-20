import { useState, useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus } from "lucide-react";
import { equipmentMovementFormSchema, type EquipmentMovementFormData } from "../schemas";
import { PRODUCT_TYPE } from "@shared/constants";
import type { EquipmentMovementDialogProps } from "../types";

export function EquipmentMovementDialog({
  warehouses,
  equipments,
  editMovement,
  isCopy,
  open,
  onOpenChange,
}: EquipmentMovementDialogProps) {
  const { toast } = useToast();
  const isEditing = !!editMovement && !isCopy;

  const form = useForm<EquipmentMovementFormData>({
    resolver: zodResolver(equipmentMovementFormSchema),
    defaultValues: {
      movementDate: new Date(),
      productType: PRODUCT_TYPE.KEROSENE,
      fromWarehouseId: "",
      toWarehouseId: "",
      fromEquipmentId: "",
      toEquipmentId: "",
      inputMode: "kg",
      quantityLiters: "",
      density: "",
      quantityKg: "",
      notes: "",
      isDraft: false,
    },
  });

  useEffect(() => {
    if (open) {
      if (editMovement) {
        form.reset({
          movementDate: (editMovement && editMovement.movementDate) ? new Date(editMovement.movementDate) : new Date(),
          productType: (editMovement && editMovement.productType) || PRODUCT_TYPE.KEROSENE,
          fromWarehouseId: (editMovement && editMovement.fromWarehouseId) || "",
          toWarehouseId: (editMovement && editMovement.toWarehouseId) || "",
          fromEquipmentId: (editMovement && editMovement.fromEquipmentId) || "",
          toEquipmentId: (editMovement && editMovement.toEquipmentId) || "",
          inputMode: (editMovement && editMovement.inputMode as "liters" | "kg") || "kg",
          quantityLiters: (editMovement && editMovement.quantityLiters)?.toString() || "",
          density: (editMovement && editMovement.density)?.toString() || "",
          quantityKg: (editMovement && editMovement.quantityKg)?.toString() || "",
          notes: (editMovement && editMovement.notes) || "",
          isDraft: (editMovement && editMovement.isDraft) || false,
        });
      } else {
        form.reset({
          movementDate: new Date(),
          productType: PRODUCT_TYPE.KEROSENE,
          fromWarehouseId: "",
          toWarehouseId: "",
          fromEquipmentId: "",
          toEquipmentId: "",
          inputMode: "kg",
          quantityLiters: "",
          density: "",
          quantityKg: "",
          notes: "",
          isDraft: false,
        });
      }
    }
  }, [open, editMovement, form]);

  const watchFromWarehouseId = form.watch("fromWarehouseId");
  const watchToWarehouseId = form.watch("toWarehouseId");

  const { data: fromEquipments = [] } = useQuery<any[]>({
    queryKey: ["/api/warehouses", watchFromWarehouseId, "equipment"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/warehouses/${watchFromWarehouseId}/equipment`);
      return res.json();
    },
    enabled: !!watchFromWarehouseId,
  });

  const { data: toEquipments = [] } = useQuery<any[]>({
    queryKey: ["/api/warehouses", watchToWarehouseId, "equipment"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/warehouses/${watchToWarehouseId}/equipment`);
      return res.json();
    },
    enabled: !!watchToWarehouseId,
  });

  const likWarehouses = useMemo(() => 
    warehouses.filter(w => w.equipmentType === "lik"), 
  [warehouses]);

  // Sync toWarehouseId with fromWarehouseId for local movement
  useEffect(() => {
    if (watchFromWarehouseId && !form.getValues("toWarehouseId")) {
      form.setValue("toWarehouseId", watchFromWarehouseId);
    }
  }, [watchFromWarehouseId, form]);

  const mutation = useMutation({
    mutationFn: async (data: EquipmentMovementFormData) => {
      const payload = {
        ...data,
        movementDate: format(data.movementDate, "yyyy-MM-dd'T'HH:mm:ss"),
        quantityKg: data.quantityKg,
        quantityLiters: data.quantityLiters ? parseFloat(data.quantityLiters) : null,
        density: data.density ? parseFloat(data.density) : null,
      };
      
      const res = await apiRequest(
        isEditing ? "PATCH" : "POST",
        isEditing ? `/api/equipment-movement/${editMovement?.id}` : "/api/equipment-movement",
        payload
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment-movement"] });
      toast({ title: isEditing ? "Запись обновлена" : "Запись создана" });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Редактирование" : "Новое перемещение ЛИК"}</DialogTitle>
          <DialogDescription>Локальное распределение топлива (в рамках одного склада ЛИК)</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="fromWarehouseId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Склад ЛИК (Откуда)</FormLabel>
                    <Select onValueChange={(val) => {
                      field.onChange(val);
                      // Force destination to be same for local movement
                      form.setValue("toWarehouseId", val);
                    }} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите склад" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {likWarehouses.map(w => (
                          <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="fromEquipmentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ТЗА (Откуда - опц.)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Материнский склад" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">Материнский склад</SelectItem>
                        {fromEquipments.map(e => (
                          <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="toWarehouseId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Склад ЛИК (Куда)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите склад" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {likWarehouses.map(w => (
                          <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="toEquipmentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ТЗА (Куда - опц.)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Материнский склад" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">Материнский склад</SelectItem>
                        {toEquipments.map(e => (
                          <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="quantityKg"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Количество (кг)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Примечания</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? "Обновить" : "Создать"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
