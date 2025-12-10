
import { useState } from "react";
import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Loader2 } from "lucide-react";
import type { DeliveryCost } from "@shared/schema";
import { deliveryCostFormSchema, ENTITY_TYPES, type DeliveryCostFormData } from "../types";
import { getEntitiesByType } from "../utils";

interface AddDeliveryCostDialogProps {
  editDeliveryCost: DeliveryCost | null;
  onClose?: () => void;
}

export function AddDeliveryCostDialog({ editDeliveryCost, onClose }: AddDeliveryCostDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  
  const handleClose = () => {
    setOpen(false);
    form.reset({
      carrierId: "",
      fromEntityType: "",
      fromEntityId: "",
      fromLocation: "",
      toEntityType: "",
      toEntityId: "",
      toLocation: "",
      costPerKg: "",
      distance: "",
    });
    onClose?.();
  };

  const form = useForm<DeliveryCostFormData>({
    resolver: zodResolver(deliveryCostFormSchema),
    defaultValues: {
      carrierId: editDeliveryCost?.carrierId || "",
      fromEntityType: editDeliveryCost?.fromEntityType || "",
      fromEntityId: editDeliveryCost?.fromEntityId || "",
      fromLocation: editDeliveryCost?.fromLocation || "",
      toEntityType: editDeliveryCost?.toEntityType || "",
      toEntityId: editDeliveryCost?.toEntityId || "",
      toLocation: editDeliveryCost?.toLocation || "",
      costPerKg: editDeliveryCost?.costPerKg?.toString() || "",
      distance: editDeliveryCost?.distance?.toString() || "",
    },
  });

  const { data: carriers } = useQuery<any[]>({
    queryKey: ["/api/logistics/carriers"],
  });

  const { data: wholesaleBases } = useQuery<any[]>({
    queryKey: ["/api/wholesale/bases"],
  });

  const { data: refuelingBases } = useQuery<any[]>({
    queryKey: ["/api/refueling/bases"],
  });

  const { data: deliveryLocations } = useQuery<any[]>({
    queryKey: ["/api/logistics/delivery-locations"],
  });

  const { data: warehouses } = useQuery<any[]>({
    queryKey: ["/api/warehouses"],
  });

  const watchFromEntityType = form.watch("fromEntityType");
  const watchToEntityType = form.watch("toEntityType");

  const fromEntities = getEntitiesByType(
    watchFromEntityType,
    wholesaleBases,
    refuelingBases,
    warehouses,
    deliveryLocations
  );
  
  const toEntities = getEntitiesByType(
    watchToEntityType,
    wholesaleBases,
    refuelingBases,
    warehouses,
    deliveryLocations
  );

  const createMutation = useMutation({
    mutationFn: async (data: DeliveryCostFormData) => {
      const res = await apiRequest("POST", "/api/delivery-costs", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/delivery-costs"] });
      toast({ title: "Тариф добавлен", description: "Новый тариф доставки сохранен" });
      handleClose();
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: DeliveryCostFormData) => {
      const res = await apiRequest("PATCH", `/api/delivery-costs/${editDeliveryCost?.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/delivery-costs"] });
      toast({ title: "Тариф обновлен", description: "Изменения тарифа доставки сохранены" });
      handleClose();
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  React.useEffect(() => {
    if (editDeliveryCost) {
      form.reset({
        carrierId: editDeliveryCost.carrierId || "",
        fromEntityType: editDeliveryCost.fromEntityType || "",
        fromEntityId: editDeliveryCost.fromEntityId || "",
        fromLocation: editDeliveryCost.fromLocation || "",
        toEntityType: editDeliveryCost.toEntityType || "",
        toEntityId: editDeliveryCost.toEntityId || "",
        toLocation: editDeliveryCost.toLocation || "",
        costPerKg: editDeliveryCost.costPerKg?.toString() || "",
        distance: editDeliveryCost.distance?.toString() || "",
      });
    }
  }, [editDeliveryCost, form]);

  React.useEffect(() => {
    const fromEntityId = form.watch("fromEntityId");
    if (fromEntityId && watchFromEntityType) {
      const entity = fromEntities.find(e => e.id === fromEntityId);
      if (entity) {
        form.setValue("fromLocation", entity.name);
      }
    }
  }, [form.watch("fromEntityId"), watchFromEntityType]);

  React.useEffect(() => {
    const toEntityId = form.watch("toEntityId");
    if (toEntityId && watchToEntityType) {
      const entity = toEntities.find(e => e.id === toEntityId);
      if (entity) {
        form.setValue("toLocation", entity.name);
      }
    }
  }, [form.watch("toEntityId"), watchToEntityType]);

  return (
    <Dialog open={editDeliveryCost !== null || open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        handleClose();
      }
    }}>
      <DialogTrigger asChild>
        {editDeliveryCost ? null : (
          <Button data-testid="button-add-delivery-cost" onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Добавить тариф
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editDeliveryCost ? "Редактировать тариф доставки" : "Новый тариф доставки"}</DialogTitle>
          <DialogDescription>{editDeliveryCost ? "Изменение тарифа перевозки" : "Добавление тарифа перевозки"}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(data => editDeliveryCost ? updateMutation.mutate(data) : createMutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="carrierId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Перевозчик</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-delivery-carrier">
                        <SelectValue placeholder="Выберите перевозчика" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {carriers?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      )) || <SelectItem value="none" disabled>Нет данных</SelectItem>}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="fromEntityType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Откуда (тип)</FormLabel>
                      <Select onValueChange={(value) => {
                        field.onChange(value);
                        form.setValue("fromEntityId", "");
                        form.setValue("fromLocation", "");
                      }} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-delivery-from-type">
                            <SelectValue placeholder="Выберите тип" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ENTITY_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="fromEntityId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Пункт отправления</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value}
                        disabled={!watchFromEntityType}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-delivery-from">
                            <SelectValue placeholder="Выберите пункт" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {fromEntities.map((entity) => (
                            <SelectItem key={entity.id} value={entity.id}>{entity.name}</SelectItem>
                          ))}
                          {fromEntities.length === 0 && <SelectItem value="none" disabled>Нет данных</SelectItem>}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="toEntityType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Куда (тип)</FormLabel>
                      <Select onValueChange={(value) => {
                        field.onChange(value);
                        form.setValue("toEntityId", "");
                        form.setValue("toLocation", "");
                      }} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-delivery-to-type">
                            <SelectValue placeholder="Выберите тип" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ENTITY_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="toEntityId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Пункт назначения</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value}
                        disabled={!watchToEntityType}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-delivery-to">
                            <SelectValue placeholder="Выберите пункт" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {toEntities.map((entity) => (
                            <SelectItem key={entity.id} value={entity.id}>{entity.name}</SelectItem>
                          ))}
                          {toEntities.length === 0 && <SelectItem value="none" disabled>Нет данных</SelectItem>}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="costPerKg"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Стоимость за кг (₽)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.0001" placeholder="0.0000" data-testid="input-cost-per-kg" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="distance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Расстояние (км)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" data-testid="input-distance" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-4 pt-4">
              <Button type="button" variant="outline" onClick={handleClose}>Отмена</Button>
              <Button type="submit" disabled={isSubmitting} data-testid="button-save-delivery-cost">
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{editDeliveryCost ? "Сохранение..." : "Создание..."}</> : (editDeliveryCost ? "Сохранить" : "Создать")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
