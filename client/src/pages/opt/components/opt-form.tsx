
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { CalendarIcon, Plus, Loader2 } from "lucide-react";
import type { WholesaleSupplier, WholesaleBase, Customer, Warehouse, Price, DeliveryCost, LogisticsCarrier, LogisticsDeliveryLocation, LogisticsVehicle, LogisticsTrailer, LogisticsDriver } from "@shared/schema";
import { CalculatedField } from "./calculated-field";
import { optFormSchema, type OptFormData } from "../schemas";
import { formatNumber, formatCurrency } from "../utils";
import type { OptFormProps } from "../types";

export function OptForm({ 
  onSuccess, 
  editData 
}: OptFormProps) {
  const { toast } = useToast();
  const [inputMode, setInputMode] = useState<"liters" | "kg">("kg");
  const [selectedBasis, setSelectedBasis] = useState<string>("");
  const [purchasePrices, setPurchasePrices] = useState<Price[]>([]);
  const [salePrices, setSalePrices] = useState<Price[]>([]);

  const form = useForm<OptFormData>({
    resolver: zodResolver(optFormSchema),
    defaultValues: {
      dealDate: editData ? new Date(editData.dealDate) : new Date(),
      supplierId: "",
      buyerId: "",
      warehouseId: "",
      inputMode: "kg",
      quantityLiters: "",
      density: "",
      quantityKg: "",
      carrierId: "",
      deliveryLocationId: "",
      vehicleNumber: "",
      trailerNumber: "",
      driverName: "",
      notes: "",
      isApproxVolume: false,
      selectedPurchasePriceId: "",
      selectedSalePriceId: "",
    },
  });

  const { data: suppliers } = useQuery<WholesaleSupplier[]>({
    queryKey: ["/api/wholesale/suppliers"],
  });

  const { data: bases } = useQuery<WholesaleBase[]>({
    queryKey: ["/api/wholesale/bases"],
  });

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  // Update form when editData changes
  useEffect(() => {
    if (editData && suppliers && customers) {
      // Find supplier by name (since enrichedData has names in supplierId field)
      const supplier = suppliers.find(s => s.name === editData.supplierId || s.id === editData.supplierId);
      const buyer = customers.find(c => c.name === editData.buyerId || c.id === editData.buyerId);
      
      form.reset({
        dealDate: new Date(editData.dealDate),
        supplierId: supplier?.id || "",
        buyerId: buyer?.id || "",
        warehouseId: editData.warehouseId || "",
        inputMode: editData.quantityLiters ? "liters" : "kg",
        quantityLiters: editData.quantityLiters || "",
        density: editData.density || "",
        quantityKg: editData.quantityKg || "",
        carrierId: editData.carrierId || "",
        deliveryLocationId: editData.deliveryLocationId || "",
        vehicleNumber: editData.vehicleNumber || "",
        trailerNumber: editData.trailerNumber || "",
        driverName: editData.driverName || "",
        notes: editData.notes || "",
        isApproxVolume: editData.isApproxVolume || false,
        selectedPurchasePriceId: editData.purchasePriceId || "",
        selectedSalePriceId: editData.salePriceId || "",
      });
      
      if (editData.quantityLiters) {
        setInputMode("liters");
      }
    }
  }, [editData, suppliers, customers, form]);

  const { data: warehouses } = useQuery<Warehouse[]>({
    queryKey: ["/api/warehouses"],
  });

  const { data: carriers } = useQuery<LogisticsCarrier[]>({
    queryKey: ["/api/logistics/carriers"],
  });

  const { data: deliveryLocations } = useQuery<LogisticsDeliveryLocation[]>({
    queryKey: ["/api/logistics/delivery-locations"],
  });

  const { data: vehicles } = useQuery<LogisticsVehicle[]>({
    queryKey: ["/api/logistics/vehicles"],
  });

  const { data: trailers } = useQuery<LogisticsTrailer[]>({
    queryKey: ["/api/logistics/trailers"],
  });

  const { data: drivers } = useQuery<LogisticsDriver[]>({
    queryKey: ["/api/logistics/drivers"],
  });

  const { data: allPrices } = useQuery<Price[]>({
    queryKey: ["/api/prices"],
  });

  const { data: deliveryCosts } = useQuery<DeliveryCost[]>({
    queryKey: ["/api/delivery-costs"],
  });

  const watchSupplierId = form.watch("supplierId");
  const watchBuyerId = form.watch("buyerId");
  const watchDealDate = form.watch("dealDate");
  const watchLiters = form.watch("quantityLiters");
  const watchDensity = form.watch("density");
  const watchKg = form.watch("quantityKg");
  const watchCarrierId = form.watch("carrierId");
  const watchDeliveryLocationId = form.watch("deliveryLocationId");
  const watchWarehouseId = form.watch("warehouseId");
  const watchSelectedPurchasePriceId = form.watch("selectedPurchasePriceId");
  const watchSelectedSalePriceId = form.watch("selectedSalePriceId");

  // Вычисление КГ
  const calculatedKg = inputMode === "liters" && watchLiters && watchDensity
    ? (parseFloat(watchLiters) * parseFloat(watchDensity)).toFixed(2)
    : watchKg;

  const finalKg = parseFloat(calculatedKg || "0");

  // Автоматический выбор базиса и склада при выборе поставщика
  useEffect(() => {
    if (watchSupplierId && suppliers && bases && warehouses) {
      const supplier = suppliers.find(s => s.id === watchSupplierId);
      if (supplier?.defaultBaseId) {
        const base = bases.find(b => b.id === supplier.defaultBaseId);
        if (base) {
          setSelectedBasis(base.name);
          
          // Найти склад с таким же base_id
          const warehouse = warehouses.find(w => w.baseId === supplier.defaultBaseId);
          if (warehouse) {
            form.setValue("warehouseId", warehouse.id);
          }
        }
      }
    }
  }, [watchSupplierId, suppliers, bases, warehouses, form]);

  // Фильтрация цен покупки (от поставщика)
  useEffect(() => {
    if (watchSupplierId && watchDealDate && allPrices && selectedBasis) {
      const dateStr = format(watchDealDate, "yyyy-MM-dd");
      const filtered = allPrices.filter(p => 
        p.counterpartyId === watchSupplierId &&
        p.counterpartyType === "wholesale" &&
        p.counterpartyRole === "supplier" &&
        p.basis === selectedBasis &&
        p.dateFrom <= dateStr &&
        p.dateTo >= dateStr &&
        p.isActive
      );
      setPurchasePrices(filtered);
      
      if (filtered.length > 0 && !watchSelectedPurchasePriceId) {
        form.setValue("selectedPurchasePriceId", filtered[0].id);
      }
    } else {
      setPurchasePrices([]);
    }
  }, [watchSupplierId, watchDealDate, allPrices, selectedBasis, watchSelectedPurchasePriceId, form]);

  // Фильтрация цен продажи (для покупателя)
  useEffect(() => {
    if (watchBuyerId && watchDealDate && allPrices && selectedBasis) {
      const dateStr = format(watchDealDate, "yyyy-MM-dd");
      const filtered = allPrices.filter(p => 
        p.counterpartyId === watchBuyerId &&
        p.counterpartyType === "wholesale" &&
        p.counterpartyRole === "buyer" &&
        p.basis === selectedBasis &&
        p.dateFrom <= dateStr &&
        p.dateTo >= dateStr &&
        p.isActive
      );
      setSalePrices(filtered);
      
      if (filtered.length > 0 && !watchSelectedSalePriceId) {
        form.setValue("selectedSalePriceId", filtered[0].id);
      }
    } else {
      setSalePrices([]);
    }
  }, [watchBuyerId, watchDealDate, allPrices, selectedBasis, watchSelectedSalePriceId, form]);

  // Получение цены покупки
  const getPurchasePrice = (): number | null => {
    if (watchSelectedPurchasePriceId && purchasePrices.length > 0) {
      const price = purchasePrices.find(p => p.id === watchSelectedPurchasePriceId);
      if (price?.priceValues && price.priceValues.length > 0) {
        try {
          const firstPrice = JSON.parse(price.priceValues[0]);
          return parseFloat(firstPrice.price || "0");
        } catch {
          return null;
        }
      }
    }
    
    // Если нет в таблице цен, попробовать взять из склада
    if (watchWarehouseId && warehouses) {
      const warehouse = warehouses.find(w => w.id === watchWarehouseId);
      if (warehouse?.averageCost) {
        return parseFloat(warehouse.averageCost);
      }
    }
    
    return null;
  };

  // Получение цены продажи
  const getSalePrice = (): number | null => {
    if (watchSelectedSalePriceId && salePrices.length > 0) {
      const price = salePrices.find(p => p.id === watchSelectedSalePriceId);
      if (price?.priceValues && price.priceValues.length > 0) {
        try {
          const firstPrice = JSON.parse(price.priceValues[0]);
          return parseFloat(firstPrice.price || "0");
        } catch {
          return null;
        }
      }
    }
    return null;
  };

  // Получение стоимости доставки
  const getDeliveryCost = (): number | null => {
    console.log("=== getDeliveryCost called ===");
    console.log("watchDeliveryLocationId:", watchDeliveryLocationId);
    console.log("watchCarrierId:", watchCarrierId);
    console.log("selectedBasis:", selectedBasis);
    console.log("finalKg:", finalKg);
    console.log("deliveryCosts:", deliveryCosts);
    console.log("bases:", bases);
    
    if (!watchDeliveryLocationId || !watchCarrierId || !deliveryCosts || !finalKg || finalKg <= 0) {
      console.log("Missing required data for delivery cost calculation");
      return null;
    }
    
    // Находим baseId по selectedBasis
    const base = bases?.find(b => b.name === selectedBasis);
    if (!base) {
      console.log("Base not found for selectedBasis:", selectedBasis);
      return null;
    }

    console.log("Found base.id:", base.id);
    
    // Ищем тариф по baseId и destinationId
    const cost = deliveryCosts.find(dc => {
      console.log("Checking delivery cost:", {
        dcBaseId: dc.baseId,
        dcDestinationId: dc.destinationId,
        dcCarrierId: dc.carrierId,
        dcIsActive: dc.isActive,
        matches: dc.baseId === base.id && dc.destinationId === watchDeliveryLocationId && dc.carrierId === watchCarrierId && dc.isActive
      });
      return dc.baseId === base.id &&
        dc.destinationId === watchDeliveryLocationId &&
        dc.carrierId === watchCarrierId &&
        dc.isActive;
    });
    
    console.log("Found delivery cost:", cost);
    
    if (cost?.costPerKg) {
      const totalCost = parseFloat(cost.costPerKg) * finalKg;
      console.log("Calculated delivery cost:", totalCost);
      return totalCost;
    }
    
    console.log("No valid cost found");
    return null;
  };

  const purchasePrice = getPurchasePrice();
  const salePrice = getSalePrice();
  const deliveryCost = getDeliveryCost();

  const purchaseAmount = purchasePrice !== null && finalKg > 0 ? purchasePrice * finalKg : null;
  const saleAmount = salePrice !== null && finalKg > 0 ? salePrice * finalKg : null;
  const profit = purchaseAmount !== null && saleAmount !== null && deliveryCost !== null 
    ? saleAmount - purchaseAmount - deliveryCost 
    : purchaseAmount !== null && saleAmount !== null 
      ? saleAmount - purchaseAmount 
      : null;

  // Проверка остатка на складе
  const getWarehouseStatus = (): { status: "ok" | "warning" | "error"; message: string } => {
    if (!watchWarehouseId || !warehouses || finalKg <= 0) {
      return { status: "ok", message: "—" };
    }

    const warehouse = warehouses.find(w => w.id === watchWarehouseId);
    if (!warehouse) {
      return { status: "error", message: "Склад не найден" };
    }

    const currentBalance = parseFloat(warehouse.currentBalance || "0");
    const remaining = currentBalance - finalKg;

    if (remaining >= 0) {
      return { status: "ok", message: `ОК: ${formatNumber(remaining)} кг` };
    } else {
      return { status: "error", message: `Недостаточно! Доступно: ${formatNumber(currentBalance)} кг` };
    }
  };

  const warehouseStatus = getWarehouseStatus();

  const createMutation = useMutation({
    mutationFn: async (data: OptFormData) => {
      const payload = {
        ...data,
        supplierId: data.supplierId,
        buyerId: data.buyerId,
        warehouseId: data.warehouseId || null,
        basis: selectedBasis,
        carrierId: data.carrierId || null,
        deliveryLocationId: data.deliveryLocationId || null,
        dealDate: format(data.dealDate, "yyyy-MM-dd"),
        quantityKg: parseFloat(calculatedKg),
        quantityLiters: data.quantityLiters ? parseFloat(data.quantityLiters) : null,
        density: data.density ? parseFloat(data.density) : null,
        purchasePrice: purchasePrice,
        purchasePriceId: watchSelectedPurchasePriceId || null,
        salePrice: salePrice,
        salePriceId: watchSelectedSalePriceId || null,
        purchaseAmount: purchaseAmount,
        saleAmount: saleAmount,
        deliveryCost: deliveryCost,
        deliveryTariff: deliveryCost && finalKg > 0 ? deliveryCost / finalKg : null,
        profit: profit,
      };
      const res = await apiRequest("POST", "/api/opt", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key?.startsWith('/api/opt') || key?.startsWith('/api/warehouses');
        }
      });
      toast({ title: "Сделка создана", description: "Оптовая сделка успешно сохранена" });
      form.reset();
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({ 
        title: "Ошибка", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: OptFormData & { id: string }) => {
      const payload = {
        ...data,
        supplierId: data.supplierId,
        buyerId: data.buyerId,
        warehouseId: data.warehouseId || null,
        basis: selectedBasis,
        carrierId: data.carrierId || null,
        deliveryLocationId: data.deliveryLocationId || null,
        dealDate: format(data.dealDate, "yyyy-MM-dd"),
        quantityKg: parseFloat(calculatedKg),
        quantityLiters: data.quantityLiters ? parseFloat(data.quantityLiters) : null,
        density: data.density ? parseFloat(data.density) : null,
        purchasePrice: purchasePrice,
        purchasePriceId: watchSelectedPurchasePriceId || null,
        salePrice: salePrice,
        salePriceId: watchSelectedSalePriceId || null,
        purchaseAmount: purchaseAmount,
        saleAmount: saleAmount,
        deliveryCost: deliveryCost,
        deliveryTariff: deliveryCost && finalKg > 0 ? deliveryCost / finalKg : null,
        profit: profit,
      };
      const res = await apiRequest("PATCH", `/api/opt/${data.id}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key?.startsWith('/api/opt') || key?.startsWith('/api/warehouses');
        }
      });
      toast({ title: "Сделка обновлена", description: "Оптовая сделка успешно обновлена" });
      form.reset();
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({ 
        title: "Ошибка", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  const onSubmit = (data: OptFormData) => {
    if (editData) {
      updateMutation.mutate({ ...data, id: editData.id });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <FormField
            control={form.control}
            name="dealDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Дата сделки</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                        data-testid="input-deal-date"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(field.value, "dd.MM.yyyy", { locale: ru }) : "Выберите дату"}
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      locale={ru}
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="supplierId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Поставщик</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-supplier">
                      <SelectValue placeholder="Выберите поставщика" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {suppliers?.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    )) || (
                      <SelectItem value="none" disabled>Нет данных</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="buyerId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Покупатель</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-buyer">
                      <SelectValue placeholder="Выберите покупателя" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {customers?.filter(c => c.module === "wholesale" || c.module === "both").map((buyer) => (
                      <SelectItem key={buyer.id} value={buyer.id}>
                        {buyer.name}
                      </SelectItem>
                    )) || (
                      <SelectItem value="none" disabled>Нет данных</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="warehouseId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Склад</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-warehouse">
                      <SelectValue placeholder="Выберите склад" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {warehouses?.map((warehouse) => (
                      <SelectItem key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </SelectItem>
                    )) || (
                      <SelectItem value="none" disabled>Нет данных</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-lg">Объем топлива</CardTitle>
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground">Литры/Плотность</Label>
                <Switch
                  checked={inputMode === "kg"}
                  onCheckedChange={(checked) => setInputMode(checked ? "kg" : "liters")}
                  data-testid="switch-input-mode"
                />
                <Label className="text-sm text-muted-foreground">КГ</Label>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {inputMode === "liters" ? (
                <>
                  <FormField
                    control={form.control}
                    name="quantityLiters"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Литры</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            data-testid="input-liters"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="density"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Плотность</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="0"
                            step="0.0001"
                            placeholder="0.8000"
                            data-testid="input-density"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <CalculatedField 
                    label="КГ (расчет)" 
                    value={formatNumber(calculatedKg)}
                    suffix=" кг"
                  />
                </>
              ) : (
                <FormField
                  control={form.control}
                  name="quantityKg"
                  render={({ field }) => (
                    <FormItem className="md:col-span-3">
                      <FormLabel>Количество (КГ)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          data-testid="input-kg"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <CalculatedField 
            label="Объем на складе" 
            value={warehouseStatus.message}
            status={warehouseStatus.status}
          />
          
          {purchasePrices.length > 1 ? (
            <FormField
              control={form.control}
              name="selectedPurchasePriceId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Покупка</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите цену" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {purchasePrices.map((price) => {
                        const priceVal = price.priceValues?.[0] ? JSON.parse(price.priceValues[0]).price : "0";
                        return (
                          <SelectItem key={price.id} value={price.id}>
                            {formatNumber(priceVal)} ₽/кг
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : (
            <CalculatedField 
              label="Покупка" 
              value={purchasePrice !== null ? formatNumber(purchasePrice) : "Нет цены!"}
              suffix={purchasePrice !== null ? " ₽/кг" : ""}
              status={purchasePrice !== null ? "ok" : "error"}
            />
          )}

          <CalculatedField 
            label="Сумма закупки" 
            value={purchaseAmount !== null ? formatCurrency(purchaseAmount) : "Ошибка"}
            status={purchaseAmount !== null ? "ok" : "error"}
          />
          <CalculatedField 
            label="Базис" 
            value={selectedBasis || "—"}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {salePrices.length > 1 ? (
            <FormField
              control={form.control}
              name="selectedSalePriceId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Продажа</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите цену" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {salePrices.map((price) => {
                        const priceVal = price.priceValues?.[0] ? JSON.parse(price.priceValues[0]).price : "0";
                        return (
                          <SelectItem key={price.id} value={price.id}>
                            {formatNumber(priceVal)} ₽/кг
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : (
            <CalculatedField 
              label="Продажа" 
              value={salePrice !== null ? formatNumber(salePrice) : "Нет цены!"}
              suffix={salePrice !== null ? " ₽/кг" : ""}
              status={salePrice !== null ? "ok" : "error"}
            />
          )}

          <CalculatedField 
            label="Сумма продажи" 
            value={saleAmount !== null ? formatCurrency(saleAmount) : "Ошибка"}
            status={saleAmount !== null ? "ok" : "error"}
          />
          <CalculatedField 
            label="Доставка" 
            value={deliveryCost !== null ? formatCurrency(deliveryCost) : "—"}
          />
          <CalculatedField 
            label="Прибыль" 
            value={profit !== null ? formatCurrency(profit) : "—"}
            status={profit !== null && profit >= 0 ? "ok" : profit !== null ? "warning" : undefined}
          />
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Логистика</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <FormField
                control={form.control}
                name="carrierId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Перевозчик</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-carrier">
                          <SelectValue placeholder="Выберите перевозчика" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {carriers?.map((carrier) => (
                          <SelectItem key={carrier.id} value={carrier.id}>
                            {carrier.name}
                          </SelectItem>
                        )) || (
                          <SelectItem value="none" disabled>Нет данных</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="deliveryLocationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Место доставки</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-delivery-location">
                          <SelectValue placeholder="Выберите место" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {deliveryLocations?.map((location) => (
                          <SelectItem key={location.id} value={location.id}>
                            {location.name}
                          </SelectItem>
                        )) || (
                          <SelectItem value="none" disabled>Нет данных</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="vehicleNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Госномер</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-vehicle">
                          <SelectValue placeholder="Выберите номер" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {vehicles?.map((vehicle) => (
                          <SelectItem key={vehicle.id} value={vehicle.regNumber}>
                            {vehicle.regNumber}
                          </SelectItem>
                        )) || (
                          <SelectItem value="none" disabled>Нет данных</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="trailerNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Госномер ПП</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-trailer">
                          <SelectValue placeholder="Выберите номер" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {trailers?.map((trailer) => (
                          <SelectItem key={trailer.id} value={trailer.regNumber}>
                            {trailer.regNumber}
                          </SelectItem>
                        )) || (
                          <SelectItem value="none" disabled>Нет данных</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="driverName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ФИО водителя</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-driver">
                          <SelectValue placeholder="Выберите водителя" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {drivers?.map((driver) => (
                          <SelectItem key={driver.id} value={driver.fullName}>
                            {driver.fullName}
                          </SelectItem>
                        )) || (
                          <SelectItem value="none" disabled>Нет данных</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Примечания</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Дополнительная информация..."
                    className="resize-none"
                    data-testid="input-notes"
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-4">
            <FormField
              control={form.control}
              name="isApproxVolume"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0 pt-6">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="checkbox-approx-volume"
                    />
                  </FormControl>
                  <FormLabel className="text-sm font-normal cursor-pointer">
                    Примерный объем (требует уточнения)
                  </FormLabel>
                </FormItem>
              )}
            />

            <CalculatedField 
              label="Накопительно" 
              value="—"
              status="ok"
            />
          </div>
        </div>

        <div className="flex justify-end gap-4 pt-4 border-t">
          <Button 
            type="button" 
            variant="outline"
            onClick={() => {
              form.reset();
              onSuccess?.();
            }}
          >
            {editData ? "Отмена" : "Очистить"}
          </Button>
          <Button 
            type="submit" 
            disabled={createMutation.isPending || updateMutation.isPending}
            data-testid="button-submit-opt"
          >
            {createMutation.isPending || updateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {editData ? "Сохранение..." : "Создание..."}
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                {editData ? "Сохранить изменения" : "Создать сделку"}
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
