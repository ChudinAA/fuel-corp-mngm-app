import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Plus, Loader2 } from "lucide-react";
import type {
  Supplier,
  Base,
  Customer,
  Warehouse,
  Price,
  DeliveryCost,
  LogisticsCarrier,
  LogisticsDeliveryLocation,
} from "@shared/schema";
import { OptMainFields } from "./opt-main-fields";
import { OptPricingSection } from "./opt-pricing-section";
import { VolumeInputSection } from "./opt-form-sections";
import { LogisticsSection } from "./opt-form-sections";
import { optFormSchema, type OptFormData } from "../schemas";
import type { OptFormProps } from "../types";
import { useOptCalculations } from "../hooks/use-opt-calculations";
import { useOptFilters } from "../hooks/use-opt-filters";
import { BASE_TYPE } from "@shared/constants";
import { useAutoPriceSelection } from "../../shared/hooks/use-auto-price-selection";
import { extractPriceIdsForSubmit } from "../../shared/utils/price-utils";

export function OptForm({ onSuccess, editData }: OptFormProps) {
  const { toast } = useToast();
  const [inputMode, setInputMode] = useState<"liters" | "kg">("kg");
  const [selectedBasis, setSelectedBasis] = useState<string>("");
  const [selectedPurchasePriceId, setSelectedPurchasePriceId] =
    useState<string>("");
  const [selectedSalePriceId, setSelectedSalePriceId] = useState<string>("");
  const [initialWarehouseBalance, setInitialWarehouseBalance] =
    useState<number>(0);
  const isEditing = !!editData;

  const form = useForm<OptFormData>({
    resolver: zodResolver(optFormSchema),
    defaultValues: {
      dealDate: editData ? new Date(editData.dealDate) : new Date(),
      supplierId: "",
      buyerId: "",
      warehouseId: "",
      quantityLiters: "",
      density: "",
      quantityKg: "",
      carrierId: "",
      deliveryLocationId: "",
      notes: "",
      isApproxVolume: false,
      isDraft: editData?.isDraft || false,
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

  const selectedSupplier = suppliers?.find((s) => s.id === watchSupplierId);
  const isWarehouseSupplier = selectedSupplier?.isWarehouse || false;
  const supplierWarehouse = warehouses?.find(
    (w) => w.supplierId === watchSupplierId,
  );

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
    deliveryLocationId: watchDeliveryLocationId,
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
    contractVolumeStatus,
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
    isEditing: isEditing,
  });

  // Автоматический выбор базиса при выборе поставщика
  useEffect(() => {
    if (watchSupplierId && suppliers && allBases) {
      const supplier = suppliers.find((s) => s.id === watchSupplierId);
      if (supplier?.baseIds && supplier.baseIds.length > 0) {
        const baseId = supplier.baseIds[0];
        const base = allBases.find(
          (b) => b.id === baseId && b.baseType === BASE_TYPE.WHOLESALE,
        );
        if (base) {
          setSelectedBasis(base.name);
        }
      }

      if (supplier?.isWarehouse) {
        const warehouse = warehouses?.find((w) => w.supplierId === supplier.id);
        if (warehouse) {
          form.setValue("warehouseId", warehouse.id);
        }
      } else {
        form.setValue("warehouseId", "");
      }
    }
  }, [watchSupplierId, suppliers, allBases, warehouses, form]);

  // Используем общий хук для автоматического выбора цен
  useAutoPriceSelection({
    supplierId: watchSupplierId,
    buyerId: watchBuyerId,
    purchasePrices,
    salePrices,
    isWarehouseSupplier,
    editData,
    setSelectedPurchasePriceId,
    setSelectedSalePriceId,
    formSetValue: form.setValue,
  });

  // Update form when editData changes
  useEffect(() => {
    if (editData && suppliers && customers && allBases && warehouses) {
      const supplier = suppliers.find(
        (s) => s.name === editData.supplierId || s.id === editData.supplierId,
      );
      const buyer = customers.find(
        (c) => c.name === editData.buyerId || c.id === editData.buyerId,
      );

      if (editData.basis) {
        setSelectedBasis(editData.basis);
      }

      const purchasePriceCompositeId =
        editData.purchasePriceId &&
        editData.purchasePriceIndex !== undefined &&
        editData.purchasePriceIndex !== null
          ? `${editData.purchasePriceId}-${editData.purchasePriceIndex}`
          : editData.purchasePriceId || "";

      const salePriceCompositeId =
        editData.salePriceId &&
        editData.salePriceIndex !== undefined &&
        editData.salePriceIndex !== null
          ? `${editData.salePriceId}-${editData.salePriceIndex}`
          : editData.salePriceId || "";

      // Сохраняем изначальный остаток на складе (с учетом текущей сделки)
      if (editData.warehouseId) {
        const warehouse = warehouses.find((w) => w.id === editData.warehouseId);
        if (warehouse) {
          const currentBalance = parseFloat(warehouse.currentBalance || "0");
          const dealQuantity = parseFloat(editData.quantityKg || "0");
          setInitialWarehouseBalance(currentBalance + dealQuantity);
        }
      }

      form.reset({
        dealDate: new Date(editData.dealDate),
        supplierId: supplier?.id || "",
        buyerId: buyer?.id || "",
        warehouseId: editData.warehouseId || "",
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
  }, [editData, suppliers, customers, allBases, warehouses, form]);

  const createMutation = useMutation({
    mutationFn: async (data: OptFormData) => {
      const {
        purchasePriceId,
        purchasePriceIndex,
        salePriceId,
        salePriceIndex,
      } = extractPriceIdsForSubmit(
        selectedPurchasePriceId,
        selectedSalePriceId,
        purchasePrices,
        salePrices,
        isWarehouseSupplier,
      );

      const payload = {
        ...data,
        supplierId: data.supplierId,
        buyerId: data.buyerId,
        isDraft: data.isDraft || false,
        warehouseId:
          isWarehouseSupplier && supplierWarehouse
            ? supplierWarehouse.id
            : null,
        basis: selectedBasis,
        carrierId: data.carrierId || null,
        deliveryLocationId: data.deliveryLocationId || null,
        dealDate: data.dealDate ? format(data.dealDate, "yyyy-MM-dd'T'HH:mm:ss") : null,
        quantityKg: data.quantityKg ? parseFloat(calculatedKg) : null,
        quantityLiters: data.quantityLiters
          ? parseFloat(data.quantityLiters)
          : null,
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
          return (
            key?.startsWith("/api/opt") || key?.startsWith("/api/warehouses")
          );
        },
      });
      toast({
        title: "Сделка создана",
        description: "Оптовая сделка успешно сохранена",
      });
      setSelectedPurchasePriceId("");
      setSelectedSalePriceId("");
      setSelectedBasis("");
      form.reset({
        dealDate: new Date(),
        supplierId: "",
        buyerId: "",
        warehouseId: "",
        quantityLiters: "",
        density: "",
        quantityKg: "",
        carrierId: "",
        deliveryLocationId: "",
        notes: "",
        isApproxVolume: false,
        selectedPurchasePriceId: "",
        selectedSalePriceId: "",
      });
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: OptFormData & { id: string }) => {
      const {
        purchasePriceId,
        purchasePriceIndex,
        salePriceId,
        salePriceIndex,
      } = extractPriceIdsForSubmit(
        selectedPurchasePriceId,
        selectedSalePriceId,
        purchasePrices,
        salePrices,
        isWarehouseSupplier,
      );

      const payload = {
        ...data,
        supplierId: data.supplierId,
        buyerId: data.buyerId,
        isDraft: data.isDraft || false,
        warehouseId:
          isWarehouseSupplier && supplierWarehouse
            ? supplierWarehouse.id
            : null,
        basis: selectedBasis,
        carrierId: data.carrierId || null,
        deliveryLocationId: data.deliveryLocationId || null,
        dealDate: data.dealDate ? format(data.dealDate, "yyyy-MM-dd'T'HH:mm:ss") : null,
        quantityKg: data.quantityKg ? parseFloat(calculatedKg) : null,
        quantityLiters: data.quantityLiters
          ? parseFloat(data.quantityLiters)
          : null,
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
          return (
            key?.startsWith("/api/opt") || key?.startsWith("/api/warehouses")
          );
        },
      });
      toast({
        title: "Сделка обновлена",
        description: "Оптовая сделка успешно обновлена",
      });
      setSelectedPurchasePriceId("");
      setSelectedSalePriceId("");
      setSelectedBasis("");
      form.reset({
        dealDate: new Date(),
        supplierId: "",
        buyerId: "",
        warehouseId: "",
        quantityLiters: "",
        density: "",
        quantityKg: "",
        carrierId: "",
        deliveryLocationId: "",
        notes: "",
        isApproxVolume: false,
        selectedPurchasePriceId: "",
        selectedSalePriceId: "",
      });
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: OptFormData, isDraftSubmit?: boolean) => {
    const isDraft = isDraftSubmit ?? data.isDraft;

    // Если это не черновик, выполняем полную валидацию
    if (!isDraft) {
      // Проверяем наличие количества
      if (!calculatedKg || parseFloat(calculatedKg) <= 0) {
        toast({
          title: "Ошибка: отсутствует объем",
          description:
            "Укажите корректное количество топлива в килограммах или литрах.",
          variant: "destructive",
        });
        return;
      }

      // Проверяем наличие ошибок в ценах
      if (!isWarehouseSupplier && purchasePrice === null) {
        toast({
          title: "Ошибка: отсутствует цена покупки",
          description:
            "Не указана цена покупки. Выберите цену из списка или проверьте настройки поставщика и базиса.",
          variant: "destructive",
        });
        return;
      }

      if (salePrice === null) {
        toast({
          title: "Ошибка: отсутствует цена продажи",
          description:
            "Не указана цена продажи. Выберите цену из списка или проверьте настройки покупателя.",
          variant: "destructive",
        });
        return;
      }

      // Проверяем достаточность объема на складе для складских поставщиков
      if (isWarehouseSupplier && supplierWarehouse) {
        const availableBalance = isEditing
          ? initialWarehouseBalance
          : parseFloat(supplierWarehouse.currentBalance || "0");
        const remaining = availableBalance - finalKg;

        if (remaining < 0) {
          toast({
            title: "Ошибка: недостаточно объема на складе",
            description: `На складе "${supplierWarehouse.name}" недостаточно топлива. Доступно: ${availableBalance.toFixed(2)} кг, требуется: ${finalKg.toFixed(2)} кг`,
            variant: "destructive",
          });
          return;
        }
      }

      if (contractVolumeStatus.status === "error") {
        toast({
          title: "Ошибка валидации",
          description: contractVolumeStatus.message,
          variant: "destructive",
        });
        return;
      }
    }

    if (editData) {
      updateMutation.mutate({ ...data, isDraft, id: editData.id });
    } else {
      createMutation.mutate({ ...data, isDraft });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <OptMainFields
          form={form}
          wholesaleSuppliers={wholesaleSuppliers}
          customers={customers}
          selectedSupplier={selectedSupplier}
          selectedBasis={selectedBasis}
          setSelectedBasis={setSelectedBasis}
          wholesaleBases={wholesaleBases}
        />

        <VolumeInputSection
          form={form}
          inputMode={inputMode}
          setInputMode={setInputMode}
          calculatedKg={calculatedKg}
        />

        <LogisticsSection
          form={form}
          carriers={availableCarriers}
          deliveryLocations={availableLocations}
          contractVolumeStatus={contractVolumeStatus}
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
          deliveryCost={deliveryCost}
          profit={profit}
          supplierWarehouse={supplierWarehouse}
          finalKg={finalKg}
          isEditing={isEditing}
          initialWarehouseBalance={initialWarehouseBalance}
        />

        <div className="grid gap-4 md:grid-cols-2 items-end">
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Примечания</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Дополнительная информация..."
                    data-testid="input-notes"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex flex-col gap-4">
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
            
            <FormField
              control={form.control}
              name="isDraft"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="checkbox-is-draft"
                    />
                  </FormControl>
                  <FormLabel className="text-sm font-normal cursor-pointer">
                    Сохранить как черновик
                  </FormLabel>
                </FormItem>
              )}
            />
          </div>
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
            type="button"
            variant="secondary"
            disabled={createMutation.isPending || updateMutation.isPending}
            onClick={() => {
              form.clearErrors();
              const values = form.getValues();
              onSubmit(values, true);
            }}
          >
            {createMutation.isPending || updateMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Сохранить черновик
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
                {editData ? "Сохранить изменения" : "Создать сделку"}
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
