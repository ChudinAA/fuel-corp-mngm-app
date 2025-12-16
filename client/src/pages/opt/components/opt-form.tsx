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
import { CalendarIcon, Plus, Loader2, ChevronDown } from "lucide-react";
import type { Supplier, Base, Customer, Warehouse, Price, DeliveryCost, LogisticsCarrier, LogisticsDeliveryLocation, LogisticsVehicle, LogisticsTrailer, LogisticsDriver, Opt } from "@shared/schema";
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
      dealDate: editData ? new Date(editData.createdAt) : new Date(),
      supplierId: "",
      buyerId: "",
      warehouseId: "",
      inputMode: "kg",
      quantityLiters: "",
      density: "",
      quantityKg: "",
      carrierId: "",
      deliveryLocationId: "",
      notes: "",
      isApproxVolume: false,
      selectedPurchasePriceId: "",
      selectedSalePriceId: "",
    },
  });

  const { data: suppliers } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  const { data: allBases } = useQuery<Base[]>({
    queryKey: ["/api/bases"],
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
        dealDate: new Date(editData.createdAt),
        supplierId: supplier?.id || "",
        buyerId: buyer?.id || "",
        warehouseId: editData.warehouseId || "",
        inputMode: editData.quantityLiters ? "liters" : "kg",
        quantityLiters: editData.quantityLiters || "",
        density: editData.density || "",
        quantityKg: editData.quantityKg || "",
        carrierId: editData.carrierId || "",
        deliveryLocationId: editData.deliveryLocationId || "",
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

  // Вычисление КГ
  const calculatedKg = inputMode === "liters" && watchLiters && watchDensity
    ? (parseFloat(watchLiters) * parseFloat(watchDensity)).toFixed(2)
    : watchKg || "0";

  const finalKg = parseFloat(calculatedKg || "0");

  // Получение данных поставщика
  const selectedSupplier = suppliers?.find(s => s.id === watchSupplierId);
  const isWarehouseSupplier = selectedSupplier?.isWarehouse || false;
  const supplierWarehouse = warehouses?.find(w => 
    w.supplierId === watchSupplierId
  );

  // Фильтруем базисы типа wholesale
  const bases = allBases?.filter(b => b.baseType === 'wholesale') || [];

  // Автоматический выбор базиса при выборе поставщика
  useEffect(() => {
    if (watchSupplierId && suppliers && allBases) {
      const supplier = suppliers.find(s => s.id === watchSupplierId);
      if (supplier?.baseIds && supplier.baseIds.length > 0) {
        const baseId = supplier.baseIds[0];
        const base = allBases.find(b => b.id === baseId && b.baseType === 'wholesale');
        if (base) {
          setSelectedBasis(base.name);
        }
      }

      // Установить склад если поставщик-склад
      if (supplier?.isWarehouse) {
        const warehouse = warehouses?.find(w => 
          w.supplierId === supplier.id
        );
        if (warehouse) {
          form.setValue("warehouseId", warehouse.id);
        }
      } else {
        form.setValue("warehouseId", "");
      }
    }
  }, [watchSupplierId, suppliers, allBases, warehouses, form]);

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
      p.productType === "kerosine" &&
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
      p.productType === "kerosine" &&
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
    const warehouse = supplierWarehouse;

    // Ищем тариф по baseId/warehouseId и destinationId
    const cost = deliveryCosts.find(dc => {
      const matchesCarrier = dc.carrierId === watchCarrierId;
      const matchesDestination = dc.toEntityType === "delivery_location" && dc.toEntityId === watchDeliveryLocationId;

      let matchesSource = false;
      if (warehouse && dc.fromEntityType === "warehouse" && dc.fromEntityId === warehouse.id) {
        matchesSource = true;
      } else if (base && dc.fromEntityType === "base" && dc.fromEntityId === base.id) {
        matchesSource = true;
      }

      return matchesCarrier && matchesDestination && matchesSource && dc.isActive;
    });

    if (cost?.costPerKg) {
      const totalCost = parseFloat(cost.costPerKg) * finalKg;
      return totalCost;
    }

    return null;
  };

  const purchasePrice = getPurchasePrice();
  const salePrice = getSalePrice();
  const calculatedDeliveryCost = getDeliveryCost();

  const purchaseAmount = purchasePrice !== null && finalKg > 0 ? purchasePrice * finalKg : null;
  const saleAmount = salePrice !== null && finalKg > 0 ? salePrice * finalKg : null;

  const profit = purchaseAmount !== null && saleAmount !== null && calculatedDeliveryCost !== null 
    ? saleAmount - purchaseAmount - calculatedDeliveryCost 
    : purchaseAmount !== null && saleAmount !== null 
      ? saleAmount - purchaseAmount 
      : null;

  const deliveryTariff = calculatedDeliveryCost && finalKg > 0 ? calculatedDeliveryCost / finalKg : null;

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
      
      // Извлекаем ID цены и индекс из составного ID
      let purchasePriceId = null;
      let purchasePriceIndex = 0;
      
      if (!isWarehouseSupplier && selectedPurchasePriceId) {
        const parts = selectedPurchasePriceId.split('-');
        if (parts.length >= 5) {
          // Это UUID формата "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx-index"
          purchasePriceIndex = parseInt(parts[parts.length - 1]);
          purchasePriceId = parts.slice(0, -1).join('-');
        } else {
          purchasePriceId = selectedPurchasePriceId;
        }
      } else if (!isWarehouseSupplier && purchasePrices.length > 0) {
        purchasePriceId = purchasePrices[0].id;
        purchasePriceIndex = 0;
      }
      
      let salePriceId = null;
      let salePriceIndex = 0;
      
      if (selectedSalePriceId) {
        const parts = selectedSalePriceId.split('-');
        if (parts.length >= 5) {
          salePriceIndex = parseInt(parts[parts.length - 1]);
          salePriceId = parts.slice(0, -1).join('-');
        } else {
          salePriceId = selectedSalePriceId;
        }
      } else if (salePrices.length > 0) {
        salePriceId = salePrices[0].id;
        salePriceIndex = 0;
      }

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
        purchasePriceIndex: purchasePriceIndex,
        salePrice: salePrice,
        salePriceId: salePriceId,
        salePriceIndex: salePriceIndex,
        purchaseAmount: purchaseAmount,
        saleAmount: saleAmount,
        deliveryCost: calculatedDeliveryCost,
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
      
      // Извлекаем ID цены и индекс из составного ID
      let purchasePriceId = null;
      let purchasePriceIndex = 0;
      
      if (!isWarehouseSupplier && selectedPurchasePriceId) {
        const parts = selectedPurchasePriceId.split('-');
        if (parts.length >= 5) {
          purchasePriceIndex = parseInt(parts[parts.length - 1]);
          purchasePriceId = parts.slice(0, -1).join('-');
        } else {
          purchasePriceId = selectedPurchasePriceId;
        }
      } else if (!isWarehouseSupplier && purchasePrices.length > 0) {
        purchasePriceId = purchasePrices[0].id;
        purchasePriceIndex = 0;
      }
      
      let salePriceId = null;
      let salePriceIndex = 0;
      
      if (selectedSalePriceId) {
        const parts = selectedSalePriceId.split('-');
        if (parts.length >= 5) {
          salePriceIndex = parseInt(parts[parts.length - 1]);
          salePriceId = parts.slice(0, -1).join('-');
        } else {
          salePriceId = selectedSalePriceId;
        }
      } else if (salePrices.length > 0) {
        salePriceId = salePrices[0].id;
        salePriceIndex = 0;
      }

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
        purchasePriceIndex: purchasePriceIndex,
        salePrice: salePrice,
        salePriceId: salePriceId,
        salePriceIndex: salePriceIndex,
        purchaseAmount: purchaseAmount,
        saleAmount: saleAmount,
        deliveryCost: calculatedDeliveryCost,
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
            render={({ field }) => {
              // Фильтруем поставщиков, у которых есть хотя бы один базис типа wholesale
              const wholesaleSuppliers = suppliers?.filter(supplier => {
                if (!supplier.baseIds || supplier.baseIds.length === 0) return false;
                return allBases?.some(base => 
                  supplier.baseIds.includes(base.id) && base.baseType === 'wholesale'
                );
              }) || [];

              return (
                <FormItem>
                  <FormLabel>Поставщик</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-supplier">
                        <SelectValue placeholder="Выберите поставщика" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {wholesaleSuppliers.length > 0 ? (
                        wholesaleSuppliers.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none" disabled>Нет данных</SelectItem>
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
          {selectedSupplier && selectedSupplier.baseIds && selectedSupplier.baseIds.length > 1 ? (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                Базис
              </FormLabel>
              <Select 
                value={selectedBasis} 
                onValueChange={(value) => {
                  const base = bases?.find(b => b.name === value);
                  if (base) setSelectedBasis(base.name);
                }}
              >
                <FormControl>
                  <SelectTrigger data-testid="select-basis">
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

          {!isWarehouseSupplier && purchasePrices.length > 0 ? (
            <FormField
              control={form.control}
              name="selectedPurchasePriceId"
              render={({ field }) => {
                // Автоматически выбираем первую цену при загрузке
                const firstPriceId = purchasePrices.length > 0 ? `${purchasePrices[0].id}-0` : undefined;
                const effectiveValue = selectedPurchasePriceId || field.value || firstPriceId;

                // Устанавливаем первую цену, если ничего не выбрано
                if (!selectedPurchasePriceId && !field.value && firstPriceId) {
                  setSelectedPurchasePriceId(firstPriceId);
                  field.onChange(firstPriceId);
                }

                return (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">Покупка</FormLabel>
                    <Select 
                      onValueChange={(value) => { 
                        field.onChange(value); 
                        setSelectedPurchasePriceId(value); 
                      }} 
                      value={effectiveValue}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-purchase-price">
                          <SelectValue placeholder="Выберите цену" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {purchasePrices.map((price) => {
                          const priceValues = price.priceValues || [];
                          if (priceValues.length === 0) return null;

                          return priceValues.map((priceValueStr, idx) => {
                            try {
                              const parsed = JSON.parse(priceValueStr);
                              const priceVal = parsed.price || "0";
                              return (
                                <SelectItem key={`${price.id}-${idx}`} value={`${price.id}-${idx}`}>
                                  {formatNumber(priceVal)} ₽/кг
                                </SelectItem>
                              );
                            } catch {
                              return null;
                            }
                          });
                        })}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />
          ) : !isWarehouseSupplier ? (
            <CalculatedField 
              label="Покупка" 
              value="Нет цены!"
              status="error"
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
          {salePrices.length > 0 ? (
            <FormField
              control={form.control}
              name="selectedSalePriceId"
              render={({ field }) => {
                // Автоматически выбираем первую цену при загрузке
                const firstPriceId = salePrices.length > 0 ? `${salePrices[0].id}-0` : undefined;
                const effectiveValue = selectedSalePriceId || field.value || firstPriceId;

                // Устанавливаем первую цену, если ничего не выбрано
                if (!selectedSalePriceId && !field.value && firstPriceId) {
                  setSelectedSalePriceId(firstPriceId);
                  field.onChange(firstPriceId);
                }

                return (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">Продажа</FormLabel>
                    <Select 
                      onValueChange={(value) => { 
                        field.onChange(value); 
                        setSelectedSalePriceId(value); 
                      }} 
                      value={effectiveValue}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-sale-price">
                          <SelectValue placeholder="Выберите цену" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {salePrices.map((price) => {
                          const priceValues = price.priceValues || [];
                          if (priceValues.length === 0) return null;

                          return priceValues.map((priceValueStr, idx) => {
                            try {
                              const parsed = JSON.parse(priceValueStr);
                              const priceVal = parsed.price || "0";
                              return (
                                <SelectItem key={`${price.id}-${idx}`} value={`${price.id}-${idx}`}>
                                  {formatNumber(priceVal)} ₽/кг
                                </SelectItem>
                              );
                            } catch {
                              return null;
                            }
                          });
                        })}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />
          ) : (
            <CalculatedField 
              label="Продажа" 
              value="Нет цены!"
              status="error"
            />
          )}

          <CalculatedField 
            label="Сумма продажи" 
            value={saleAmount !== null ? formatCurrency(saleAmount) : "Ошибка"}
            status={saleAmount !== null ? "ok" : "error"}
          />
          <CalculatedField 
            label="Доставка" 
            value={calculatedDeliveryCost !== null ? formatCurrency(calculatedDeliveryCost) : "—"}
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