import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MOVEMENT_TYPE, PRODUCT_TYPE } from "@shared/constants";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { movementFormSchema, type MovementFormData } from "../schemas";
import { VolumeInputSection } from "../../opt/components/opt-form-sections";
import { MovementFormHeader } from "./movement-form-header";
import { MovementSourceSection } from "./movement-source-section";
import { MovementDestinationSection } from "./movement-destination-section";
import { MovementCostSummary } from "./movement-cost-summary";
import { parsePriceCompositeId, extractPriceIdsForSubmit } from "@/pages/shared/utils/price-utils";
import {
  useMovementCalculations,
  useAvailableCarriers,
  useMovementValidation,
} from "../hooks";
import { useWarehouseBalanceMov } from "../hooks/use-warehouse-balance";

export interface MovementFormHandle {
  getFormState: () => { supplierId: string; fromWarehouseId: string; toWarehouseId: string };
  saveAsDraft: () => Promise<void>;
  isDirty: () => boolean;
}

interface MovementFormProps {
  warehouses: any[];
  suppliers: any[];
  carriers: any[];
  vehicles?: any[];
  trailers?: any[];
  drivers?: any[];
  deliveryCosts: any[];
  editMovement?: any;
  isCopy?: boolean;
  onSuccess: () => void;
}

