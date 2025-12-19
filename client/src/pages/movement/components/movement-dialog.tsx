import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MOVEMENT_TYPE, PRODUCT_TYPE, COUNTERPARTY_TYPE, COUNTERPARTY_ROLE, ENTITY_TYPE } from "@shared/constants";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarIcon, Plus, Loader2 } from "lucide-react";
import { movementFormSchema, type MovementFormData } from "../schemas";
import { calculateKgFromLiters, formatNumber, formatCurrency } from "../utils";
import type { MovementDialogProps } from "../types";
import { CalculatedField } from "./calculated-field";

export function MovementDialog({
  warehouses,
  suppliers,
  carriers,
  vehicles,
  trailers,
  drivers,
  prices,
  deliveryCosts,
  editMovement,
  open,
  onOpenChange
}: MovementDialogProps) {
  const { toast } = useToast();
  const [inputMode, setInputMode] = useState<"liters" | "kg">("kg");
  const isEditing = !!editMovement;

  const { data: allBases } = useQuery<any[]>({
    queryKey: ["/api/bases"],
  });

  const form = useForm<MovementFormData>({
    resolver: zodResolver(movementFormSchema),
    defaultValues: {
      movementDate: new Date(),
      movementType: MOVEMENT_TYPE.SUPPLY,
      productType: PRODUCT_TYPE.KEROSENE,
      supplierId: "",
      fromWarehouseId: "",
      toWarehouseId: "",
      inputMode: "kg",
      quantityLiters: undefined,
      density: undefined,
      quantityKg: 0,
      carrierId: "",
      notes: "",
    },
  });

  // Обновляем форму при изменении editMovement
  useEffect(() => {
    if (editMovement) {
      form.reset({
        movementDate: new Date(editMovement.movementDate),
        movementType: editMovement.movementType,
        productType: editMovement.productType,
        supplierId: editMovement.supplierId || "",
        fromWarehouseId: editMovement.fromWarehouseId || "",
        toWarehouseId: editMovement.toWarehouseId,
        inputMode: "kg",
        quantityLiters: editMovement.quantityLiters ? parseFloat(editMovement.quantityLiters) : undefined,
        density: editMovement.density ? parseFloat(editMovement.density) : undefined,
        quantityKg: editMovement.quantityKg ? parseFloat(editMovement.quantityKg) : 0,
        carrierId: editMovement.carrierId || "",
        notes: editMovement.notes || "",
      });
    } else {
      form.reset({
        movementDate: new Date(),
        movementType: MOVEMENT_TYPE.SUPPLY,
        productType: PRODUCT_TYPE.KEROSENE,
        supplierId: "",
        fromWarehouseId: "",
        toWarehouseId: "",
        inputMode: "kg",
        quantityLiters: undefined,
        density: undefined,
        quantityKg: 0,
        carrierId: "",
        notes: "",
      });
    }
  }, [editMovement, form]);

  const watchMovementType = form.watch("movementType");
  const watchProductType = form.watch("productType");
  const watchSupplierId = form.watch("supplierId");
  const watchFromWarehouseId = form.watch("fromWarehouseId");
  const watchToWarehouseId = form.watch("toWarehouseId");
  const watchCarrierId = form.watch("carrierId");
  const watchMovementDate = form.watch("movementDate");
  const watchLiters = form.watch("quantityLiters");
  const watchDensity = form.watch("density");
  const watchKg = form.watch("quantityKg");

  const calculatedKg = inputMode === "liters" && watchLiters && watchDensity
    ? calculateKgFromLiters(watchLiters, watchDensity)
    : watchKg;

  const kgNum = calculatedKg || 0;

  // Получение цены закупки
  const getPurchasePrice = (): number | null => {
    // Для внутреннего перемещения берем себестоимость со склада-источника
    if (watchMovementType === MOVEMENT_TYPE.INTERNAL && watchFromWarehouseId) {
      const fromWarehouse = warehouses.find(w => w.id === watchFromWarehouseId);
      if (fromWarehouse) {
        const isPvkj = watchProductType === PRODUCT_TYPE.PVKJ;
        const averageCost = isPvkj ? fromWarehouse.pvkjAverageCost : fromWarehouse.averageCost;
        if (averageCost) {
          return parseFloat(averageCost);
        }
      }
      return null;
    }

    if (!watchSupplierId || !watchMovementDate) return null;

    const dateStr = format(watchMovementDate, "yyyy-MM-dd");
    const supplier = suppliers.find(s => s.id === watchSupplierId);
    if (!supplier) return null;

    // Определяем тип продукта для поиска цены
    let priceProductType = PRODUCT_TYPE.KEROSENE;
    if (watchProductType === PRODUCT_TYPE.PVKJ) {
      priceProductType = PRODUCT_TYPE.PVKJ;
    }

    // Определяем базис - берем первый базис поставщика
    let baseName = null;
    if (supplier.baseIds && supplier.baseIds.length > 0) {
      const firstBase = allBases?.find(b => b.id === supplier.baseIds[0]);
      if (firstBase) {
        baseName = firstBase.name;
      }
    }

    if (!baseName) return null;

    // Ищем цену в таблице цен
    const matchingPrice = prices.find(p =>
      p.counterpartyId === watchSupplierId &&
      p.counterpartyType === COUNTERPARTY_TYPE.WHOLESALE &&
      p.counterpartyRole === COUNTERPARTY_ROLE.SUPPLIER &&
      p.productType === priceProductType &&
      p.basis === baseName &&
      p.dateFrom <= dateStr &&
      p.dateTo >= dateStr &&
      p.isActive
    );

    if (matchingPrice && matchingPrice.priceValues && matchingPrice.priceValues.length > 0) {
      try {
        const priceObj = JSON.parse(matchingPrice.priceValues[0]);
        return parseFloat(priceObj.price || "0");
      } catch {
        return null;
      }
    }

    return null;
  };

  const purchasePrice = getPurchasePrice();
  const purchaseAmount = purchasePrice && kgNum > 0 ? purchasePrice * kgNum : 0;

  // Получение стоимости хранения
  const getStorageCost = (): number => {
    if (!watchToWarehouseId || kgNum <= 0) return 0;

    const warehouse = warehouses.find(w => w.id === watchToWarehouseId);
    if (!warehouse || !warehouse.storageCost) return 0;

    const storageCostPerTon = parseFloat(warehouse.storageCost);
    // Делим на 1000 так как стоимость хранения считается за тонну
    return (storageCostPerTon / 1000) * kgNum;
  };

  const storageCost = getStorageCost();

  // Получение доступных перевозчиков для выбранного маршрута
  const getAvailableCarriers = () => {
    if (!watchToWarehouseId) return carriers || [];

    const toWarehouse = warehouses.find(w => w.id === watchToWarehouseId);
    if (!toWarehouse) return carriers || [];

    let fromEntityType = "";
    let fromEntityId = "";

    // Для поставки - берем от поставщика
    if (watchMovementType === MOVEMENT_TYPE.SUPPLY && watchSupplierId) {
      const supplier = suppliers.find(s => s.id === watchSupplierId);
      if (!supplier) return carriers || [];

      // Если у поставщика есть склад, используем его
      if (supplier.isWarehouse) {
        fromEntityType = ENTITY_TYPE.WAREHOUSE;
        const supplierWarehouse = warehouses.find(w => w.supplierId === supplier.id);
        if (supplierWarehouse) {
          fromEntityId = supplierWarehouse.id;
        }
      } else {
        // Используем базис (первый)
        fromEntityType = ENTITY_TYPE.BASE;
        if (supplier.baseIds && supplier.baseIds.length > 0) {
          fromEntityId = supplier.baseIds[0];
        }
      }
    }
    // Для внутреннего перемещения - берем от склада-источника
    else if (watchMovementType === MOVEMENT_TYPE.INTERNAL && watchFromWarehouseId) {
      fromEntityType = ENTITY_TYPE.WAREHOUSE;
      fromEntityId = watchFromWarehouseId;
    }

    if (!fromEntityId) return carriers || [];

    // Фильтруем перевозчиков, у которых есть тариф для данного маршрута
    const availableCarrierIds = new Set(
      deliveryCosts
        .filter(dc =>
          dc.fromEntityType === fromEntityType &&
          dc.fromEntityId === fromEntityId &&
          dc.toEntityType === ENTITY_TYPE.WAREHOUSE &&
          dc.toEntityId === toWarehouse.id
        )
        .map(dc => dc.carrierId)
    );

    return carriers?.filter(c => availableCarrierIds.has(c.id)) || [];
  };

  // Получение стоимости доставки
  const getDeliveryCost = (): number => {
    if (!watchToWarehouseId || !watchCarrierId || kgNum <= 0) return 0;

    const toWarehouse = warehouses.find(w => w.id === watchToWarehouseId);
    if (!toWarehouse) return 0;

    let fromEntityType = "";
    let fromEntityId = "";

    // Для поставки - берем от поставщика
    if (watchMovementType === MOVEMENT_TYPE.SUPPLY && watchSupplierId) {
      const supplier = suppliers.find(s => s.id === watchSupplierId);
      if (!supplier) return 0;

      // Если у поставщика есть склад, используем его
      if (supplier.isWarehouse) {
        fromEntityType = ENTITY_TYPE.WAREHOUSE;
        const supplierWarehouse = warehouses.find(w => w.supplierId === supplier.id);
        if (supplierWarehouse) {
          fromEntityId = supplierWarehouse.id;
        }
      } else {
        // Используем базис (первый)
        fromEntityType = ENTITY_TYPE.BASE;
        if (supplier.baseIds && supplier.baseIds.length > 0) {
          fromEntityId = supplier.baseIds[0];
        }
      }
    }
    // Для внутреннего перемещения - берем от склада-источника
    else if (watchMovementType === MOVEMENT_TYPE.INTERNAL && watchFromWarehouseId) {
      fromEntityType = ENTITY_TYPE.WAREHOUSE;
      fromEntityId = watchFromWarehouseId;
    }

    if (!fromEntityId) return 0;

    // Ищем тариф доставки
    const deliveryCost = deliveryCosts.find(dc =>
      dc.carrierId === watchCarrierId &&
      dc.fromEntityType === fromEntityType &&
      dc.fromEntityId === fromEntityId &&
      dc.toEntityType === ENTITY_TYPE.WAREHOUSE &&
      dc.toEntityId === toWarehouse.id
    );

    if (deliveryCost && deliveryCost.costPerKg) {
      return parseFloat(deliveryCost.costPerKg) * kgNum;
    }

    return 0;
  };

  const availableCarriers = getAvailableCarriers();

  const deliveryCost = getDeliveryCost();
  const totalCost = purchaseAmount + storageCost + deliveryCost;
  const costPerKg = kgNum > 0 ? totalCost / kgNum : 0;

  const validateForm = (): boolean => {
    // Проверяем количество
    if (!calculatedKg || kgNum <= 0) {
      toast({
        title: "Ошибка: отсутствует объем",
        description: "Укажите корректное количество топлива в килограммах или литрах.",
        variant: "destructive"
      });
      return false;
    }

    // Проверяем цену закупки
    if (purchasePrice === null) {
      toast({
        title: "Ошибка: отсутствует цена закупки",
        description: "Не указана цена закупки. Проверьте настройки поставщика, базиса или маршрута.",
        variant: "destructive"
      });
      return false;
    }

    return true;
  };

  const createMutation = useMutation({
    mutationFn: async (data: MovementFormData) => {
      if (!validateForm()) {
        throw new Error("Validation failed");
      }

      const payload = {
        ...data,
        movementDate: format(data.movementDate, "yyyy-MM-dd"),
        supplierId: data.supplierId || null,
        fromWarehouseId: data.fromWarehouseId || null,
        toWarehouseId: data.toWarehouseId,
        carrierId: data.carrierId || null,
        quantityKg: calculatedKg || data.quantityKg,
        purchasePrice: purchasePrice,
        deliveryPrice: deliveryCost > 0 && kgNum > 0 ? deliveryCost / kgNum : null,
        deliveryCost: deliveryCost,
        totalCost: totalCost,
        costPerKg: costPerKg,
      };
      const res = await apiRequest(isEditing ? "PATCH" : "POST", isEditing ? `/api/movement/${editMovement?.id}` : "/api/movement", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/movement"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key?.includes('/api/warehouses/') && key?.includes('/transactions');
        }
      });
      toast({ title: isEditing ? "Перемещение обновлено" : "Перемещение создано", description: "Запись успешно сохранена" });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Редактирование перемещения" : "Новое перемещение"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Изменение существующей записи" : "Создание записи о поставке или внутреннем перемещении"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <FormField
                control={form.control}
                name="movementDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Дата</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" className="w-full justify-start text-left font-normal" data-testid="input-movement-date">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, "dd.MM.yyyy", { locale: ru }) : "Выберите дату"}
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
                control={form.control}
                name="movementType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Тип перемещения</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-movement-type">
                          <SelectValue placeholder="Выберите тип" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={MOVEMENT_TYPE.SUPPLY}>Покупка</SelectItem>
                        <SelectItem value={MOVEMENT_TYPE.INTERNAL}>Внутреннее перемещение</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="productType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Тип продукта</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-movement-product">
                          <SelectValue placeholder="Выберите тип" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={PRODUCT_TYPE.KEROSENE}>Керосин</SelectItem>
                        <SelectItem value={PRODUCT_TYPE.PVKJ}>ПВКЖ</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {watchMovementType === MOVEMENT_TYPE.SUPPLY ? (
                <FormField
                  control={form.control}
                  name="supplierId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Поставщик</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-movement-supplier">
                            <SelectValue placeholder="Выберите поставщика" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {suppliers?.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          )) || <SelectItem value="none" disabled>Нет данных</SelectItem>}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <FormField
                  control={form.control}
                  name="fromWarehouseId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Откуда (склад)</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value || undefined}
                        defaultValue={field.value || undefined}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-movement-from">
                            <SelectValue placeholder="Выберите склад" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {warehouses?.map((w) => (
                            <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                          )) || <SelectItem value="none" disabled>Нет данных</SelectItem>}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="toWarehouseId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Куда (склад)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-movement-to">
                          <SelectValue placeholder="Выберите склад" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {warehouses?.map((w) => (
                          <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                        )) || <SelectItem value="none" disabled>Нет данных</SelectItem>}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField control={form.control} name="carrierId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Перевозчик</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl><SelectTrigger data-testid="select-movement-carrier"><SelectValue placeholder="Выберите перевозчика" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {availableCarriers.length > 0 ? (
                        availableCarriers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)
                      ) : (
                        <SelectItem value="none" disabled>Нет перевозчиков для данного маршрута</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between gap-4">
                  <CardTitle className="text-lg">Объем топлива</CardTitle>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm text-muted-foreground">Литры/Плотность</Label>
                    <Switch checked={inputMode === "kg"} onCheckedChange={(c) => setInputMode(c ? "kg" : "liters")} data-testid="switch-movement-input" />
                    <Label className="text-sm text-muted-foreground">КГ</Label>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {inputMode === "liters" ? (
                  <div className="grid gap-4 md:grid-cols-3">
                    <FormField control={form.control} name="quantityLiters" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Литры</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="0" 
                            step="0.01" 
                            placeholder="0.00" 
                            data-testid="input-movement-liters" 
                            {...field}
                            value={field.value || ""}
                            onChange={(e) => field.onChange(e.target.valueAsNumber || null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="density" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Плотность</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="0" 
                            step="0.0001" 
                            placeholder="0.8000" 
                            data-testid="input-movement-density" 
                            {...field}
                            value={field.value || ""}
                            onChange={(e) => field.onChange(e.target.valueAsNumber || null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <CalculatedField label="КГ (расчет)" value={formatNumber(calculatedKg)} suffix=" кг" />
                  </div>
                ) : (
                  <FormField control={form.control} name="quantityKg" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Количество (КГ)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="0" 
                          step="0.01" 
                          placeholder="0.00" 
                          data-testid="input-movement-kg" 
                          {...field}
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <CalculatedField 
                label="Цена закупки" 
                value={purchasePrice !== null ? formatNumber(purchasePrice) : "нет цены!"} 
                suffix={purchasePrice !== null ? " ₽/кг" : ""} 
              />
              <CalculatedField label="Сумма покупки" value={formatCurrency(purchaseAmount)} />
              <CalculatedField label="Хранение" value={formatCurrency(storageCost)} />
              <CalculatedField label="Доставка" value={formatCurrency(deliveryCost)} />
              <CalculatedField label="Себестоимость" value={formatNumber(costPerKg)} suffix=" ₽/кг" />
            </div>

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Примечания</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="Дополнительная информация..." 
                    data-testid="input-movement-notes" 
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="flex justify-end gap-4 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-create-movement">
                {createMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{isEditing ? "Обновление..." : "Сохранение..."}</> : <><Plus className="mr-2 h-4 w-4" />{isEditing ? "Обновить" : "Создать"}</>}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}