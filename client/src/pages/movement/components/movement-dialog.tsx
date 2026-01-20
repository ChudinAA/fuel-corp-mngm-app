import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MOVEMENT_TYPE, PRODUCT_TYPE } from "@shared/constants";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Loader2 } from "lucide-react";
import { movementFormSchema, type MovementFormData } from "../schemas";
import type { MovementDialogProps } from "../types";
import { VolumeInputSection } from "../../opt/components/opt-form-sections";
import { MovementFormHeader } from "./movement-form-header";
import { MovementSourceSection } from "./movement-source-section";
import { MovementDestinationSection } from "./movement-destination-section";
import { MovementCostSummary } from "./movement-cost-summary";
import { parsePriceCompositeId } from "@/pages/shared/utils/price-utils";
import { extractPriceIdsForSubmit } from "@/pages/shared/utils/price-utils";
import {
  useMovementCalculations,
  useAvailableCarriers,
  useWarehouseBalance,
  useMovementValidation,
} from "../hooks";
import { useWarehouseBalanceMov } from "../hooks/use-warehouse-balance";

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
  isCopy,
  open,
  onOpenChange,
}: MovementDialogProps) {
  const { toast } = useToast();
  const [inputMode, setInputMode] = useState<"liters" | "kg">("kg");
  const [selectedPurchasePriceId, setSelectedPurchasePriceId] =
    useState<string>("");
  const isEditing = !!editMovement && !isCopy;

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
      basis: "",
      fromWarehouseId: "",
      toWarehouseId: "",
      inputMode: "kg",
      quantityLiters: undefined,
      density: undefined,
      quantityKg: undefined,
      purchasePrice: "",
      selectedPurchasePriceId: "",
      purchasePriceId: "",
      purchasePriceIndex: 0,
      carrierId: "",
      notes: "",
    },
  });

  // Состояние для отслеживания начального баланса при редактировании
  const [initialWarehouseBalance, setInitialWarehouseBalance] =
    useState<number>(0);
  // Состояние для отслеживания начального количества КГ при редактировании
  const [initialQuantityKg, setInitialQuantityKg] = useState<number>(0);

  // Обновляем форму при изменении editMovement или открытии диалога
  useEffect(() => {
    if (editMovement) {
      // При редактировании внутреннего перемещения вычисляем начальный баланс
      if (
        !isCopy &&
        editMovement.movementType === MOVEMENT_TYPE.INTERNAL &&
        editMovement.fromWarehouseId
      ) {
        const fromWarehouse = warehouses.find(
          (w) => w.id === editMovement.fromWarehouseId,
        );
        if (fromWarehouse) {
          const isPvkj = editMovement.productType === PRODUCT_TYPE.PVKJ;
          const currentBalance = parseFloat(
            isPvkj
              ? fromWarehouse.pvkjBalance || "0"
              : fromWarehouse.currentBalance || "0",
          );
          const movementKg = parseFloat(editMovement.quantityKg || "0");
          // Восстанавливаем баланс на момент создания сделки
          setInitialWarehouseBalance(currentBalance + movementKg);
        }
      } else {
        setInitialWarehouseBalance(0);
      }

      form.reset({
        movementDate: new Date(editMovement.movementDate),
        movementType: editMovement.movementType,
        productType: editMovement.productType,
        supplierId: editMovement.supplierId || "",
        basis: editMovement.basis || "",
        fromWarehouseId: editMovement.fromWarehouseId || "",
        toWarehouseId: editMovement.toWarehouseId,
        inputMode: "kg",
        quantityLiters: editMovement.quantityLiters
          ? String(editMovement.quantityLiters)
          : undefined,
        density: editMovement.density
          ? String(editMovement.density)
          : undefined,
        quantityKg: editMovement.quantityKg
          ? String(editMovement.quantityKg)
          : undefined,
        purchasePrice: editMovement.purchasePrice
          ? String(editMovement.purchasePrice)
          : "",
        selectedPurchasePriceId: editMovement.purchasePriceId
          ? `${editMovement.purchasePriceId}-${editMovement.purchasePriceIndex || 0}`
          : "",
        purchasePriceId: editMovement.purchasePriceId || "",
        purchasePriceIndex: editMovement.purchasePriceIndex || 0,
        carrierId: editMovement.carrierId || "",
        notes: editMovement.notes || "",
      });

      setSelectedPurchasePriceId(
        editMovement.purchasePriceId
          ? `${editMovement.purchasePriceId}-${editMovement.purchasePriceIndex || 0}`
          : "",
      );

      setInitialQuantityKg(
        isEditing ? parseFloat(editMovement.quantityKg || "0") : 0,
      );
    } else {
      setInitialWarehouseBalance(0);
      form.reset({
        movementDate: new Date(),
        movementType: MOVEMENT_TYPE.SUPPLY,
        productType: PRODUCT_TYPE.KEROSENE,
        supplierId: "",
        basis: "",
        fromWarehouseId: "",
        toWarehouseId: "",
        inputMode: "kg",
        quantityLiters: undefined,
        density: undefined,
        quantityKg: undefined,
        carrierId: "",
        notes: "",
        selectedPurchasePriceId: "",
        purchasePriceId: "",
        purchasePriceIndex: 0,
      });
      setSelectedPurchasePriceId("");
      setInitialQuantityKg(0);
    }
  }, [editMovement, form, warehouses]);

  // Watch form values
  const watchMovementType = form.watch("movementType");
  const watchProductType = form.watch("productType");
  const watchSupplierId = form.watch("supplierId");
  const watchBasis = form.watch("basis");
  const watchFromWarehouseId = form.watch("fromWarehouseId");
  const watchToWarehouseId = form.watch("toWarehouseId");
  const watchCarrierId = form.watch("carrierId");
  const watchMovementDate = form.watch("movementDate");
  const watchLiters = form.watch("quantityLiters");
  const watchDensity = form.watch("density");
  const watchKg = form.watch("quantityKg");

  // Use custom hooks for calculations and logic
  const {
    calculatedKg,
    kgNum,
    availablePrices,
    purchasePrice,
    purchasePriceId,
    purchasePriceIndex,
    purchaseAmount,
    storageCost,
    deliveryCost,
    totalCost,
    costPerKg,
    supplierContractVolumeStatus,
  } = useMovementCalculations({
    form,
    watchMovementType,
    watchProductType,
    watchSupplierId,
    watchBasis,
    watchFromWarehouseId,
    watchToWarehouseId,
    watchCarrierId,
    watchMovementDate,
    watchLiters,
    watchDensity,
    watchKg,
    inputMode,
    warehouses,
    suppliers,
    prices,
    deliveryCosts,
    allBases,
    isEditing,
    selectedPurchasePriceId,
    setSelectedPurchasePriceId,
    initialQuantityKg,
  });

  const availableCarriers = useAvailableCarriers({
    watchMovementType,
    watchSupplierId,
    watchFromWarehouseId,
    watchToWarehouseId,
    warehouses,
    suppliers,
    carriers,
    deliveryCosts,
  });

  const warehouseBalance = useWarehouseBalanceMov({
    watchMovementType,
    watchProductType,
    watchFromWarehouseId,
    kgNum,
    warehouses,
    isEditing,
    initialWarehouseBalance,
    watchMovementDate,
  });

  const { validateForm } = useMovementValidation({
    watchMovementType,
    watchProductType,
    watchFromWarehouseId,
    calculatedKg,
    kgNum,
    purchasePrice,
    warehouses,
    supplierContractVolumeStatus,
    toast,
  });

  const createMutation = useMutation({
    mutationFn: async (data: MovementFormData) => {
      validateForm();

      const {
        purchasePriceId: extractedPriceId,
        purchasePriceIndex: extractedPriceIndex,
      } = extractPriceIdsForSubmit(
        selectedPurchasePriceId,
        "",
        prices.filter(
          (p) =>
            p.id === parsePriceCompositeId(selectedPurchasePriceId).priceId,
        ),
        [],
        false,
      );

      const payload = {
        movementDate: format(data.movementDate, "yyyy-MM-dd'T'HH:mm:ss"),
        movementType: data.movementType,
        productType: data.productType,
        supplierId: data.supplierId || null,
        basis: data.basis || null,
        fromWarehouseId: data.fromWarehouseId || null,
        toWarehouseId: data.toWarehouseId,
        carrierId: data.carrierId || null,
        quantityLiters: data.quantityLiters
          ? parseFloat(data.quantityLiters)
          : null,
        density: data.density ? parseFloat(data.density) : null,
        quantityKg: calculatedKg,
        purchasePrice: purchasePrice,
        purchasePriceId: extractedPriceId || null,
        purchasePriceIndex: extractedPriceIndex ?? 0,
        deliveryPrice:
          deliveryCost > 0 && kgNum > 0 ? deliveryCost / kgNum : null,
        deliveryCost: deliveryCost,
        totalCost: totalCost,
        costPerKg: costPerKg,
        notes: data.notes || null,
      };
      const res = await apiRequest(
        isEditing ? "PATCH" : "POST",
        isEditing ? `/api/movement/${editMovement?.id}` : "/api/movement",
        payload,
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/movement"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return (
            key?.includes("/api/warehouses/") && key?.includes("/transactions")
          );
        },
      });
      toast({
        title: isEditing ? "Перемещение обновлено" : "Перемещение создано",
        description: "Запись успешно сохранена",
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[950px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isCopy
              ? "Копирование перемещения"
              : isEditing
                ? "Редактирование перемещения"
                : "Новое перемещение"}
          </DialogTitle>
          <DialogDescription>
            {isCopy
              ? "Создание нового перемещения на основе существующего"
              : isEditing
                ? "Изменение существующей записи"
                : "Создание записи о поставке или внутреннем перемещении"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((data) => createMutation.mutate(data))}
            className="space-y-6"
          >
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 items-end">
              <MovementFormHeader form={form} />
              <MovementSourceSection
                form={form}
                watchMovementType={watchMovementType}
                suppliers={suppliers}
                warehouses={warehouses}
              />
            </div>

            <MovementDestinationSection
              form={form}
              watchMovementType={watchMovementType}
              watchFromWarehouseId={watchFromWarehouseId}
              warehouses={warehouses}
              suppliers={suppliers}
              allBases={allBases}
              availableCarriers={availableCarriers}
              warehouseBalance={warehouseBalance}
              supplierContractVolumeStatus={supplierContractVolumeStatus}
            />

            <VolumeInputSection
              form={form}
              inputMode={inputMode}
              setInputMode={setInputMode}
              calculatedKg={calculatedKg?.toString() || "0"}
            />

            <MovementCostSummary
              form={form}
              availablePrices={availablePrices}
              purchasePrice={purchasePrice}
              purchaseAmount={purchaseAmount}
              storageCost={storageCost}
              deliveryCost={deliveryCost}
              costPerKg={costPerKg}
              watchMovementType={watchMovementType}
              selectedPurchasePriceId={selectedPurchasePriceId}
              setSelectedPurchasePriceId={setSelectedPurchasePriceId}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
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
              )}
            />

            <div className="flex justify-end gap-4 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Отмена
              </Button>
              <Button
                type="submit"
                disabled={
                  createMutation.isPending ||
                  (watchMovementType === MOVEMENT_TYPE.INTERNAL &&
                    warehouseBalance.status === "error")
                }
                data-testid="button-create-movement"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isEditing ? "Обновление..." : "Сохранение..."}
                  </>
                ) : (
                  <>
                    {isEditing ? null : <Plus className="mr-2 h-4 w-4" />}
                    {isEditing ? "Обновить" : "Создать перемещение"}
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
