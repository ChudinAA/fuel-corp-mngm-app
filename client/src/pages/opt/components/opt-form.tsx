import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus, Loader2 } from "lucide-react";
import type { Supplier, Base, Customer, Warehouse, Price, DeliveryCost, LogisticsCarrier, LogisticsDeliveryLocation } from "@shared/schema";
import { CalculatedField } from "./calculated-field";
import { OptMainFields } from "./opt-main-fields";
import { OptBasisWarehouseSection } from "./opt-basis-warehouse-section";
import { OptPricingSection } from "./opt-pricing-section";
import { VolumeInputSection } from "./opt-form-sections";
import { LogisticsSection } from "./opt-form-sections";
import { optFormSchema, type OptFormData } from "../schemas";
import { formatCurrency } from "../utils";
import type { OptFormProps } from "../types";
import { useOptCalculations } from "../hooks/use-opt-calculations";
import { useOptFilters } from "../hooks/use-opt-filters";
import { BASE_TYPE, ENTITY_TYPE } from "@shared/constants";

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

  const selectedSupplier = suppliers?.find(s => s.id === watchSupplierId);
  const isWarehouseSupplier = selectedSupplier?.isWarehouse || false;
  const supplierWarehouse = warehouses?.find(w => w.supplierId === watchSupplierId);

  // Use filtering hook
  const {
    purchasePrices,
    salePrices,
    wholesaleSuppliers,
    wholesaleBases,
    availableCarriers,
    availableLocations,
  } = useOptFilters({
    supplierId: watchSupplierId,
    buyerId: watchBuyerId,
    dealDate: watchDealDate,
    selectedBasis,
    carrierId: watchCarrierId,
    allPrices,
    suppliers,
    allBases,
    carriers,
    deliveryLocations,
    deliveryCosts,
    supplierWarehouse,
  });

  // Use calculations hook
  const {
    calculatedKg,
    finalKg,
    purchasePrice,
    salePrice,
    deliveryCost,
    purchaseAmount,
    saleAmount,
    profit,
    deliveryTariff,
  } = useOptCalculations({
    inputMode,
    quantityLiters: watchLiters,
    density: watchDensity,
    quantityKg: watchKg,
    isWarehouseSupplier,
    supplierWarehouse,
    selectedBasis,
    purchasePrices,
    salePrices,
    selectedPurchasePriceId,
    selectedSalePriceId,
    deliveryCosts,
    carrierId: watchCarrierId,
    deliveryLocationId: watchDeliveryLocationId,
    bases: wholesaleBases,
  });

  // Update form when editData changes
  useEffect(() => {
    if (editData && suppliers && customers && allBases) {
      const supplier = suppliers.find(s => s.name === editData.supplierId || s.id === editData.supplierId);
      const buyer = customers.find(c => c.name === editData.buyerId || c.id === editData.buyerId);

      if (editData.basis) {
        setSelectedBasis(editData.basis);
      }

      const purchasePriceCompositeId = editData.purchasePriceId && editData.purchasePriceIndex !== undefined
        ? `${editData.purchasePriceId}-${editData.purchasePriceIndex}`
        : editData.purchasePriceId || "";

      const salePriceCompositeId = editData.salePriceId && editData.salePriceIndex !== undefined
        ? `${editData.salePriceId}-${editData.salePriceIndex}`
        : editData.salePriceId || "";

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
        selectedPurchasePriceId: purchasePriceCompositeId,
        selectedSalePriceId: salePriceCompositeId,
      });

      setSelectedPurchasePriceId(purchasePriceCompositeId);
      setSelectedSalePriceId(salePriceCompositeId);

      if (editData.quantityLiters) {
        setInputMode("liters");
      }
    }
  }, [editData, suppliers, customers, allBases, form]);

  // Автоматический выбор базиса при выборе поставщика
  useEffect(() => {
    if (watchSupplierId && suppliers && allBases) {
      const supplier = suppliers.find(s => s.id === watchSupplierId);
      if (supplier?.baseIds && supplier.baseIds.length > 0) {
        const baseId = supplier.baseIds[0];
        const base = allBases.find(b => b.id === baseId && b.baseType === BASE_TYPE.WHOLESALE);
        if (base) {
          setSelectedBasis(base.name);
        }
      }

      if (supplier?.isWarehouse) {
        const warehouse = warehouses?.find(w => w.supplierId === supplier.id);
        if (warehouse) {
          form.setValue("warehouseId", warehouse.id);
        }
      } else {
        form.setValue("warehouseId", "");
      }
    }
  }, [watchSupplierId, suppliers, allBases, warehouses, form]);

  const createMutation = useMutation({
    mutationFn: async (data: OptFormData) => {
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
        <OptMainFields
          form={form}
          wholesaleSuppliers={wholesaleSuppliers}
          customers={customers}
          isWarehouseSupplier={isWarehouseSupplier}
          supplierWarehouse={supplierWarehouse}
        />

        <VolumeInputSection
          form={form}
          inputMode={inputMode}
          setInputMode={setInputMode}
          calculatedKg={calculatedKg}
        />

        <OptBasisWarehouseSection
          selectedSupplier={selectedSupplier}
          selectedBasis={selectedBasis}
          setSelectedBasis={setSelectedBasis}
          wholesaleBases={wholesaleBases}
          isWarehouseSupplier={isWarehouseSupplier}
          supplierWarehouse={supplierWarehouse}
          finalKg={finalKg}
        />

        <OptPricingSection
          form={form}
          isWarehouseSupplier={isWarehouseSupplier}
          purchasePrices={purchasePrices}
          salePrices={salePrices}
          selectedPurchasePriceId={selectedPurchasePriceId}
          selectedSalePriceId={selectedSalePriceId}
          setSelectedPurchasePriceId={setSelectedPurchasePriceId}
          setSelectedSalePriceId={setSelectedSalePriceId}
          purchasePrice={purchasePrice}
          salePrice={salePrice}
          purchaseAmount={purchaseAmount}
          saleAmount={saleAmount}
        />

        <div className="grid gap-4 md:grid-cols-2">
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

        <LogisticsSection
          form={form}
          carriers={availableCarriers}
          deliveryLocations={availableLocations}
        />

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