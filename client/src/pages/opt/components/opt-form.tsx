import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Loader2, Plus } from "lucide-react";
import type { Supplier, Base, Customer, Warehouse } from "@shared/schema";
import { optFormSchema, type OptFormData } from "../schemas";
import { formatNumber } from "../utils";
import type { OptFormProps } from "../types";
import { useOptFormData } from "../hooks/use-opt-form-data";
import { useOptCalculations } from "../hooks/use-opt-calculations";
import { OptFormMainSection } from "./opt-form-main-section";
import { OptFormVolumeSection } from "./opt-form-volume-section";
import { OptFormBasisWarehouseSection } from "./opt-form-basis-warehouse-section";
import { OptFormPricingSection } from "./opt-form-pricing-section";
import { OptFormLogisticsSection } from "./opt-form-logistics-section";
import { OptFormNotesSection } from "./opt-form-notes-section";

export function OptForm({ onSuccess, editData }: OptFormProps) {
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

  const watchSupplierId = form.watch("supplierId");
  const watchBuyerId = form.watch("buyerId");
  const watchDealDate = form.watch("dealDate");
  const watchLiters = form.watch("quantityLiters");
  const watchDensity = form.watch("density");
  const watchKg = form.watch("quantityKg");
  const watchCarrierId = form.watch("carrierId");
  const watchDeliveryLocationId = form.watch("deliveryLocationId");

  // Получение данных поставщика
  const selectedSupplier = suppliers?.find((s) => s.id === watchSupplierId);
  const isWarehouseSupplier = selectedSupplier?.isWarehouse || false;
  const supplierWarehouse = warehouses?.find((w) => w.supplierId === watchSupplierId);

  // Фильтруем базисы типа wholesale
  const bases = allBases?.filter((b) => b.baseType === "wholesale") || [];

  // Вычисления
  const calculations = useOptCalculations({
    inputMode,
    quantityLiters: watchLiters,
    density: watchDensity,
    quantityKg: watchKg,
    selectedPurchasePriceId,
    selectedSalePriceId,
    purchasePrices: [],
    salePrices: [],
    deliveryCost: null,
    isWarehouseSupplier,
    warehouseAverageCost: null,
  });

  // Получение данных формы с бэкенда
  const formData = useOptFormData({
    supplierId: watchSupplierId,
    buyerId: watchBuyerId,
    dealDate: watchDealDate,
    basis: selectedBasis,
    carrierId: watchCarrierId,
    deliveryLocationId: watchDeliveryLocationId,
    warehouseId: supplierWarehouse?.id,
    quantityKg: calculations.finalKg,
  });

  // Обновляем вычисления с реальными данными
  const finalCalculations = useOptCalculations({
    inputMode,
    quantityLiters: watchLiters,
    density: watchDensity,
    quantityKg: watchKg,
    selectedPurchasePriceId,
    selectedSalePriceId,
    purchasePrices: formData.purchasePrices,
    salePrices: formData.salePrices,
    deliveryCost: formData.deliveryCost,
    isWarehouseSupplier,
    warehouseAverageCost: formData.warehouseAverageCost,
  });

  // Автоматический выбор базиса при выборе поставщика
  useEffect(() => {
    if (watchSupplierId && suppliers && allBases) {
      const supplier = suppliers.find((s) => s.id === watchSupplierId);
      if (supplier?.baseIds && supplier.baseIds.length > 0) {
        const baseId = supplier.baseIds[0];
        const base = allBases.find((b) => b.id === baseId && b.baseType === "wholesale");
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

  // Автовыбор первой цены
  useEffect(() => {
    if (!selectedPurchasePriceId && formData.purchasePrices.length > 0) {
      const firstOption = formData.purchasePrices[0]?.values?.[0];
      if (firstOption) {
        setSelectedPurchasePriceId(firstOption.compositeId);
        form.setValue("selectedPurchasePriceId", firstOption.compositeId);
      }
    }
  }, [formData.purchasePrices, selectedPurchasePriceId, form]);

  useEffect(() => {
    if (!selectedSalePriceId && formData.salePrices.length > 0) {
      const firstOption = formData.salePrices[0]?.values?.[0];
      if (firstOption) {
        setSelectedSalePriceId(firstOption.compositeId);
        form.setValue("selectedSalePriceId", firstOption.compositeId);
      }
    }
  }, [formData.salePrices, selectedSalePriceId, form]);

  // Обновление формы при редактировании
  useEffect(() => {
    if (editData && suppliers && customers && allBases) {
      const supplier = suppliers.find(
        (s) => s.name === editData.supplierId || s.id === editData.supplierId
      );
      const buyer = customers.find(
        (c) => c.name === editData.buyerId || c.id === editData.buyerId
      );

      if (editData.basis) {
        setSelectedBasis(editData.basis);
      }

      const purchasePriceCompositeId =
        editData.purchasePriceId && editData.purchasePriceIndex !== undefined
          ? `${editData.purchasePriceId}-${editData.purchasePriceIndex}`
          : editData.purchasePriceId || "";

      const salePriceCompositeId =
        editData.salePriceId && editData.salePriceIndex !== undefined
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

  // Проверка остатка на складе
  const getWarehouseStatus = (): {
    status: "ok" | "warning" | "error";
    message: string;
  } => {
    if (!isWarehouseSupplier) {
      return { status: "ok", message: "ОК" };
    }

    if (!formData.warehouseBalance || finalCalculations.finalKg <= 0) {
      return { status: "ok", message: "—" };
    }

    const currentBalance = parseFloat(formData.warehouseBalance);
    const remaining = currentBalance - finalCalculations.finalKg;

    if (remaining >= 0) {
      return {
        status: "ok",
        message: `ОК: ${formatNumber(remaining)} кг`,
      };
    } else {
      return {
        status: "error",
        message: `Недостаточно! Доступно: ${formatNumber(currentBalance)} кг`,
      };
    }
  };

  const warehouseStatus = getWarehouseStatus();

  const buildMutationPayload = (data: OptFormData) => {
    let purchasePriceId = null;
    let purchasePriceIndex = 0;

    if (!isWarehouseSupplier && selectedPurchasePriceId) {
      const parts = selectedPurchasePriceId.split("-");
      if (parts.length >= 5) {
        purchasePriceIndex = parseInt(parts[parts.length - 1]);
        purchasePriceId = parts.slice(0, -1).join("-");
      } else {
        purchasePriceId = selectedPurchasePriceId;
      }
    } else if (!isWarehouseSupplier && formData.purchasePrices.length > 0) {
      const firstOption = formData.purchasePrices[0]?.values?.[0];
      if (firstOption) {
        const parts = firstOption.compositeId.split("-");
        purchasePriceIndex = parseInt(parts[parts.length - 1]);
        purchasePriceId = parts.slice(0, -1).join("-");
      }
    }

    let salePriceId = null;
    let salePriceIndex = 0;

    if (selectedSalePriceId) {
      const parts = selectedSalePriceId.split("-");
      if (parts.length >= 5) {
        salePriceIndex = parseInt(parts[parts.length - 1]);
        salePriceId = parts.slice(0, -1).join("-");
      } else {
        salePriceId = selectedSalePriceId;
      }
    } else if (formData.salePrices.length > 0) {
      const firstOption = formData.salePrices[0]?.values?.[0];
      if (firstOption) {
        const parts = firstOption.compositeId.split("-");
        salePriceIndex = parseInt(parts[parts.length - 1]);
        salePriceId = parts.slice(0, -1).join("-");
      }
    }

    return {
      ...data,
      supplierId: data.supplierId,
      buyerId: data.buyerId,
      warehouseId: isWarehouseSupplier && supplierWarehouse ? supplierWarehouse.id : null,
      basis: selectedBasis,
      carrierId: data.carrierId || null,
      deliveryLocationId: data.deliveryLocationId || null,
      dealDate: format(data.dealDate, "yyyy-MM-dd"),
      quantityKg: parseFloat(finalCalculations.calculatedKg),
      quantityLiters: data.quantityLiters ? parseFloat(data.quantityLiters) : null,
      density: data.density ? parseFloat(data.density) : null,
      purchasePrice: finalCalculations.purchasePrice,
      purchasePriceId: purchasePriceId,
      purchasePriceIndex: purchasePriceIndex,
      salePrice: finalCalculations.salePrice,
      salePriceId: salePriceId,
      salePriceIndex: salePriceIndex,
      purchaseAmount: finalCalculations.purchaseAmount,
      saleAmount: finalCalculations.saleAmount,
      deliveryCost: finalCalculations.deliveryCost,
      deliveryTariff: finalCalculations.deliveryTariff,
      profit: finalCalculations.profit,
    };
  };

  const createMutation = useMutation({
    mutationFn: async (data: OptFormData) => {
      const payload = buildMutationPayload(data);
      const res = await apiRequest("POST", "/api/opt", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key?.startsWith("/api/opt") || key?.startsWith("/api/warehouses");
        },
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
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: OptFormData & { id: string }) => {
      const payload = buildMutationPayload(data);
      const res = await apiRequest("PATCH", `/api/opt/${data.id}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key?.startsWith("/api/opt") || key?.startsWith("/api/warehouses");
        },
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
        variant: "destructive",
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
        <OptFormMainSection
          form={form}
          suppliers={suppliers}
          customers={customers}
          bases={bases}
          selectedSupplier={selectedSupplier}
          supplierWarehouseName={supplierWarehouse?.name}
          isWarehouseSupplier={isWarehouseSupplier}
        />

        <OptFormVolumeSection
          form={form}
          inputMode={inputMode}
          setInputMode={setInputMode}
          calculatedKg={finalCalculations.calculatedKg}
        />

        <OptFormBasisWarehouseSection
          form={form}
          selectedSupplier={selectedSupplier}
          bases={bases}
          selectedBasis={selectedBasis}
          setSelectedBasis={setSelectedBasis}
          warehouseStatus={warehouseStatus}
        />

        <OptFormPricingSection
          form={form}
          purchasePrices={formData.purchasePrices}
          salePrices={formData.salePrices}
          isWarehouseSupplier={isWarehouseSupplier}
          purchasePrice={finalCalculations.purchasePrice}
          salePrice={finalCalculations.salePrice}
          purchaseAmount={finalCalculations.purchaseAmount}
          saleAmount={finalCalculations.saleAmount}
          deliveryCost={finalCalculations.deliveryCost}
          profit={finalCalculations.profit}
          selectedPurchasePriceId={selectedPurchasePriceId}
          selectedSalePriceId={selectedSalePriceId}
          setSelectedPurchasePriceId={setSelectedPurchasePriceId}
          setSelectedSalePriceId={setSelectedSalePriceId}
        />

        <OptFormLogisticsSection
          form={form}
          availableCarriers={formData.availableCarriers}
          availableLocations={formData.availableLocations}
        />

        <OptFormNotesSection form={form} />

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