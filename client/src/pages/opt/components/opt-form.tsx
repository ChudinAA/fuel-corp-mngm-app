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
import type { WholesaleSupplier, WholesaleBase, Customer, Warehouse, Price, DeliveryCost, LogisticsCarrier, LogisticsDeliveryLocation, LogisticsVehicle, LogisticsTrailer, LogisticsDriver, Opt } from "@shared/schema";
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
  const [selectedPurchasePriceId, setSelectedPurchasePriceId] = useState<string>("");
  const [selectedSalePriceId, setSelectedSalePriceId] = useState<string>("");
  const isEditing = !!editData;

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

      setSelectedPurchasePriceId(editData.purchasePriceId || "");
      setSelectedSalePriceId(editData.salePriceId || "");

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

  const { data: allDeals } = useQuery<{ data: Opt[] }>({
    queryKey: ["/api/opt"],
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

  // Вычисление КГ
  const calculatedKg = inputMode === "liters" && watchLiters && watchDensity
    ? (parseFloat(watchLiters) * parseFloat(watchDensity)).toFixed(2)
    : watchKg || "0";

  const finalKg = parseFloat(calculatedKg || "0");

  // Получение данных поставщика
  const selectedSupplier = suppliers?.find(s => s.id === watchSupplierId);
  const isWarehouseSupplier = selectedSupplier?.isWarehouse || false;
  const supplierWarehouse = warehouses?.find(w => 
    w.supplierType === "wholesale" && w.supplierId === watchSupplierId
  );

  // Автоматический выбор базиса при выборе поставщика
  useEffect(() => {
    if (watchSupplierId && suppliers && bases) {
      const supplier = suppliers.find(s => s.id === watchSupplierId);
      if (supplier?.baseIds && supplier.baseIds.length > 0) {
        const baseId = supplier.baseIds[0];
        const base = bases.find(b => b.id === baseId);
        if (base) {
          setSelectedBasis(base.name);
        }
      }

      // Установить склад если поставщик-склад
      if (supplier?.isWarehouse) {
        const warehouse = warehouses?.find(w => 
          w.supplierType === "wholesale" && w.supplierId === supplier.id
        );
        if (warehouse) {
          form.setValue("warehouseId", warehouse.id);
        }
      } else {
        form.setValue("warehouseId", "");
      }
    }
  }, [watchSupplierId, suppliers, bases, warehouses, form]);

  // Фильтрация цен покупки (от поставщика)
  const getMatchingPurchasePrices = () => {
    if (!watchSupplierId || !selectedBasis || !watchDealDate) return [];

    const dateStr = format(watchDealDate, "yyyy-MM-dd");
    const supplier = suppliers?.find(s => s.id === watchSupplierId);
    if (!supplier) return [];

    return allPrices?.filter(p =>
      p.counterpartyId === watchSupplierId &&
      p.counterpartyType === "wholesale" &&
      p.counterpartyRole === "supplier" &&
      p.basis === selectedBasis &&
      p.dateFrom <= dateStr &&
      p.dateTo >= dateStr &&
      p.isActive
    ) || [];
  };

  const purchasePrices = getMatchingPurchasePrices();

  // Фильтрация цен продажи (для покупателя)
  const getMatchingSalePrices = () => {
    if (!watchBuyerId || !selectedBasis || !watchDealDate) return [];

    const dateStr = format(watchDealDate, "yyyy-MM-dd");
    const buyer = customers?.find(c => c.id === watchBuyerId);
    if (!buyer) return [];

    return allPrices?.filter(p =>
      p.counterpartyId === watchBuyerId &&
      p.counterpartyType === "wholesale" &&
      p.counterpartyRole === "buyer" &&
      p.dateFrom <= dateStr &&
      p.dateTo >= dateStr &&
      p.isActive
    ) || [];
  };

  const salePrices = getMatchingSalePrices();

  // Получение цены покупки
  const getPurchasePrice = (): number | null => {
    // Если поставщик-склад, берем себестоимость со склада
    if (isWarehouseSupplier && supplierWarehouse) {
      return parseFloat(supplierWarehouse.averageCost || "0");
    }

    // Иначе берем из таблицы цен
    const matchingPrices = getMatchingPurchasePrices();
    if (matchingPrices.length === 0) return null;

    let selectedPrice = matchingPrices[0];
    if (selectedPurchasePriceId) {
      const found = matchingPrices.find(p => p.id === selectedPurchasePriceId);
      if (found) selectedPrice = found;
    } else if (editData && editData.purchasePriceId) {
      const found = matchingPrices.find(p => p.id === editData.purchasePriceId);
      if (found) selectedPrice = found;
    }

    if (selectedPrice && selectedPrice.priceValues && selectedPrice.priceValues.length > 0) {
      try {
        const priceObj = JSON.parse(selectedPrice.priceValues[0]);
        return parseFloat(priceObj.price || "0");
      } catch {
        return null;
      }
    }

    return null;
  };

  // Получение цены продажи
  const getSalePrice = (): number | null => {
    const matchingPrices = getMatchingSalePrices();
    if (matchingPrices.length === 0) return null;

    let selectedPrice = matchingPrices[0];
    if (selectedSalePriceId) {
      const found = matchingPrices.find(p => p.id === selectedSalePriceId);
      if (found) selectedPrice = found;
    } else if (editData && editData.salePriceId) {
      const found = matchingPrices.find(p => p.id === editData.salePriceId);
      if (found) selectedPrice = found;
    }

    if (selectedPrice && selectedPrice.priceValues && selectedPrice.priceValues.length > 0) {
      try {
        const priceObj = JSON.parse(selectedPrice.priceValues[0]);
        return parseFloat(priceObj.price || "0");
      } catch {
        return null;
      }
    }
    return null;
  };

  // Получение стоимости доставки
  const getDeliveryCost = (): number | null => {
    if (!watchDeliveryLocationId || !watchCarrierId || !deliveryCosts || !finalKg || finalKg <= 0) {
      return null;
    }

    // Находим baseId по selectedBasis
    const base = bases?.find(b => b.name === selectedBasis);
    if (!base) return null;

    // Ищем тариф по baseId и destinationId
    const cost = deliveryCosts.find(dc => {
      return dc.baseId === base.id &&
        dc.destinationId === watchDeliveryLocationId &&
        dc.carrierId === watchCarrierId &&
        dc.isActive;
    });

    if (cost?.costPerKg) {
      const totalCost = parseFloat(cost.costPerKg) * finalKg;
      return totalCost;
    }

    return null;
  };

  const purchasePrice = getPurchasePrice();
  const salePrice = getSalePrice();
  const deliveryCost = getDeliveryCost();

  const purchaseAmount = purchasePrice !== null && finalKg > 0 ? purchasePrice * finalKg : null;
  const saleAmount = salePrice !== null && finalKg > 0 ? salePrice * finalKg : null;

  const getCumulativeProfit = (): number => {
    if (!watchDealDate || !allDeals?.data) return 0;

    const currentDate = new Date(watchDealDate);
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

    let cumulative = 0;
    allDeals.data.forEach(deal => {
      const dealDate = new Date(deal.dealDate);
      if (dealDate.getMonth() === currentMonth && dealDate.getFullYear() === currentYear) {
        cumulative += parseFloat(deal.profit);
      }
    });

    return cumulative;
  };

  const cumulativeProfit = getCumulativeProfit();

  // Получение стоимости доставки с учетом типов сущностей
  const getDeliveryCostValue = (): number | null => {
    if (!watchCarrierId || !deliveryCosts || finalKg <= 0) return null;

    // Если есть склад поставщика, ищем тариф от склада
    if (isWarehouseSupplier && supplierWarehouse && watchDeliveryLocationId) {
      const cost = deliveryCosts.find(dc =>
        dc.carrierId === watchCarrierId &&
        dc.fromEntityType === "warehouse" &&
        dc.fromEntityId === supplierWarehouse.id &&
        dc.toEntityType === "delivery_location" &&
        dc.toEntityId === watchDeliveryLocationId
      );
      
      if (cost && cost.costPerKg) {
        return parseFloat(cost.costPerKg.toString()) * finalKg;
      }
    }

    // Если нет склада, ищем тариф от базиса
    if (!isWarehouseSupplier && selectedBasis && watchDeliveryLocationId) {
      const base = bases?.find(b => b.name === selectedBasis);
      if (base) {
        const cost = deliveryCosts.find(dc =>
          dc.carrierId === watchCarrierId &&
          dc.fromEntityType === "base" &&
          dc.fromEntityId === base.id &&
          dc.toEntityType === "delivery_location" &&
          dc.toEntityId === watchDeliveryLocationId
        );
        
        if (cost && cost.costPerKg) {
          return parseFloat(cost.costPerKg.toString()) * finalKg;
        }
      }
    }

    return null;
  };

  const calculatedDeliveryCost = getDeliveryCostValue();

  const profit = purchaseAmount !== null && saleAmount !== null && calculatedDeliveryCost !== null 
    ? saleAmount - purchaseAmount - calculatedDeliveryCost 
    : purchaseAmount !== null && saleAmount !== null 
      ? saleAmount - purchaseAmount 
      : null;
      
  const deliveryTariff = deliveryCost && finalKg > 0 ? deliveryCost / finalKg : null;

  // Проверка остатка на складе
  const getWarehouseStatus = (): { status: "ok" | "warning" | "error"; message: string } => {
    // Если поставщик не со склада
    if (!isWarehouseSupplier) {
      return { status: "ok", message: "ОК" };
    }

    // Если поставщик-склад
    if (!supplierWarehouse || finalKg <= 0) {
      return { status: "ok", message: "—" };
    }

    const currentBalance = parseFloat(supplierWarehouse.currentBalance || "0");
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
      const purchasePrices = getMatchingPurchasePrices();
      const salePrices = getMatchingSalePrices();
      const purchasePriceId = !isWarehouseSupplier && selectedPurchasePriceId 
        ? selectedPurchasePriceId 
        : (!isWarehouseSupplier && purchasePrices.length > 0 ? purchasePrices[0].id : null);
      const salePriceId = selectedSalePriceId || (salePrices.length > 0 ? salePrices[0].id : null);

      const payload = {
        ...data,
        supplierId: data.supplierId,
        buyerId: data.buyerId,
        warehouseId: isWarehouseSupplier && supplierWarehouse ? supplierWarehouse.id : null,
        basis: selectedBasis,
        carrierId: data.carrierId || null,
        deliveryLocationId: data.deliveryLocationId || null,
        dealDate: format(data.dealDate, "yyyy-MM-dd"),
        quantityKg: parseFloat(calculatedKg),
        quantityLiters: data.quantityLiters ? parseFloat(data.quantityLiters) : null,
        density: data.density ? parseFloat(data.density) : null,
        purchasePrice: purchasePrice,
        purchasePriceId: purchasePriceId,
        salePrice: salePrice,
        salePriceId: salePriceId,
        purchaseAmount: purchaseAmount,
        saleAmount: saleAmount,
        deliveryCost: deliveryCost,
        deliveryTariff: deliveryTariff,
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
      setSelectedPurchasePriceId("");
      setSelectedSalePriceId("");
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
      const purchasePrices = getMatchingPurchasePrices();
      const salePrices = getMatchingSalePrices();
      const purchasePriceId = !isWarehouseSupplier && selectedPurchasePriceId 
        ? selectedPurchasePriceId 
        : (!isWarehouseSupplier && purchasePrices.length > 0 ? purchasePrices[0].id : null);
      const salePriceId = selectedSalePriceId || (salePrices.length > 0 ? salePrices[0].id : null);

      const payload = {
        ...data,
        supplierId: data.supplierId,
        buyerId: data.buyerId,
        warehouseId: isWarehouseSupplier && supplierWarehouse ? supplierWarehouse.id : null,
        basis: selectedBasis,
        carrierId: data.carrierId || null,
        deliveryLocationId: data.deliveryLocationId || null,
        dealDate: format(data.dealDate, "yyyy-MM-dd"),
        quantityKg: parseFloat(calculatedKg),
        quantityLiters: data.quantityLiters ? parseFloat(data.quantityLiters) : null,
        density: data.density ? parseFloat(data.density) : null,
        purchasePrice: purchasePrice,
        purchasePriceId: purchasePriceId,
        salePrice: salePrice,
        salePriceId: salePriceId,
        purchaseAmount: purchaseAmount,
        saleAmount: saleAmount,
        deliveryCost: deliveryCost,
        deliveryTariff: deliveryTariff,
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
      setSelectedPurchasePriceId("");
      setSelectedSalePriceId("");
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

          <FormItem>
            <FormLabel>Склад</FormLabel>
            <FormControl>
              <Input 
                value={
                  isWarehouseSupplier && supplierWarehouse 
                    ? supplierWarehouse.name 
                    : "Объем не со склада"
                }
                disabled
                className="bg-muted"
              />
            </FormControl>
          </FormItem>
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
                            value={field.value || ""}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            name={field.name}
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
          {selectedSupplier && selectedSupplier.baseIds && selectedSupplier.baseIds.length > 1 ? (
            <FormItem>
              <FormLabel>Базис</FormLabel>
              <Select 
                value={selectedBasis} 
                onValueChange={(value) => {
                  const base = bases?.find(b => b.name === value);
                  if (base) setSelectedBasis(base.name);
                }}
              >
                <FormControl>
                  <SelectTrigger data-testid="select-basis" className="relative">
                    <SelectValue placeholder="Выберите базис" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {selectedSupplier.baseIds.map((baseId) => {
                    const base = bases?.find(b => b.id === baseId);
                    return base ? (
                      <SelectItem key={base.id} value={base.name}>
                        {base.name}
                      </SelectItem>
                    ) : null;
                  })}
                </SelectContent>
              </Select>
            </FormItem>
          ) : (
            <CalculatedField 
              label="Базис" 
              value={selectedBasis || "—"}
            />
          )}

          <CalculatedField 
            label="Объем на складе" 
            value={warehouseStatus.message}
            status={warehouseStatus.status}
          />

          {!isWarehouseSupplier && purchasePrices.length > 1 ? (
            <FormField
              control={form.control}
              name="selectedPurchasePriceId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Покупка</FormLabel>
                  <Select 
                    onValueChange={(value) => { 
                      field.onChange(value); 
                      setSelectedPurchasePriceId(value); 
                    }} 
                    value={selectedPurchasePriceId || field.value}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-purchase-price" className="relative">
                        <SelectValue placeholder="Выберите цену" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {purchasePrices.map((price) => {
                        const priceValues = price.priceValues || [];
                        return priceValues.map((pv: string, idx: number) => {
                          try {
                            const parsed = JSON.parse(pv);
                            const priceVal = parsed.price || "0";
                            return (
                              <SelectItem key={`${price.id}-${idx}`} value={price.id}>
                                {formatNumber(priceVal)} ₽/кг
                              </SelectItem>
                            );
                          } catch {
                            return null;
                          }
                        }).filter(Boolean);
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
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {salePrices.length > 1 ? (
            <FormField
              control={form.control}
              name="selectedSalePriceId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Продажа</FormLabel>
                  <Select 
                    onValueChange={(value) => { 
                      field.onChange(value); 
                      setSelectedSalePriceId(value); 
                    }} 
                    value={selectedSalePriceId || field.value}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-sale-price" className="relative">
                        <SelectValue placeholder="Выберите цену" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {salePrices.map((price) => {
                        const priceValues = price.priceValues || [];
                        return priceValues.map((pv: string, idx: number) => {
                          try {
                            const parsed = JSON.parse(pv);
                            const priceVal = parsed.price || "0";
                            return (
                              <SelectItem key={`${price.id}-${idx}`} value={price.id}>
                                {formatNumber(priceVal)} ₽/кг
                              </SelectItem>
                            );
                          } catch {
                            return null;
                          }
                        }).filter(Boolean);
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
                render={({ field }) => {
                  // Фильтруем перевозчиков, у которых есть тарифы с текущим базисом
                  const availableCarriers = carriers?.filter(carrier => {
                    if (!selectedBasis || !deliveryCosts) return true;
                    
                    const base = bases?.find(b => b.name === selectedBasis);
                    if (!base) return true;

                    const warehouse = supplierWarehouse;
                    
                    return deliveryCosts.some(dc => 
                      dc.carrierId === carrier.id &&
                      (
                        (dc.fromEntityType === "base" && dc.fromEntityId === base.id) ||
                        (warehouse && dc.fromEntityType === "warehouse" && dc.fromEntityId === warehouse.id)
                      )
                    );
                  }) || [];

                  return (
                    <FormItem>
                      <FormLabel>Перевозчик</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-carrier">
                            <SelectValue placeholder="Выберите перевозчика" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableCarriers.length > 0 ? (
                            availableCarriers.map((carrier) => (
                              <SelectItem key={carrier.id} value={carrier.id}>
                                {carrier.name}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="none" disabled>Нет доступных перевозчиков</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              <FormField
                control={form.control}
                name="deliveryLocationId"
                render={({ field }) => {
                  // Фильтруем места доставки, для которых есть тарифы с выбранным перевозчиком и базисом/складом
                  const availableLocations = deliveryLocations?.filter(location => {
                    if (!watchCarrierId || !deliveryCosts) return true;
                    
                    const base = bases?.find(b => b.name === selectedBasis);
                    const warehouse = supplierWarehouse;
                    
                    return deliveryCosts.some(dc => 
                      dc.carrierId === watchCarrierId &&
                      dc.toEntityType === "delivery_location" &&
                      dc.toEntityId === location.id &&
                      (
                        (base && dc.fromEntityType === "base" && dc.fromEntityId === base.id) ||
                        (warehouse && dc.fromEntityType === "warehouse" && dc.fromEntityId === warehouse.id)
                      )
                    );
                  }) || [];

                  return (
                    <FormItem>
                      <FormLabel>Место доставки</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-delivery-location">
                            <SelectValue placeholder="Выберите место" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableLocations.length > 0 ? (
                            availableLocations.map((location) => (
                              <SelectItem key={location.id} value={location.id}>
                                {location.name}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="none" disabled>Нет доступных мест доставки</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  );
                }}
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
        </div>

        <div className="flex justify-end gap-4 pt-4 border-t">
          <Button 
            type="button" 
            variant="outline"
            onClick={() => {
              form.reset();
              setSelectedPurchasePriceId("");
              setSelectedSalePriceId("");
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