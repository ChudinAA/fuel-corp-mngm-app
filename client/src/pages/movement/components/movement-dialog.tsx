import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MOVEMENT_TYPE, PRODUCT_TYPE, COUNTERPARTY_TYPE, COUNTERPARTY_ROLE, ENTITY_TYPE } from "@shared/constants";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarIcon, Plus, Loader2 } from "lucide-react";
import { movementFormSchema, type MovementFormData } from "../schemas";
import { calculateKgFromLiters, formatNumber, formatCurrency } from "../utils";
import type { MovementDialogProps } from "../types";
import { CalculatedField } from "./calculated-field";
import { VolumeInputSection } from "../../opt/components/opt-form-sections";
import { MovementFormHeader } from "./movement-form-header";
import { MovementSourceSection } from "./movement-source-section";
import { MovementDestinationSection } from "./movement-destination-section";
import { MovementCostSummary } from "./movement-cost-summary";
import { 
  useMovementCalculations, 
  useAvailableCarriers, 
  useWarehouseBalance,
  useMovementValidation 
} from "../hooks";


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
  open,
  onOpenChange
}: MovementDialogProps) {
  const { toast } = useToast();
  const [inputMode, setInputMode] = useState<"liters" | "kg">("kg");
  const isEditing = !!editMovement;

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
      fromWarehouseId: "",
      toWarehouseId: "",
      inputMode: "kg",
      quantityLiters: undefined,
      density: undefined,
      quantityKg: undefined,
      carrierId: "",
      notes: "",
    },
  });

  // Обновляем форму при изменении editMovement
  useEffect(() => {
    if (editMovement) {
      form.reset({
        movementDate: new Date(editMovement.movementDate),
        movementType: editMovement.movementType,
        productType: editMovement.productType,
        supplierId: editMovement.supplierId || "",
        fromWarehouseId: editMovement.fromWarehouseId || "",
        toWarehouseId: editMovement.toWarehouseId,
        inputMode: "kg",
        quantityLiters: editMovement.quantityLiters ? String(editMovement.quantityLiters) : undefined,
        density: editMovement.density ? String(editMovement.density) : undefined,
        quantityKg: editMovement.quantityKg ? String(editMovement.quantityKg) : undefined,
        carrierId: editMovement.carrierId || "",
        notes: editMovement.notes || "",
      });
    } else {
      form.reset({
        movementDate: new Date(),
        movementType: MOVEMENT_TYPE.SUPPLY,
        productType: PRODUCT_TYPE.KEROSENE,
        supplierId: "",
        fromWarehouseId: "",
        toWarehouseId: "",
        inputMode: "kg",
        quantityLiters: undefined,
        density: undefined,
        quantityKg: undefined,
        carrierId: "",
        notes: "",
      });
    }
  }, [editMovement, form]);

  // Watch form values
  const watchMovementType = form.watch("movementType");
  const watchProductType = form.watch("productType");
  const watchSupplierId = form.watch("supplierId");
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
    purchasePrice,
    purchaseAmount,
    storageCost,
    deliveryCost,
    totalCost,
    costPerKg,
  } = useMovementCalculations({
    watchMovementType,
    watchProductType,
    watchSupplierId,
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

  const warehouseBalance = useWarehouseBalance({
    watchMovementType,
    watchProductType,
    watchFromWarehouseId,
    kgNum,
    warehouses,
  });

  const { validateForm } = useMovementValidation({
    watchMovementType,
    watchProductType,
    watchFromWarehouseId,
    calculatedKg,
    kgNum,
    purchasePrice,
    warehouses,
    toast,
  });

  const createMutation = useMutation({
    mutationFn: async (data: MovementFormData) => {
      if (!validateForm()) {
        throw new Error("Ошибка валидации данных");
      }

      const payload = {
        ...data,
        movementDate: format(data.movementDate, "yyyy-MM-dd"),
        supplierId: data.supplierId || null,
        fromWarehouseId: data.fromWarehouseId || null,
        toWarehouseId: data.toWarehouseId,
        carrierId: data.carrierId || null,
        quantityLiters: data.quantityLiters ? parseFloat(data.quantityLiters) : null,
        density: data.density ? parseFloat(data.density) : null,
        quantityKg: calculatedKg,
        purchasePrice: purchasePrice,
        deliveryPrice: deliveryCost > 0 && kgNum > 0 ? deliveryCost / kgNum : null,
        deliveryCost: deliveryCost,
        totalCost: totalCost,
        costPerKg: costPerKg,
      };
      const res = await apiRequest(isEditing ? "PATCH" : "POST", isEditing ? `/api/movement/${editMovement?.id}` : "/api/movement", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/movement"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key?.includes('/api/warehouses/') && key?.includes('/transactions');
        }
      });
      toast({ title: isEditing ? "Перемещение обновлено" : "Перемещение создано", description: "Запись успешно сохранена" });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      const errorMessage = error.message === "Ошибка валидации данных" 
        ? error.message 
        : "Произошла ошибка при сохранении. Проверьте введенные данные и повторите попытку.";
      toast({ title: "Ошибка", description: errorMessage, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Редактирование перемещения" : "Новое перемещение"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Изменение существующей записи" : "Создание записи о поставке или внутреннем перемещении"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-6">
            <MovementFormHeader form={form} />

            <MovementSourceSection
              form={form}
              watchMovementType={watchMovementType}
              watchProductType={watchProductType}
              suppliers={suppliers}
              warehouses={warehouses}
            />

            <MovementDestinationSection
              form={form}
              watchMovementType={watchMovementType}
              watchFromWarehouseId={watchFromWarehouseId}
              warehouses={warehouses}
              availableCarriers={availableCarriers}
              warehouseBalance={warehouseBalance}
            />

            <VolumeInputSection
              form={form}
              inputMode={inputMode}
              setInputMode={setInputMode}
              calculatedKg={calculatedKg?.toString() || "0"}
            />

            <MovementCostSummary
              purchasePrice={purchasePrice}
              purchaseAmount={purchaseAmount}
              storageCost={storageCost}
              deliveryCost={deliveryCost}
              costPerKg={costPerKg}
            />

            <FormField control={form.control} name="notes" render={({ field }) => (
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
            )} />

            <div className="flex justify-end gap-4 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
              <Button 
                type="submit" 
                disabled={
                  createMutation.isPending || 
                  (watchMovementType === MOVEMENT_TYPE.INTERNAL && warehouseBalance.status === "error")
                } 
                data-testid="button-create-movement"
              >
                {createMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{isEditing ? "Обновление..." : "Сохранение..."}</> : <><Plus className="mr-2 h-4 w-4" />{isEditing ? "Обновить" : "Создать"}</>}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}