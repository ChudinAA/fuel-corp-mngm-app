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
import { CalendarIcon, Plus, Loader2, AlertCircle, ChevronDown } from "lucide-react";
import type { Supplier, Base, Customer, Warehouse, Price, AircraftRefueling } from "@shared/schema";
import { CalculatedField } from "../calculated-field";
import { refuelingFormSchema, type RefuelingFormData } from "../schemas";
import { formatNumber, formatCurrency } from "../utils";
import type { RefuelingFormProps } from "../types";
import { PRODUCT_TYPES } from "../constants";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function RefuelingForm({ 
  onSuccess, 
  editData 
}: RefuelingFormProps) {
  const { toast } = useToast();
  const [inputMode, setInputMode] = useState<"liters" | "kg">("liters");
  const [selectedBasis, setSelectedBasis] = useState<string>("");
  const [selectedPurchasePriceId, setSelectedPurchasePriceId] = useState<string>("");
  const [selectedSalePriceId, setSelectedSalePriceId] = useState<string>("");
  const isEditing = !!editData;

  const form = useForm<RefuelingFormData>({
    resolver: zodResolver(refuelingFormSchema),
    defaultValues: {
      refuelingDate: editData ? new Date(editData.refuelingDate) : new Date(),
      productType: "kerosene",
      aircraftNumber: "",
      orderNumber: "",
      supplierId: "",
      buyerId: "",
      warehouseId: "",
      inputMode: "liters",
      quantityLiters: "",
      density: "",
      quantityKg: "",
      notes: "",
      isApproxVolume: false,
      selectedPurchasePriceId: "",
      selectedSalePriceId: "",
      basis: "",
    },
  });

  const { data: suppliers } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  const { data: allBases } = useQuery<Base[]>({
    queryKey: ["/api/bases"],
  });

  const { data: allPrices } = useQuery<Price[]>({
    queryKey: ["/api/prices"],
  });

  const { data: warehouses } = useQuery<Warehouse[]>({
    queryKey: ["/api/warehouses"],
  });

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const watchSupplierId = form.watch("supplierId");
  const watchBuyerId = form.watch("buyerId");
  const watchRefuelingDate = form.watch("refuelingDate");
  const watchLiters = form.watch("quantityLiters");
  const watchDensity = form.watch("density");
  const watchKg = form.watch("quantityKg");
  const watchProductType = form.watch("productType");
  const watchBasis = form.watch("basis");

  const calculatedKg = inputMode === "liters" && watchLiters && watchDensity
    ? (parseFloat(watchLiters) * parseFloat(watchDensity)).toFixed(2)
    : watchKg || "0";

  const finalKg = parseFloat(calculatedKg || "0");

  const selectedSupplier = suppliers?.find(s => s.id === watchSupplierId);
  const isWarehouseSupplier = selectedSupplier?.isWarehouse || false;
  const supplierWarehouse = warehouses?.find(w => 
    w.supplierId === watchSupplierId
  );

  // Фильтруем базисы для поставщика (только refueling)
  const availableBases = watchSupplierId && selectedSupplier?.baseIds
    ? allBases?.filter(b => 
        b.baseType === "refueling" && 
        selectedSupplier.baseIds.includes(b.id)
      ) || []
    : [];

  useEffect(() => {
    if (watchSupplierId && suppliers && allBases) {
      const supplier = suppliers.find(s => s.id === watchSupplierId);

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

      // Автоматически выбираем первый базис
      if (!editData && supplier?.baseIds && supplier.baseIds.length >= 1) {
        const baseId = supplier.baseIds[0];
        const base = allBases.find(b => b.id === baseId && b.baseType === "refueling");
        if (base) {
          form.setValue("basis", base.name);
          setSelectedBasis(base.name);
        }
      }
    }
  }, [watchSupplierId, suppliers, allBases, warehouses, form, editData]);

  useEffect(() => {
    if (editData && suppliers && customers) {
      const supplier = suppliers.find(s => s.name === editData.supplierId || s.id === editData.supplierId);
      const buyer = customers.find(c => c.name === editData.buyerId || c.id === editData.buyerId);

      form.reset({
        refuelingDate: new Date(editData.refuelingDate),
        productType: editData.productType,
        aircraftNumber: editData.aircraftNumber || "",
        orderNumber: editData.orderNumber || "",
        supplierId: supplier?.id || "",
        buyerId: buyer?.id || "",
        warehouseId: editData.warehouseId || "",
        inputMode: editData.quantityLiters ? "liters" : "kg",
        quantityLiters: editData.quantityLiters || "",
        density: editData.density || "",
        quantityKg: editData.quantityKg || "",
        notes: editData.notes || "",
        isApproxVolume: editData.isApproxVolume || false,
        selectedPurchasePriceId: editData.purchasePriceId || "",
        selectedSalePriceId: editData.salePriceId || "",
        basis: editData.basis || "",
      });

      setSelectedPurchasePriceId(editData.purchasePriceId || "");
      setSelectedSalePriceId(editData.salePriceId || "");
      setSelectedBasis(editData.basis || "");

      if (editData.quantityLiters) {
        setInputMode("liters");
      }
    }
  }, [editData, suppliers, customers, form]);

  const getMatchingPurchasePrices = () => {
    if (!watchSupplierId || !watchRefuelingDate || !watchBasis) return [];

    const dateStr = format(watchRefuelingDate, "yyyy-MM-dd");
    const supplier = suppliers?.find(s => s.id === watchSupplierId);
    if (!supplier) return [];

    // Определяем тип продукта для поиска цены
    let priceProductType = "kerosene";
    if (watchProductType === "pvkj") {
      priceProductType = "pvkj";
    } else if (watchProductType === "service") {
      priceProductType = "service";
    }

    return allPrices?.filter(p => {
      const basicMatch = p.counterpartyId === watchSupplierId &&
        p.counterpartyType === "refueling" &&
        p.counterpartyRole === "supplier" &&
        p.productType === priceProductType &&
        p.basis === watchBasis &&
        p.dateFrom <= dateStr &&
        p.dateTo >= dateStr &&
        p.isActive;

      return basicMatch;
    }) || [];
  };

  const purchasePrices = getMatchingPurchasePrices();

  const getMatchingSalePrices = () => {
    if (!watchBuyerId || !watchRefuelingDate || !watchBasis) return [];

    const dateStr = format(watchRefuelingDate, "yyyy-MM-dd");
    const buyer = customers?.find(c => c.id === watchBuyerId);
    if (!buyer) return [];

    // Определяем тип продукта для поиска цены
    let priceProductType = "kerosene";
    if (watchProductType === "pvkj") {
      priceProductType = "pvkj";
    } else if (watchProductType === "service") {
      priceProductType = "service";
    }

    return allPrices?.filter(p => {
      const basicMatch = p.counterpartyId === watchBuyerId &&
        p.counterpartyType === "refueling" &&
        p.counterpartyRole === "buyer" &&
        p.productType === priceProductType &&
        p.dateFrom <= dateStr &&
        p.dateTo >= dateStr &&
        p.isActive;

      return basicMatch;
    }) || [];
  };

  const salePrices = getMatchingSalePrices();

  const getPurchasePrice = (): number | null => {
    // Для услуги заправки
    if (watchProductType === "service") {
      if (selectedSupplier?.servicePrice) {
        return parseFloat(selectedSupplier.servicePrice);
      }

      const matchingPrices = getMatchingPurchasePrices();
      if (matchingPrices.length === 0) return null;

      let selectedPrice = matchingPrices[0];
      if (selectedPurchasePriceId) {
        const found = matchingPrices.find(p => p.id === selectedPurchasePriceId);
        if (found) selectedPrice = found;
      }

      if (selectedPrice?.priceValues?.[0]) {
        try {
          const priceObj = JSON.parse(selectedPrice.priceValues[0]);
          return parseFloat(priceObj.price || "0");
        } catch {
          return null;
        }
      }
      return null;
    }

    // Для ПВКЖ
    if (watchProductType === "pvkj") {
      if (isWarehouseSupplier && supplierWarehouse) {
        return parseFloat(supplierWarehouse.pvkjAverageCost || "0");
      }

      if (selectedSupplier?.pvkjPrice) {
        return parseFloat(selectedSupplier.pvkjPrice);
      }

      const matchingPrices = getMatchingPurchasePrices();
      if (matchingPrices.length === 0) return null;

      let selectedPrice = matchingPrices[0];
      if (selectedPurchasePriceId) {
        const found = matchingPrices.find(p => p.id === selectedPurchasePriceId);
        if (found) selectedPrice = found;
      }

      if (selectedPrice?.priceValues?.[0]) {
        try {
          const priceObj = JSON.parse(selectedPrice.priceValues[0]);
          return parseFloat(priceObj.price || "0");
        } catch {
          return null;
        }
      }
      return null;
    }

    // Для керосина
    if (isWarehouseSupplier && supplierWarehouse) {
      return parseFloat(supplierWarehouse.averageCost || "0");
    }

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

  const purchasePrice = getPurchasePrice();
  const salePrice = getSalePrice();

  const purchaseAmount = purchasePrice !== null && finalKg > 0 ? purchasePrice * finalKg : null;
  const saleAmount = salePrice !== null && finalKg > 0 ? salePrice * finalKg : null;

  const agentFee = selectedSupplier?.agentFee ? parseFloat(selectedSupplier.agentFee) * finalKg : 0;

  const profit = purchaseAmount !== null && saleAmount !== null 
    ? saleAmount - purchaseAmount - agentFee
    : null;

  const getWarehouseStatus = (): { status: "ok" | "warning" | "error"; message: string } => {
    if (!isWarehouseSupplier) {
      return { status: "ok", message: "ОК" };
    }

    if (!supplierWarehouse || finalKg <= 0) {
      return { status: "ok", message: "—" };
    }

    // Для ПВКЖ проверяем баланс ПВКЖ
    if (watchProductType === "pvkj") {
      const currentBalance = parseFloat(supplierWarehouse.pvkjBalance || "0");
      const remaining = currentBalance - finalKg;

      if (remaining >= 0) {
        return { status: "ok", message: `ОК: ${formatNumber(remaining)} кг` };
      } else {
        return { status: "error", message: `Недостаточно! Доступно: ${formatNumber(currentBalance)} кг` };
      }
    }

    // Для керосина проверяем обычный баланс
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
    mutationFn: async (data: RefuelingFormData) => {
      const purchasePrices = getMatchingPurchasePrices();
      const salePrices = getMatchingSalePrices();

      // Извлекаем ID цены без индекса
      const purchasePriceId = !isWarehouseSupplier && selectedPurchasePriceId 
        ? (selectedPurchasePriceId.includes('-') ? selectedPurchasePriceId.split('-')[0] : selectedPurchasePriceId)
        : (!isWarehouseSupplier && purchasePrices.length > 0 ? purchasePrices[0].id : null);
      const salePriceId = selectedSalePriceId 
        ? (selectedSalePriceId.includes('-') ? selectedSalePriceId.split('-')[0] : selectedSalePriceId)
        : (salePrices.length > 0 ? salePrices[0].id : null);

      const payload = {
        ...data,
        supplierId: data.supplierId,
        buyerId: data.buyerId,
        warehouseId: isWarehouseSupplier && supplierWarehouse ? supplierWarehouse.id : null,
        basis: String(watchBasis || selectedBasis || ""),
        refuelingDate: format(data.refuelingDate, "yyyy-MM-dd"),
        quantityKg: String(parseFloat(calculatedKg)),
        quantityLiters: data.quantityLiters ? String(parseFloat(data.quantityLiters)) : null,
        density: data.density ? String(parseFloat(data.density)) : null,
        purchasePrice: purchasePrice !== null ? String(purchasePrice) : null,
        purchasePriceId: purchasePriceId,
        salePrice: salePrice !== null ? String(salePrice) : null,
        salePriceId: salePriceId,
        purchaseAmount: purchaseAmount !== null ? String(purchaseAmount) : null,
        saleAmount: saleAmount !== null ? String(saleAmount) : null,
        profit: profit !== null ? String(profit) : null,
      };
      const res = await apiRequest("POST", "/api/refueling", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key?.startsWith('/api/refueling') || key?.startsWith('/api/warehouses');
        }
      });
      toast({ title: "Заправка создана", description: "Заправка ВС успешно сохранена" });
      form.reset();
      setSelectedPurchasePriceId("");
      setSelectedSalePriceId("");
      setSelectedBasis("");
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
    mutationFn: async (data: RefuelingFormData & { id: string }) => {
      const purchasePrices = getMatchingPurchasePrices();
      const salePrices = getMatchingSalePrices();

      // Извлекаем ID цены без индекса
      const purchasePriceId = !isWarehouseSupplier && selectedPurchasePriceId 
        ? (selectedPurchasePriceId.includes('-') ? selectedPurchasePriceId.split('-')[0] : selectedPurchasePriceId)
        : (!isWarehouseSupplier && purchasePrices.length > 0 ? purchasePrices[0].id : null);
      const salePriceId = selectedSalePriceId 
        ? (selectedSalePriceId.includes('-') ? selectedSalePriceId.split('-')[0] : selectedSalePriceId)
        : (salePrices.length > 0 ? salePrices[0].id : null);

      const payload = {
        ...data,
        supplierId: data.supplierId,
        buyerId: data.buyerId,
        warehouseId: isWarehouseSupplier && supplierWarehouse ? supplierWarehouse.id : null,
        basis: String(watchBasis || selectedBasis || ""),
        refuelingDate: format(data.refuelingDate, "yyyy-MM-dd"),
        quantityKg: String(parseFloat(calculatedKg)),
        quantityLiters: data.quantityLiters ? String(parseFloat(data.quantityLiters)) : null,
        density: data.density ? String(parseFloat(data.density)) : null,
        purchasePrice: purchasePrice !== null ? String(purchasePrice) : null,
        purchasePriceId: purchasePriceId,
        salePrice: salePrice !== null ? String(salePrice) : null,
        salePriceId: salePriceId,
        purchaseAmount: purchaseAmount !== null ? String(purchaseAmount) : null,
        saleAmount: saleAmount !== null ? String(saleAmount) : null,
        profit: profit !== null ? String(profit) : null,
      };
      const res = await apiRequest("PATCH", `/api/refueling/${data.id}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key?.startsWith('/api/refueling') || key?.startsWith('/api/warehouses');
        }
      });
      toast({ title: "Заправка обновлена", description: "Заправка ВС успешно обновлена" });
      form.reset();
      setSelectedPurchasePriceId("");
      setSelectedSalePriceId("");
      setSelectedBasis("");
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

  const onSubmit = (data: RefuelingFormData) => {
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
            name="refuelingDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Дата заправки</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                        data-testid="input-refueling-date"
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
            name="productType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Продукт</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-product-type">
                      <SelectValue placeholder="Выберите продукт" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {PRODUCT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
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
            name="aircraftNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Бортовой номер</FormLabel>
                <FormControl>
                  <Input
                    placeholder="RA-12345"
                    data-testid="input-aircraft-number"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="orderNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Номер РТ</FormLabel>
                <FormControl>
                  <Input
                    placeholder="RT-001234"
                    data-testid="input-order-number"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <FormField
            control={form.control}
            name="supplierId"
            render={({ field }) => {
              // Фильтруем поставщиков, у которых есть хотя бы один базис типа refueling
              const refuelingSuppliers = suppliers?.filter(supplier => {
                if (!supplier.baseIds || supplier.baseIds.length === 0) return false;
                return allBases?.some(base => 
                  supplier.baseIds.includes(base.id) && base.baseType === 'refueling'
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
                      {refuelingSuppliers.length > 0 ? (
                        refuelingSuppliers.map((supplier) => (
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
            name="basis"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Базис</FormLabel>
                <Select 
                  onValueChange={(value) => { 
                    field.onChange(value); 
                    setSelectedBasis(value); 
                  }} 
                  value={field.value || selectedBasis}
                  disabled={availableBases.length === 0}
                >
                  <FormControl>
                    <SelectTrigger data-testid="select-basis">
                      <SelectValue placeholder="Выберите базис" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {availableBases.map((base) => (
                      <SelectItem key={base.id} value={base.name}>
                        {base.name}
                      </SelectItem>
                    ))}
                    {availableBases.length === 0 && (
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
                    {customers?.filter(c => c.module === "refueling" || c.module === "both").map((buyer) => (
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

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                // Автоматически выбираем первую цену, если не выбрана
                const effectiveValue = selectedPurchasePriceId || field.value || (purchasePrices.length > 0 ? purchasePrices[0].id : undefined);

                return (
                  <FormItem className="flex-1">
                    <FormLabel>Покупка</FormLabel>
                    <Select 
                      onValueChange={(value) => { 
                        field.onChange(value); 
                        setSelectedPurchasePriceId(value); 
                      }} 
                      value={effectiveValue}
                      defaultValue={effectiveValue}
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
          ) : !isWarehouseSupplier && watchProductType !== "service" ? (
            <div className="flex-1">
              <CalculatedField 
                label="Покупка" 
                value="Нет цены!"
                status="error"
              />
            </div>
          ) : (
            <div className="flex-1">
              <CalculatedField 
                label="Покупка" 
                value={purchasePrice !== null ? formatNumber(purchasePrice) : "Нет цены!"}
                suffix={purchasePrice !== null ? " ₽/кг" : ""}
                status={purchasePrice !== null ? "ok" : "error"}
              />
            </div>
          )}

          <CalculatedField 
            label="Сумма закупки" 
            value={purchaseAmount !== null ? `${purchaseAmount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽` : "—"}
            variant="neutral"
          />
        </div>

        {agentFee > 0 && (
          <div className="p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-md">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Агентское вознаграждение: {formatCurrency(agentFee)}
              </span>
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {salePrices.length > 0 ? (
            <FormField
              control={form.control}
              name="selectedSalePriceId"
              render={({ field }) => {
                // Автоматически выбираем первую цену, если не выбрана
                const effectiveValue = selectedSalePriceId || field.value || (salePrices.length > 0 ? salePrices[0].id : undefined);

                return (
                  <FormItem className="flex-1">
                    <FormLabel>Продажа</FormLabel>
                    <Select 
                      onValueChange={(value) => { 
                        field.onChange(value); 
                        setSelectedSalePriceId(value); 
                      }} 
                      value={effectiveValue}
                      defaultValue={effectiveValue}
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
            <div className="flex-1">
              <CalculatedField 
                label="Продажа" 
                value="Нет цены!"
                status="error"
              />
            </div>
          )}

          <CalculatedField 
            label="Сумма продажи" 
            value={saleAmount !== null ? `${saleAmount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽` : "—"}
            variant="neutral"
          />

          <CalculatedField 
            label="Прибыль" 
            value={profit !== null ? `${profit.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽` : "—"}
            variant={profit && profit > 0 ? "positive" : "neutral"}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-1">
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
              <FormItem className="flex items-center gap-2 space-y-0">
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
              setSelectedBasis("");
              onSuccess?.();
            }}
          >
            {editData ? "Отмена" : "Очистить"}
          </Button>
          <Button 
            type="submit" 
            disabled={createMutation.isPending || updateMutation.isPending}
            data-testid="button-submit-refueling"
          >
            {createMutation.isPending || updateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {editData ? "Сохранение..." : "Создание..."}
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                {editData ? "Сохранить изменения" : "Создать запись"}
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}