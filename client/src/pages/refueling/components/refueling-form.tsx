import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PRODUCT_TYPE, BASE_TYPE } from "@shared/constants";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
} from "@shared/schema";
import { refuelingFormSchema, type RefuelingFormData } from "../schemas";
import type { RefuelingFormProps } from "../types";
import { RefuelingMainFields } from "./refueling-main-fields";
import { RefuelingPricingSection } from "./refueling-pricing-section";
import { VolumeInputSection } from "./refueling-form-sections";
import { useRefuelingCalculations } from "../hooks/use-refueling-calculations";
import { useRefuelingFilters } from "../hooks/use-refueling-filters";
import { useAutoPriceSelection } from "../../shared/hooks/use-auto-price-selection";
import { extractPriceIdsForSubmit } from "../../shared/utils/price-utils";
import { useDuplicateCheck } from "../../shared/hooks/use-duplicate-check";
import { DuplicateAlertDialog } from "../../shared/components/duplicate-alert-dialog";

export function RefuelingForm({ onSuccess, editData }: RefuelingFormProps) {
  const { toast } = useToast();
  const [inputMode, setInputMode] = useState<"liters" | "kg">("liters");
  const [selectedBasis, setSelectedBasis] = useState<string>("");
  const [selectedPurchasePriceId, setSelectedPurchasePriceId] =
    useState<string>("");
  const [selectedSalePriceId, setSelectedSalePriceId] = useState<string>("");
  const [initialQuantityKg, setInitialQuantityKg] = useState<number>(0);
  const [initialWarehouseBalance, setInitialWarehouseBalance] =
    useState<number>(0); // State for initial balance
  const isEditing = !!editData && !!editData.id;

  const form = useForm<RefuelingFormData>({
    resolver: zodResolver(refuelingFormSchema),
    defaultValues: {
      refuelingDate: editData ? new Date(editData.refuelingDate) : new Date(),
      productType: PRODUCT_TYPE.KEROSENE,
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
      isDraft: editData?.isDraft || false,
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

  const selectedSupplier = suppliers?.find((s) => s.id === watchSupplierId);
  const isWarehouseSupplier = selectedSupplier?.isWarehouse || false;
  const supplierWarehouse = warehouses?.find(
    (w) => w.supplierId === watchSupplierId,
  );

  // Use filtering hook
  const { refuelingSuppliers, availableBases, purchasePrices, salePrices } =
    useRefuelingFilters({
      supplierId: watchSupplierId,
      buyerId: watchBuyerId,
      refuelingDate: watchRefuelingDate,
      selectedBasis,
      productType: watchProductType,
      allPrices,
      suppliers,
      allBases,
    });

  // Use calculations hook
  const {
    calculatedKg,
    finalKg,
    purchasePrice,
    salePrice,
    purchaseAmount,
    saleAmount,
    agentFee,
    profit,
    warehouseStatus,
    contractVolumeStatus,
    supplierContractVolumeStatus,
  } = useRefuelingCalculations({
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
    selectedSupplier,
    productType: watchProductType,
    isEditing,
    initialQuantityKg,
    initialWarehouseBalance,
    refuelingDate: watchRefuelingDate,
  });

  const {
    showDuplicateDialog,
    setShowDuplicateDialog,
    checkDuplicate,
    handleConfirm,
    handleCancel,
    isChecking,
  } = useDuplicateCheck({
    type: "refueling",
    getFields: () => ({
      date: watchRefuelingDate,
      supplierId: watchSupplierId,
      buyerId: watchBuyerId,
      basis: selectedBasis,
      quantityKg: calculatedKg ? parseFloat(calculatedKg) : 0,
    }),
  });
  
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

      // Автоматически выбираем первый базис при выборе поставщика
      if (supplier?.baseIds && supplier.baseIds.length >= 1 && !editData) {
        const refuelingBases = allBases.filter(
          (b) =>
            supplier.baseIds?.includes(b.id) &&
            b.baseType === BASE_TYPE.REFUELING,
        );
        if (refuelingBases.length > 0) {
          const firstBase = refuelingBases[0];
          form.setValue("basis", firstBase.name);
          setSelectedBasis(firstBase.name);
        }
      }
    }
  }, [watchSupplierId, suppliers, allBases, warehouses, form, editData]);

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

  useEffect(() => {
    if (editData && suppliers && customers && allBases && warehouses) {
      // Added warehouses dependency
      const supplier = suppliers.find(
        (s) => s.name === editData.supplierId || s.id === editData.supplierId,
      );
      const buyer = customers.find(
        (c) => c.name === editData.buyerId || c.id === editData.buyerId,
      );

      // Construct composite price IDs with indices
      const purchasePriceCompositeId =
        editData.purchasePriceId && editData.purchasePriceIndex !== undefined
          ? `${editData.purchasePriceId}-${editData.purchasePriceIndex}`
          : editData.purchasePriceId || "";

      const salePriceCompositeId =
        editData.salePriceId && editData.salePriceIndex !== undefined
          ? `${editData.salePriceId}-${editData.salePriceIndex}`
          : editData.salePriceId || "";

      // Сохраняем изначальный остаток на складе (с учетом текущей сделки)
      if (editData.warehouseId) {
        const warehouse = warehouses.find((w) => w.id === editData.warehouseId);
        if (warehouse) {
          // Determine the correct balance based on product type
          const currentBalance =
            watchProductType === PRODUCT_TYPE.PVKJ
              ? parseFloat(warehouse.pvkjBalance || "0")
              : parseFloat(warehouse.currentBalance || "0");
          const dealQuantity = parseFloat(editData.quantityKg || "0"); // Assuming quantityKg is the relevant quantity for balance adjustment
          setInitialWarehouseBalance(currentBalance + dealQuantity);
        }
      }

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
        selectedPurchasePriceId: purchasePriceCompositeId,
        selectedSalePriceId: salePriceCompositeId,
        basis: editData.basis || "",
      });

      setSelectedPurchasePriceId(purchasePriceCompositeId);
      setSelectedSalePriceId(salePriceCompositeId);
      setInitialQuantityKg(isEditing ? parseFloat(editData.quantityKg || "0") : 0);

      // Set basis from editData
      if (editData.basis) {
        setSelectedBasis(editData.basis);
      }

      if (editData.quantityLiters) {
        setInputMode("liters");
      }
    }
  }, [
    editData,
    suppliers,
    customers,
    allBases,
    warehouses,
    form,
    watchProductType,
  ]); // Added watchProductType dependency

  const createMutation = useMutation({
    mutationFn: async (data: RefuelingFormData) => {
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
        basis: selectedBasis || null, // Use selectedBasis
        refuelingDate: data.refuelingDate
          ? format(data.refuelingDate, "yyyy-MM-dd'T'HH:mm:ss")
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
        profit: profit !== null ? profit : null,
      };
      const res = await apiRequest("POST", "/api/refueling", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return (
            key?.startsWith("/api/refueling") ||
            key?.startsWith("/api/warehouses")
          );
        },
      });
      toast({
        title: "Заправка создана",
        description: "Заправка ВС успешно сохранена",
      });
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
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: RefuelingFormData & { id: string }) => {
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
        basis: selectedBasis || null, // Use selectedBasis
        refuelingDate: data.refuelingDate
          ? format(data.refuelingDate, "yyyy-MM-dd'T'HH:mm:ss")
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
        profit: profit !== null ? profit : null,
      };
      const res = await apiRequest(
        "PATCH",
        `/api/refueling/${data.id}`,
        payload,
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return (
            key?.startsWith("/api/refueling") ||
            key?.startsWith("/api/warehouses")
          );
        },
      });
      toast({
        title: "Заправка обновлена",
        description: "Заправка ВС успешно обновлена",
      });
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
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: RefuelingFormData, isDraftSubmit?: boolean) => {
    const productType = watchProductType;
    const isDraft = isDraftSubmit ?? data.isDraft;

    // Если не черновик, выполняем полную валидацию
    if (!isDraft) {
      // Проверяем наличие количества
      if (!calculatedKg || parseFloat(calculatedKg) <= 0) {
        toast({
          title: "Ошибка валидации",
          description: "Укажите корректное количество топлива.",
          variant: "destructive",
        });
        return;
      }

      // Проверяем наличие ошибок в ценах
      if (
        !isWarehouseSupplier &&
        productType !== PRODUCT_TYPE.SERVICE &&
        purchasePrice === null
      ) {
        toast({
          title: "Ошибка валидации",
          description:
            "Не указана цена покупки. Выберите цену или проверьте настройки поставщика.",
          variant: "destructive",
        });
        return;
      }

      if (salePrice === null) {
        toast({
          title: "Ошибка валидации",
          description:
            "Не указана цена продажи. Выберите цену или проверьте настройки покупателя.",
          variant: "destructive",
        });
        return;
      }

      // Проверяем достаточность объема на складе
      if (warehouseStatus.status === "error") {
        toast({
          title: "Ошибка валидации",
          description: warehouseStatus.message,
          variant: "destructive",
        });
        return;
      }

      if (contractVolumeStatus.status === "error") {
        toast({
          title: "Ошибка: недостаточно объема по договору Поставщика",
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
          title: "Ошибка: недостаточно объема по договору Поставщика",
          description: supplierContractVolumeStatus.message,
          variant: "destructive",
        });
        return;
      }
    } else {
      // Для черновика проверяем обязательные поля
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
        <RefuelingMainFields
          form={form}
          refuelingSuppliers={refuelingSuppliers}
          customers={customers}
          selectedSupplier={selectedSupplier}
          selectedBasis={selectedBasis}
          setSelectedBasis={setSelectedBasis}
          availableBases={availableBases}
          allBases={allBases}
        />

        <VolumeInputSection
          form={form}
          inputMode={inputMode}
          setInputMode={setInputMode}
          calculatedKg={calculatedKg}
        />

        <RefuelingPricingSection
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
          agentFee={agentFee}
          warehouseStatus={warehouseStatus}
          contractVolumeStatus={contractVolumeStatus}
          supplierContractVolumeStatus={supplierContractVolumeStatus}
          productType={watchProductType}
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
              setSelectedBasis("");
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
            data-testid="button-submit-refueling"
          >
            {createMutation.isPending || updateMutation.isPending || isChecking ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isEditing ? "Сохранение..." : "Создание..."}
              </>
            ) : (
              <>{(isEditing && !editData.isDraft) ? "Сохранить изменения" : "Создать сделку"}</>
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
      description="В системе уже есть заправка с такими же параметрами (дата, поставщик, покупатель, базис и объем). Продолжить создание?"
    />
    </>
  );
}
