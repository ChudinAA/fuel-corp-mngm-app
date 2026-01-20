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
import { useDuplicateCheck } from "../../shared/hooks/use-duplicate-check";
import { DuplicateAlertDialog } from "../../shared/components/duplicate-alert-dialog";

export function OptForm({ onSuccess, editData }: OptFormProps) {
  const { toast } = useToast();
  const [inputMode, setInputMode] = useState<"liters" | "kg">("kg");
  const [selectedBasis, setSelectedBasis] = useState<string>("");
  const [selectedPurchasePriceId, setSelectedPurchasePriceId] =
    useState<string>("");
  const [selectedSalePriceId, setSelectedSalePriceId] = useState<string>("");
  const [initialQuantityKg, setInitialQuantityKg] = useState<number>(0);
  const isEditing = !!editData && !!editData.id;

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
    supplierContractVolumeStatus,
    warehouseBalanceAtDate,
    isWarehouseBalanceLoading,
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
    initialQuantityKg: initialQuantityKg,
    dealDate: watchDealDate,
  });

  const {
    showDuplicateDialog,
    setShowDuplicateDialog,
    checkDuplicate,
    handleConfirm,
    handleCancel,
    isChecking
  } = useDuplicateCheck({
    type: "opt",
    getFields: () => ({
      date: watchDealDate,
      supplierId: watchSupplierId,
      buyerId: watchBuyerId,
      basis: selectedBasis,
      deliveryLocationId: watchDeliveryLocationId,
      quantityKg: calculatedKg ? parseFloat(calculatedKg) : 0,
    }),
  });

  // Автоматический выбор базиса при выборе поставщика
  useEffect(() => {
    if (watchSupplierId && suppliers && allBases) {
      const supplier = suppliers.find((s) => s.id === watchSupplierId);

      if (supplier?.isWarehouse) {
        const warehouse = warehouses?.find((w) => w.supplierId === supplier.id);
        if (warehouse) {
          form.setValue("warehouseId", warehouse.id);
        }
      } else {
        form.setValue("warehouseId", "");
      }

      // Автоматически выбираем первый базис только при СОЗДАНИИ новой сделки
      if (!isEditing && supplier?.baseIds && supplier.baseIds.length > 0) {
        const baseId = supplier.baseIds[0];
        const base = allBases.find(
          (b) => b.id === baseId && b.baseType === BASE_TYPE.WHOLESALE,
        );
        if (base) {
          form.setValue("basis", base.name);
          setSelectedBasis(base.name);
        }
      }
    }
  }, [watchSupplierId, suppliers, allBases, warehouses, form, isEditing]);

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
        // Логика перенесена в хук useOptWarehouseBalance
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
        basis: editData.basis || "",
        selectedPurchasePriceId: purchasePriceCompositeId,
        selectedSalePriceId: salePriceCompositeId,
      });

      setSelectedPurchasePriceId(purchasePriceCompositeId);
      setSelectedSalePriceId(salePriceCompositeId);
      setInitialQuantityKg(
        isEditing ? parseFloat(editData.quantityKg || "0") : 0,
      );

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
        supplierId: data.supplierId || null,
        buyerId: data.buyerId || null,
        isDraft: data.isDraft || false,
        warehouseId:
          isWarehouseSupplier && supplierWarehouse
            ? supplierWarehouse.id
            : null,
        basis: selectedBasis || null,
        carrierId: data.carrierId || null,
        deliveryLocationId: data.deliveryLocationId || null,
        dealDate: data.dealDate
          ? format(data.dealDate, "yyyy-MM-dd'T'HH:mm:ss")
          : null,
        quantityKg: calculatedKg ? parseFloat(calculatedKg) : null,
        quantityLiters: data.quantityLiters
          ? parseFloat(data.quantityLiters)
          : null,
        density: data.density ? parseFloat(data.density) : null,
        purchasePrice: purchasePrice !== null ? purchasePrice : null,
        purchasePriceId: purchasePriceId || null,
        purchasePriceIndex:
          purchasePriceIndex !== undefined ? purchasePriceIndex : null,
        salePrice: salePrice !== null ? salePrice : null,
        salePriceId: salePriceId || null,
        salePriceIndex: salePriceIndex !== undefined ? salePriceIndex : null,
        purchaseAmount: purchaseAmount !== null ? purchaseAmount : null,
        saleAmount: saleAmount !== null ? saleAmount : null,
        deliveryCost: deliveryCost !== null ? deliveryCost : null,
        deliveryTariff: deliveryTariff !== null ? deliveryTariff : null,
        profit: profit !== null ? profit : null,
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
        supplierId: data.supplierId || null,
        buyerId: data.buyerId || null,
        isDraft: data.isDraft || false,
        warehouseId:
          isWarehouseSupplier && supplierWarehouse
            ? supplierWarehouse.id
            : null,
        basis: selectedBasis || null,
        carrierId: data.carrierId || null,
        deliveryLocationId: data.deliveryLocationId || null,
        dealDate: data.dealDate
          ? format(data.dealDate, "yyyy-MM-dd'T'HH:mm:ss")
          : null,
        quantityKg: calculatedKg ? parseFloat(calculatedKg) : null,
        quantityLiters: data.quantityLiters
          ? parseFloat(data.quantityLiters)
          : null,
        density: data.density ? parseFloat(data.density) : null,
        purchasePrice: purchasePrice !== null ? purchasePrice : null,
        purchasePriceId: purchasePriceId || null,
        purchasePriceIndex:
          purchasePriceIndex !== undefined ? purchasePriceIndex : null,
        salePrice: salePrice !== null ? salePrice : null,
        salePriceId: salePriceId || null,
        salePriceIndex: salePriceIndex !== undefined ? salePriceIndex : null,
        purchaseAmount: purchaseAmount !== null ? purchaseAmount : null,
        saleAmount: saleAmount !== null ? saleAmount : null,
        deliveryCost: deliveryCost !== null ? deliveryCost : null,
        deliveryTariff: deliveryTariff !== null ? deliveryTariff : null,
        profit: profit !== null ? profit : null,
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

  const onSubmit = async (data: OptFormData, isDraftSubmit?: boolean) => {
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

      // Проверяем налич �е ошибок в ценах
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
        const availableBalance =
          warehouseBalanceAtDate !== null ? warehouseBalanceAtDate : 0;
        const remaining = availableBalance - finalKg;
        if (remaining < 0) {
          toast({
            title: "Ошибка: недостаточно объема на складе",
            description: `На складе "${supplierWarehouse.name}" на выбранную дату недостаточно топлива. Доступно: ${availableBalance.toFixed(2)} кг, требуется: ${finalKg.toFixed(2)} кг`,
            variant: "destructive",
          });
          return;
        }
      }

      if (contractVolumeStatus.status === "error") {
        toast({
          title: "Ошибк: недостаточно объема по договору Покупателя",
          description: contractVolumeStatus.message,
          variant: "destructive",
        });
        return;
      }

      if (
        !isWarehouseSupplier &&
        supplierContractVolumeStatus.status === "error"
      ) {
        toast({
          title: "Ошибк: недостаточно объема по договору Поставщика",
          description: supplierContractVolumeStatus.message,
          variant: "destructive",
        });
        return;
      }
    } else {
      // Для черновика проверяем только поставщика и покупателя (уже проверено Zod)
      // Но дополнительно убедимся, что ID не пустые строки
      if (!data.supplierId || !data.buyerId) {
        toast({
          title: "Ошибка валидации",
          description:
            "Для сохранения черновика необходимо выбрать поставщика и покупателя.",
          variant: "destructive",
        });
        return;
      }
    }

    if (editData && editData.id) {
      updateMutation.mutate({ ...data, isDraft, id: editData.id });
    } else {
      const isNewDeal = !isEditing;
      const isPublishingDraft = editData?.isDraft && !isDraft;

      if (isNewDeal || isPublishingDraft || editData.id !== undefined) {
        checkDuplicate(() => createMutation.mutate({ ...data, isDraft }));
        return;
      }
      createMutation.mutate({ ...data, isDraft });
    }
  };

  return (
    <>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((data) => onSubmit(data))}
          className="space-y-6"
        >
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
            bases={allBases}
            deliveryCost={deliveryCost}
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
            profit={profit}
            supplierWarehouse={supplierWarehouse}
            finalKg={finalKg}
            isEditing={isEditing}
            contractVolumeStatus={contractVolumeStatus}
            supplierContractVolumeStatus={supplierContractVolumeStatus}
            warehouseBalanceAtDate={warehouseBalanceAtDate}
            isWarehouseBalanceLoading={isWarehouseBalanceLoading}
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

            <FormField
              control={form.control}
              name="isApproxVolume"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0 pb-2">
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

            {!isEditing || (editData && editData.isDraft) ? (
              <Button
                type="button"
                variant="secondary"
                disabled={createMutation.isPending || updateMutation.isPending || isChecking}
                onClick={() => {
                  form.clearErrors();
                  form.handleSubmit((data) => onSubmit(data, true))();
                }}
              >
                {createMutation.isPending || updateMutation.isPending || isChecking ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Сохранить черновик
              </Button>
            ) : null}

            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending || isChecking}
              data-testid="button-submit-opt"
            >
              {createMutation.isPending || updateMutation.isPending || isChecking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEditing ? "Сохранение..." : "Создание..."}
                </>
              ) : (
                <>
                  {isEditing && !editData.isDraft
                    ? "Сохранить изменения"
                    : "Создать сделку"}
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>

      <DuplicateAlertDialog
        open={showDuplicateDialog}
        onOpenChange={setShowDuplicateDialog}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        description="В системе уже есть сделка с такими же параметрами (дата, поставщик, покупатель, базис, место доставки и объем). Продолжить создание?"
      />
    </>
  );
}
