import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  EQUIPMENT_MOVEMENT_TYPE,
  EQUIPMENT_TYPE,
  PRODUCT_TYPE,
} from "@shared/constants";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Plus, Loader2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import {
  equipmentMovementFormSchema,
  type EquipmentMovementFormData,
} from "../schemas";
import type { EquipmentMovementDialogProps } from "../types";
import { VolumeInputSection } from "../../opt/components/opt-form-sections";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLikBalance } from "../hooks/use-lik-balance";
import { useLikCalculations } from "../hooks/use-lik-calculations";
import { Equipment } from "@shared/schema";

export function EquipmentMovementDialog({
  warehouses,
  editMovement,
  isCopy,
  open,
  onOpenChange,
}: EquipmentMovementDialogProps) {
  const { toast } = useToast();
  const [inputMode, setInputMode] = useState<"liters" | "kg">("kg");
  const isEditing = !!editMovement && !isCopy;
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const initialValuesRef = useRef<EquipmentMovementFormData | null>(null);

  const form = useForm<EquipmentMovementFormData>({
    resolver: zodResolver(equipmentMovementFormSchema),
    defaultValues: {
      movementDate: new Date(),
      movementType: EQUIPMENT_MOVEMENT_TYPE.STORAGE_TO_TZA,
      productType: PRODUCT_TYPE.KEROSENE,
      fromWarehouseId: "",
      toWarehouseId: "",
      fromEquipmentId: "",
      toEquipmentId: "",
      inputMode: "kg",
      quantityLiters: "",
      density: "",
      quantityKg: "",
      notes: "",
      isDraft: false,
    },
  });

  const watchMovementType = form.watch("movementType");
  const watchFromWarehouseId = form.watch("fromWarehouseId");
  const watchToWarehouseId = form.watch("toWarehouseId");
  const watchFromEquipmentId = form.watch("fromEquipmentId");
  const watchToEquipmentId = form.watch("toEquipmentId");
  const watchProductType = form.watch("productType");
  const watchLiters = form.watch("quantityLiters");
  const watchDensity = form.watch("density");
  const watchKg = form.watch("quantityKg");
  const watchMovementDate = form.watch("movementDate");

  const likWarehouses = warehouses.filter(
    (w) => w.equipmentType === EQUIPMENT_TYPE.LIK,
  );

  // Auto-fill logic for TZA -> Warehouse
  useEffect(() => {
    const defaultLikWarehouse = likWarehouses[0];
    if (watchMovementType === EQUIPMENT_MOVEMENT_TYPE.TZA_TO_STORAGE) {
      if (defaultLikWarehouse && !watchToWarehouseId) {
        form.setValue("toWarehouseId", defaultLikWarehouse.id);
      }
    } else if (watchMovementType === EQUIPMENT_MOVEMENT_TYPE.STORAGE_TO_TZA) {
      if (defaultLikWarehouse && !watchFromWarehouseId) {
        form.setValue("fromWarehouseId", defaultLikWarehouse.id);
      }
    }
  }, [watchMovementType, likWarehouses, watchFromWarehouseId, watchToWarehouseId, form]);

  const { data: likEquipments = [] } = useQuery<Equipment[]>({
    queryKey: ["/api/warehouses", watchFromWarehouseId || watchToWarehouseId, "equipment"],
    queryFn: async () => {
      const warehouseId = watchFromWarehouseId || watchToWarehouseId;
      const res = await apiRequest(
        "GET",
        `/api/warehouses/${warehouseId}/equipment`,
      );
      return res.json();
    },
    enabled: !!(watchFromWarehouseId || watchToWarehouseId),
  });

  // Auto-fill first available TZA for TZA -> Warehouse
  useEffect(() => {
    if (
      watchMovementType === EQUIPMENT_MOVEMENT_TYPE.TZA_TO_STORAGE &&
      likEquipments.length > 0 &&
      !watchFromEquipmentId
    ) {
      form.setValue("fromEquipmentId", likEquipments[0].id);
    }
  }, [watchMovementType, likEquipments, watchFromEquipmentId, form]);

  useEffect(() => {
    if (editMovement) {
      const resetValues = {
        movementDate: new Date(editMovement.movementDate),
        movementType:
          (editMovement as any).movementType ||
          EQUIPMENT_MOVEMENT_TYPE.STORAGE_TO_TZA,
        productType: editMovement.productType || PRODUCT_TYPE.KEROSENE,
        fromWarehouseId: editMovement.fromWarehouseId || "",
        toWarehouseId: editMovement.toWarehouseId || "",
        fromEquipmentId: editMovement.fromEquipmentId || "",
        toEquipmentId: editMovement.toEquipmentId || "",
        inputMode: (editMovement.inputMode as "liters" | "kg") || "kg",
        quantityLiters: editMovement.quantityLiters?.toString() || "",
        density: editMovement.density?.toString() || "",
        quantityKg: editMovement.quantityKg?.toString() || "",
        notes: editMovement.notes || "",
        isDraft: editMovement.isDraft || false,
      };
      initialValuesRef.current = resetValues;
      form.reset(resetValues);
      setInputMode(resetValues.inputMode);
    } else {
      form.reset({
        movementDate: new Date(),
        movementType: EQUIPMENT_MOVEMENT_TYPE.STORAGE_TO_TZA,
        productType: PRODUCT_TYPE.KEROSENE,
        fromWarehouseId: "",
        toWarehouseId: "",
        fromEquipmentId: "",
        toEquipmentId: "",
        inputMode: "kg",
        quantityLiters: "",
        density: "",
        quantityKg: "",
        notes: "",
        isDraft: false,
      });
      setInputMode("kg");
    }
  }, [editMovement, form, open]);

  const { calculatedKg, kgNum, purchaseAmount, averageCost } =
    useLikCalculations({
      form,
      watchMovementType,
      watchProductType,
      watchFromWarehouseId,
      watchToWarehouseId,
      watchFromEquipmentId,
      watchToEquipmentId,
      watchMovementDate,
      watchLiters,
      watchDensity,
      watchKg,
      inputMode,
      warehouses,
      equipments: likEquipments,
    });

  const likBalance = useLikBalance({
    watchMovementType,
    watchProductType,
    watchFromWarehouseId,
    watchFromEquipmentId,
    kgNum,
    warehouses,
    equipments: likEquipments,
    isEditing,
    initialQuantityKg: isEditing
      ? parseFloat(editMovement?.quantityKg || "0")
      : 0,
    watchMovementDate,
  });

  const mutation = useMutation({
    mutationFn: async ({
      data,
      isDraft,
    }: {
      data: EquipmentMovementFormData;
      isDraft?: boolean;
    }) => {
      const payload = {
        ...data,
        movementDate: format(data.movementDate, "yyyy-MM-dd'T'HH:mm:ss"),
        quantityKg: calculatedKg?.toString() || "0",
        quantityLiters: data.quantityLiters
          ? parseFloat(data.quantityLiters)
          : null,
        density: data.density ? parseFloat(data.density) : null,
        totalCost: purchaseAmount,
        costPerKg: averageCost,
        isDraft: !!isDraft,
      };
      const res = await apiRequest(
        isEditing ? "PATCH" : "POST",
        isEditing
          ? `/api/equipment-movement/${editMovement?.id}`
          : "/api/equipment-movement",
        payload,
      );
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment-movement"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/warehouses-equipment"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
      toast({
        title: variables.isDraft
          ? "Черновик сохранен"
          : isEditing
            ? "Обновлено"
            : "Создано",
      });
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

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      const isDirty =
        form.formState.isDirty ||
        JSON.stringify(form.getValues()) !==
          JSON.stringify(
            initialValuesRef.current || form.control._defaultValues,
          );
      if (isDirty && !mutation.isPending) {
        setShowExitConfirm(true);
      } else {
        onOpenChange(false);
      }
    } else {
      onOpenChange(true);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditing
                ? "Редактирование перемещения ЛИК"
                : "Новое перемещение ЛИК"}
            </DialogTitle>
            <DialogDescription>
              Локальное распределение топлива между складом и ТЗА
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((data) =>
                mutation.mutate({ data, isDraft: false }),
              )}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="movementDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Дата</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className="w-full justify-start text-left font-normal"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value ? (
                                format(field.value, "dd.MM.yyyy", { locale: ru })
                              ) : (
                                <span>Выберите дату</span>
                              )}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            locale={ru}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="movementType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Тип перемещения</FormLabel>
                      <Select
                        onValueChange={(val) => {
                          field.onChange(val);
                          // Clear incompatible fields to prevent stale data in DB
                          if (val === EQUIPMENT_MOVEMENT_TYPE.STORAGE_TO_TZA) {
                            form.setValue("toWarehouseId", "");
                            form.setValue("fromEquipmentId", "");
                          } else if (val === EQUIPMENT_MOVEMENT_TYPE.TZA_TO_STORAGE) {
                            form.setValue("fromWarehouseId", "");
                            form.setValue("toEquipmentId", "");
                          } else if (val === EQUIPMENT_MOVEMENT_TYPE.TZA_TO_TZA) {
                            form.setValue("fromWarehouseId", "");
                            form.setValue("toWarehouseId", "");
                          }
                        }}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Выберите тип" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem
                            value={EQUIPMENT_MOVEMENT_TYPE.STORAGE_TO_TZA}
                          >
                            Склад {"->"} ТЗА
                          </SelectItem>
                          <SelectItem
                            value={EQUIPMENT_MOVEMENT_TYPE.TZA_TO_STORAGE}
                          >
                            ТЗА {"->"} Склад
                          </SelectItem>
                          <SelectItem
                            value={EQUIPMENT_MOVEMENT_TYPE.TZA_TO_TZA}
                          >
                            ТЗА {"->"} ТЗА
                          </SelectItem>
                        </SelectContent>
                      </Select>
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
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Выберите продукт" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={PRODUCT_TYPE.KEROSENE}>
                            Керосин
                          </SelectItem>
                          <SelectItem value={PRODUCT_TYPE.PVKJ}>
                            ПВКЖ
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4 border p-4 rounded-md">
                  <h3 className="font-medium text-sm border-b pb-2">Откуда</h3>
                  {watchMovementType ===
                  EQUIPMENT_MOVEMENT_TYPE.STORAGE_TO_TZA ? (
                    <FormField
                      control={form.control}
                      name="fromWarehouseId"
                      render={({ field }) => (
                        <FormItem key={`fromWh-${watchMovementType}`}>
                          <FormLabel>Склад</FormLabel>
                          <Combobox
                            key={`combo-from-wh-${watchMovementType}`}
                            options={likWarehouses.map((w) => ({
                              label: w.name,
                              value: w.id,
                            }))}
                            value={field.value || ""}
                            onValueChange={field.onChange}
                            placeholder="Выберите склад"
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : (
                    <FormField
                      control={form.control}
                      name="fromEquipmentId"
                      render={({ field }) => (
                        <FormItem key={`fromEq-${watchMovementType}`}>
                          <FormLabel>ТЗА</FormLabel>
                          <Combobox
                            key={`combo-from-eq-${watchMovementType}`}
                            options={likEquipments.map((e) => ({
                              label: e.name,
                              value: e.id,
                            }))}
                            value={field.value || ""}
                            onValueChange={field.onChange}
                            placeholder="Выберите ТЗА"
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  <div className="pt-2">
                    <p className="text-xs text-muted-foreground">
                      Объем на{" "}
                      {watchMovementType ===
                      EQUIPMENT_MOVEMENT_TYPE.STORAGE_TO_TZA
                        ? "складе"
                        : "ТЗА"}
                      :
                    </p>
                    <p
                      className={`text-sm font-semibold ${likBalance.status === "error" ? "text-destructive" : "text-primary"}`}
                    >
                      {likBalance.message}
                    </p>
                  </div>
                </div>

                <div className="space-y-4 border p-4 rounded-md">
                  <h3 className="font-medium text-sm border-b pb-2">Куда</h3>
                  {watchMovementType ===
                  EQUIPMENT_MOVEMENT_TYPE.TZA_TO_STORAGE ? (
                    <FormField
                      control={form.control}
                      name="toWarehouseId"
                      render={({ field }) => (
                        <FormItem key={`toWh-${watchMovementType}`}>
                          <FormLabel>Склад</FormLabel>
                          <Combobox
                            key={`combo-to-wh-${watchMovementType}`}
                            options={likWarehouses.map((w) => ({
                              label: w.name,
                              value: w.id,
                            }))}
                            value={field.value || ""}
                            onValueChange={field.onChange}
                            placeholder="Выберите склад"
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : (
                    <FormField
                      control={form.control}
                      name="toEquipmentId"
                      render={({ field }) => (
                        <FormItem key={`toEq-${watchMovementType}`}>
                          <FormLabel>ТЗА</FormLabel>
                          <Combobox
                            key={`combo-to-eq-${watchMovementType}`}
                            options={likEquipments.map((e) => ({
                              label: e.name,
                              value: e.id,
                            }))}
                            value={field.value || ""}
                            onValueChange={field.onChange}
                            placeholder="Выберите ТЗА"
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </div>

              <VolumeInputSection
                form={form as any}
                setInputMode={setInputMode}
                calculatedKg={calculatedKg?.toString() || "0"}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Себестоимость (за кг):
                  </p>
                  <p className="text-lg font-bold">
                    {averageCost.toLocaleString()} ₽
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Сумма покупки:
                  </p>
                  <p className="text-lg font-bold text-primary">
                    {purchaseAmount.toLocaleString()} ₽
                  </p>
                </div>
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Примечания</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Дополнительная информация..."
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
                {(!isEditing || (editMovement && editMovement.isDraft)) && (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={mutation.isPending}
                    onClick={() =>
                      mutation.mutate({ data: form.getValues(), isDraft: true })
                    }
                  >
                    {mutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      "Сохранить черновик"
                    )}
                  </Button>
                )}
                <Button
                  type="submit"
                  disabled={mutation.isPending || likBalance.status === "error"}
                >
                  {mutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  {isEditing ? "Обновить" : "Создать перемещение"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showExitConfirm} onOpenChange={setShowExitConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Сохранить черновик?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы начали вводить данные. Хотите сохранить изменения как черновик
              перед закрытием?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => onOpenChange(false)}>
              Нет
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                mutation.mutate({ data: form.getValues(), isDraft: true })
              }
            >
              Да, сохранить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