export const MovementForm = forwardRef<MovementFormHandle, MovementFormProps>(
  ({ warehouses, suppliers, carriers, deliveryCosts, editMovement, isCopy, onSuccess }, ref) => {
    const { toast } = useToast();
    const [inputMode, setInputMode] = useState<"liters" | "kg">("kg");
    const [selectedPurchasePriceId, setSelectedPurchasePriceId] = useState<string>("");
    const isEditing = !!editMovement && !isCopy;

    const form = useForm<MovementFormData>({
      resolver: zodResolver(movementFormSchema),
      defaultValues: {
        movementDate: new Date(),
        movementType: MOVEMENT_TYPE.SUPPLY,
        productType: PRODUCT_TYPE.KEROSENE,
        supplierId: "",
        basis: "",
        basisId: "",
        fromWarehouseId: "",
        toWarehouseId: "",
        inputMode: "kg",
        quantityLiters: "",
        density: "",
        quantityKg: "",
        purchasePrice: "",
        selectedPurchasePriceId: "",
        purchasePriceId: "",
        purchasePriceIndex: 0,
        carrierId: "",
        notes: "",
      },
    });

    useImperativeHandle(ref, () => ({
      getFormState: () => ({
        supplierId: form.getValues("supplierId") || "",
        fromWarehouseId: form.getValues("fromWarehouseId") || "",
        toWarehouseId: form.getValues("toWarehouseId") || "",
      }),
      saveAsDraft: async () => {
        await createMutation.mutateAsync({ data: form.getValues(), isDraft: true });
      },
      isDirty: () => form.formState.isDirty,
    }));

    const [initialQuantityKg, setInitialQuantityKg] = useState<number>(0);

    const { data: allBases } = useQuery<any[]>({
      queryKey: ["/api/bases"],
    });

    useEffect(() => {
      if (editMovement) {
        if (!isCopy && editMovement.movementType === MOVEMENT_TYPE.INTERNAL && editMovement.fromWarehouseId) {
          setInitialQuantityKg(parseFloat(editMovement.quantityKg || "0"));
        } else {
          setInitialQuantityKg(0);
        }

        form.reset({
          movementDate: new Date(editMovement.movementDate),
          movementType: editMovement.movementType,
          productType: editMovement.productType,
          supplierId: editMovement.supplierId || "",
          basis: editMovement.basis || "",
          basisId: editMovement.basisId || "",
          fromWarehouseId: editMovement.fromWarehouseId || "",
          toWarehouseId: editMovement.toWarehouseId,
          inputMode: (editMovement.inputMode as "liters" | "kg") || (editMovement.quantityLiters ? "liters" : "kg"),
          quantityLiters: editMovement.quantityLiters ? String(editMovement.quantityLiters) : undefined,
          density: editMovement.density ? String(editMovement.density) : undefined,
          quantityKg: editMovement.quantityKg ? String(editMovement.quantityKg) : undefined,
          purchasePrice: editMovement.purchasePrice ? String(editMovement.purchasePrice) : "",
          selectedPurchasePriceId: editMovement.purchasePriceId ? `${editMovement.purchasePriceId}-${editMovement.purchasePriceIndex || 0}` : "",
          purchasePriceId: editMovement.purchasePriceId || "",
          purchasePriceIndex: editMovement.purchasePriceIndex || 0,
          carrierId: editMovement.carrierId || "",
          notes: editMovement.notes || "",
        });

        setSelectedPurchasePriceId(editMovement.purchasePriceId ? `${editMovement.purchasePriceId}-${editMovement.purchasePriceIndex || 0}` : "");
        if (editMovement.inputMode) setInputMode(editMovement.inputMode as "liters" | "kg");
        else if (editMovement.quantityLiters) setInputMode("liters");
        setInitialQuantityKg(isEditing ? parseFloat(editMovement.quantityKg || "0") : 0);
      } else {
        form.reset({
          movementDate: new Date(),
          movementType: MOVEMENT_TYPE.SUPPLY,
          productType: PRODUCT_TYPE.KEROSENE,
          supplierId: "",
          basis: "",
          basisId: "",
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

    const watchMovementType = form.watch("movementType");
    const watchProductType = form.watch("productType");
    const watchSupplierId = form.watch("supplierId");
    const watchBasisId = form.watch("basisId");
    const watchFromWarehouseId = form.watch("fromWarehouseId");
    const watchToWarehouseId = form.watch("toWarehouseId");
    const watchCarrierId = form.watch("carrierId");
    const watchMovementDate = form.watch("movementDate");
    const watchLiters = form.watch("quantityLiters");
    const watchDensity = form.watch("density");
    const watchKg = form.watch("quantityKg");

    const {
      calculatedKg,
      kgNum,
      availablePrices,
      purchasePrice,
      purchaseAmount,
      storageCost,
      deliveryCost,
      totalCost,
      costPerKg,
      supplierContractVolumeStatus,
    } = useMovementCalculations({
      form,
      watchMovementType: watchMovementType || MOVEMENT_TYPE.SUPPLY,
      watchProductType: watchProductType || PRODUCT_TYPE.KEROSENE,
      watchSupplierId: watchSupplierId || "",
      watchBasisId: watchBasisId || "",
      watchFromWarehouseId: watchFromWarehouseId || "",
      watchToWarehouseId: watchToWarehouseId || "",
      watchCarrierId: watchCarrierId || "",
      watchMovementDate: watchMovementDate || new Date(),
      watchLiters: watchLiters || "",
      watchDensity: watchDensity || "",
      watchKg: watchKg || "",
      inputMode,
      warehouses,
      suppliers,
      deliveryCosts,
      selectedPurchasePriceId,
      setSelectedPurchasePriceId,
      initialQuantityKg,
    });

    const availableCarriers = useAvailableCarriers({
      watchMovementType: watchMovementType || MOVEMENT_TYPE.SUPPLY,
      watchSupplierId: watchSupplierId || "",
      watchFromWarehouseId: watchFromWarehouseId || "",
      watchToWarehouseId: watchToWarehouseId || "",
      warehouses,
      suppliers,
      carriers,
      deliveryCosts,
    });

    const warehouseBalance = useWarehouseBalanceMov({
      watchMovementType: watchMovementType || MOVEMENT_TYPE.SUPPLY,
      watchProductType: watchProductType || PRODUCT_TYPE.KEROSENE,
      watchFromWarehouseId: watchFromWarehouseId || "",
      kgNum,
      warehouses,
      isEditing,
      initialQuantityKg,
      watchMovementDate: watchMovementDate || new Date(),
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
      mutationFn: async ({ data, isDraft }: { data: MovementFormData; isDraft?: boolean }) => {
        if (!isDraft) validateForm();
        const { purchasePriceId: extractedPriceId, purchasePriceIndex: extractedPriceIndex } = extractPriceIdsForSubmit(
          selectedPurchasePriceId,
          "",
          availablePrices.filter((p) => p.id === parsePriceCompositeId(selectedPurchasePriceId).priceId),
          [],
          false
        );
        const payload = {
          movementDate: data.movementDate ? format(data.movementDate, "yyyy-MM-dd'T'HH:mm:ss") : null,
          movementType: data.movementType,
          productType: data.productType,
          supplierId: data.supplierId || null,
          basis: data.basis || null,
          basisId: data.basisId || null,
          fromWarehouseId: data.fromWarehouseId || null,
          toWarehouseId: data.toWarehouseId || null,
          carrierId: data.carrierId || null,
          quantityLiters: data.quantityLiters ? parseFloat(data.quantityLiters) : null,
          density: data.density ? parseFloat(data.density) : null,
          quantityKg: calculatedKg,
          inputMode: data.inputMode,
          purchasePrice,
          purchasePriceId: extractedPriceId || null,
          purchasePriceIndex: extractedPriceIndex ?? 0,
          deliveryPrice: deliveryCost > 0 && kgNum > 0 ? deliveryCost / kgNum : null,
          deliveryCost,
          storageCost,
          totalCost,
          costPerKg,
          notes: data.notes || null,
          isDraft: !!isDraft,
        };
        const res = await apiRequest(isEditing ? "PATCH" : "POST", isEditing ? `/api/movement/${editMovement?.id}` : "/api/movement", payload);
        return res.json();
      },
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: ["/api/movement"] });
        queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
        queryClient.invalidateQueries({ queryKey: ["/api/opt/contract-used"] });
        toast({
          title: variables.isDraft ? "Черновик сохранен" : isEditing ? "Перемещение обновлено" : "Перемещение создано",
          description: "Запись успешно сохранена",
        });
        form.reset();
        onSuccess();
      },
      onError: (error: Error) => {
        toast({ title: "Ошибка", description: error.message, variant: "destructive" });
      },
    });

    return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit((data) => createMutation.mutate({ data, isDraft: false }))} className="space-y-6">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 items-end">
            <MovementFormHeader form={form} />
            <MovementSourceSection form={form} watchMovementType={watchMovementType} suppliers={suppliers} warehouses={warehouses} />
          </div>
          <MovementDestinationSection
            form={form as any}
            watchMovementType={watchMovementType || MOVEMENT_TYPE.SUPPLY}
            watchFromWarehouseId={watchFromWarehouseId || ""}
            warehouses={warehouses}
            suppliers={suppliers}
            allBases={allBases}
            availableCarriers={availableCarriers}
            warehouseBalance={warehouseBalance}
            supplierContractVolumeStatus={supplierContractVolumeStatus}
          />
          <VolumeInputSection form={form as any} setInputMode={setInputMode} calculatedKg={calculatedKg?.toString() || "0"} />
          <MovementCostSummary
            form={form as any}
            availablePrices={availablePrices}
            purchasePrice={purchasePrice}
            purchaseAmount={purchaseAmount}
            storageCost={storageCost}
            deliveryCost={deliveryCost}
            costPerKg={costPerKg}
            watchMovementType={watchMovementType || MOVEMENT_TYPE.SUPPLY}
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
                  <Input placeholder="Дополнительная информация..." data-testid="input-movement-notes" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex justify-end gap-4 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onSuccess}>Отмена</Button>
            {!isEditing || (editMovement && editMovement?.isDraft) ? (
              <Button
                type="button"
                variant="secondary"
                disabled={createMutation.isPending}
                onClick={() => createMutation.mutate({ data: form.getValues(), isDraft: true })}
                data-testid="button-save-draft"
              >
                {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Сохранить черновик"}
              </Button>
            ) : null}
            <Button
              type="submit"
              disabled={createMutation.isPending || (watchMovementType === MOVEMENT_TYPE.INTERNAL && warehouseBalance.status === "error")}
              data-testid="button-create-movement"
            >
              {createMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{isEditing ? "Обновление..." : "Сохранение..."}</>
              ) : (
                <>{isEditing && !editMovement.isDraft ? null : <Plus className="mr-2 h-4 w-4" />}{isEditing && !editMovement.isDraft ? "Обновить" : "Создать перемещение"}</>
              )}
            </Button>
          </div>
        </form>
      </Form>
    );
  }
);
