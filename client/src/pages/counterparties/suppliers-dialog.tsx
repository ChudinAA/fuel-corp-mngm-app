import { Combobox } from "@/components/ui/combobox";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useErrorModal } from "@/hooks/use-error-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Loader2, X, Warehouse } from "lucide-react";
import type { Supplier, Base } from "@shared/schema";
import type { Warehouse as WarehouseType } from "@shared/schema";
import { BaseTypeBadge } from "@/components/base-type-badge";
import { useAuth } from "@/hooks/use-auth";
import { AddBaseDialog } from "../directories/bases-dialog";
import { DateInput } from "@/components/ui/date-input";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";

const supplierFormSchema = z.object({
  name: z.string().min(1, "Укажите название"),
  fullName: z.string().optional(),
  iata: z.string().optional(),
  inn: z.string().optional(),
  supplyNomenclature: z.string().optional(),
  description: z.string().optional(),
  baseIds: z
    .array(z.string().min(1, "Выберите базис"))
    .min(1, "Добавьте хотя бы один базис"),
  warehouseLinkMode: z.enum(["none", "existing", "create"]).default("none"),
  linkedWarehouseId: z.string().optional(),
  newWarehouseName: z.string().optional(),
  newWarehouseStorageCost: z.string().optional(),
  hasSpecialConditions: z.boolean().default(false),
  specialConditions: z.string().optional(),
  specialConditionsExpiresAt: z.date().optional().nullable(),
  isIntermediary: z.boolean().default(false),
  isForeign: z.boolean().default(false),
  withVAT: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

type BasisPriceEntry = {
  servicePrice: string;
  pvkjPrice: string;
  agentFee: string;
  otherServiceType: string;
  otherServiceValue: string;
};

type SupplierFormData = z.infer<typeof supplierFormSchema>;

interface AddSupplierDialogProps {
  bases: Base[];
  editItem?: Supplier | null;
  onEditComplete?: () => void;
  isInline?: boolean;
  inlineOpen?: boolean;
  onInlineOpenChange?: (open: boolean) => void;
  onCreated?: (id: string) => void;
}

export function AddSupplierDialog({
  bases,
  editItem,
  onEditComplete,
  isInline = false,
  inlineOpen = false,
  onInlineOpenChange,
  onCreated,
}: AddSupplierDialogProps) {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const { showError, ErrorModalComponent } = useErrorModal();
  const [localOpen, setLocalOpen] = useState(false);
  const [addBaseOpen, setAddBaseOpen] = useState(false);
  const defaultBasisPriceEntry = (): BasisPriceEntry => ({ servicePrice: "", pvkjPrice: "", agentFee: "", otherServiceType: "", otherServiceValue: "" });
  const [basisPricesMap, setBasisPricesMap] = useState<Record<string, BasisPriceEntry>>({});
  const [newlyAddedBasisIndex, setNewlyAddedBasisIndex] = useState<number | null>(null);
  const newBasisRef = useRef<HTMLDivElement | null>(null);

  const open = isInline ? inlineOpen : localOpen;
  const setOpen = isInline ? onInlineOpenChange || setLocalOpen : setLocalOpen;

  const { data: allWarehouses = [] } = useQuery<WarehouseType[]>({
    queryKey: ["/api/warehouses"],
    enabled: open,
  });

  const form = useForm<SupplierFormData>({
    resolver: zodResolver(supplierFormSchema),
    defaultValues: {
      name: "",
      fullName: "",
      iata: "",
      inn: "",
      supplyNomenclature: "",
      description: "",
      baseIds: [""],
      warehouseLinkMode: "none",
      linkedWarehouseId: "",
      newWarehouseName: "",
      newWarehouseStorageCost: "",
      hasSpecialConditions: false,
      specialConditions: "",
      specialConditionsExpiresAt: null,
      isIntermediary: false,
      isForeign: false,
      withVAT: false,
      isActive: true,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "baseIds",
  });

  useEffect(() => {
    if (fields.length === 0) {
      append("");
    }
  }, [fields.length, append]);

  useEffect(() => {
    if (newlyAddedBasisIndex !== null && newBasisRef.current) {
      newBasisRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
      const timer = setTimeout(() => setNewlyAddedBasisIndex(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [newlyAddedBasisIndex, fields.length]);

  const warehouseLinkMode = form.watch("warehouseLinkMode");
  const isForeign = form.watch("isForeign");
  const hasSpecialConditions = form.watch("hasSpecialConditions");
  const watchedBaseIds = form.watch("baseIds");

  // Filter warehouses: unlinked ones + currently linked one (for edit)
  const freeWarehouses = allWarehouses.filter(
    (w) => !w.supplierId || (editItem && w.supplierId === editItem.id)
  );

  const createMutation = useMutation({
    mutationFn: async (data: SupplierFormData) => {
      const endpoint = editItem
        ? `/api/suppliers/${editItem.id}`
        : "/api/suppliers";
      const filteredBaseIds = data.baseIds.filter(
        (id) => id && id.trim() !== "",
      );
      const basisPricesArray = filteredBaseIds.map((basisId) => {
        const entry = basisPricesMap[basisId] || defaultBasisPriceEntry();
        return {
          basisId,
          servicePrice: entry.servicePrice ? entry.servicePrice : null,
          pvkjPrice: entry.pvkjPrice ? entry.pvkjPrice : null,
          agentFee: entry.agentFee ? entry.agentFee : null,
          otherServiceType: entry.otherServiceType || null,
          otherServiceValue: entry.otherServiceValue ? entry.otherServiceValue : null,
        };
      });

      // Build warehouse action
      let warehouseAction: string | undefined;
      let warehouseIdParam: string | undefined;
      let newWarehouseData: any;

      if (data.warehouseLinkMode === "existing" && data.linkedWarehouseId) {
        // Check if we're re-linking to the same warehouse (no action needed) vs a new one
        const currentWarehouseId = (editItem as any)?.warehouseId;
        if (data.linkedWarehouseId !== currentWarehouseId) {
          warehouseAction = "link";
          warehouseIdParam = data.linkedWarehouseId;
        }
      } else if (data.warehouseLinkMode === "create") {
        warehouseAction = "create";
        newWarehouseData = {
          name: data.newWarehouseName || data.name,
          baseIds: filteredBaseIds,
          storageCost: data.newWarehouseStorageCost || null,
        };
      } else if (data.warehouseLinkMode === "none") {
        // If previously had a warehouse, unlink it
        if ((editItem as any)?.warehouseId) {
          warehouseAction = "unlink";
        }
      }

      const payload = {
        name: data.name,
        fullName: data.fullName || null,
        iata: data.iata || null,
        inn: data.inn || null,
        supplyNomenclature: data.supplyNomenclature || null,
        description: data.description,
        baseIds: filteredBaseIds.length > 0 ? filteredBaseIds : null,
        basisPrices: basisPricesArray,
        isWarehouse: data.warehouseLinkMode !== "none",
        hasSpecialConditions: data.hasSpecialConditions,
        specialConditions: data.hasSpecialConditions ? (data.specialConditions || null) : null,
        specialConditionsExpiresAt: data.hasSpecialConditions && data.specialConditionsExpiresAt
          ? format(data.specialConditionsExpiresAt, "yyyy-MM-dd")
          : null,
        isIntermediary: data.isIntermediary,
        isForeign: data.isForeign,
        withVAT: data.isForeign ? data.withVAT : false,
        isActive: data.isActive,
        ...(warehouseAction && { warehouseAction }),
        ...(warehouseIdParam && { warehouseId: warehouseIdParam }),
        ...(newWarehouseData && { newWarehouseData }),
      };

      const res = await apiRequest(
        editItem ? "PATCH" : "POST",
        endpoint,
        payload,
      );
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/storage-cards/advances"] });
      toast({
        title: editItem ? "Поставщик обновлен" : "Поставщик добавлен",
        description: editItem
          ? "Изменения сохранены"
          : "Новый поставщик сохранен в справочнике",
      });
      form.reset({
        name: "",
        fullName: "",
        iata: "",
        inn: "",
        supplyNomenclature: "",
        description: "",
        baseIds: [""],
        warehouseLinkMode: "none",
        linkedWarehouseId: "",
        newWarehouseName: "",
        newWarehouseStorageCost: "",
        hasSpecialConditions: false,
        specialConditions: "",
        specialConditionsExpiresAt: null,
        isIntermediary: false,
        isForeign: false,
        withVAT: false,
        isActive: true,
      });
      setBasisPricesMap({});
      setOpen(false);
      if (onCreated && data?.id) {
        onCreated(data.id);
      }
      if (onEditComplete) {
        onEditComplete();
      }
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });

  useEffect(() => {
    if (editItem) {
      setOpen(true);
      const baseIdsArray =
        editItem.baseIds && editItem.baseIds.length > 0
          ? editItem.baseIds
          : [""];

      const existingWarehouseId = (editItem as any).warehouseId;
      form.reset({
        name: editItem.name,
        fullName: editItem.fullName || "",
        iata: editItem.iata || "",
        inn: (editItem as any).inn || "",
        supplyNomenclature: editItem.supplyNomenclature || "",
        description: editItem.description || "",
        baseIds: baseIdsArray,
        warehouseLinkMode: existingWarehouseId ? "existing" : "none",
        linkedWarehouseId: existingWarehouseId || "",
        newWarehouseName: editItem.name,
        newWarehouseStorageCost: "",
        hasSpecialConditions: editItem.hasSpecialConditions || false,
        specialConditions: editItem.specialConditions || "",
        specialConditionsExpiresAt: editItem.specialConditionsExpiresAt
          ? parseISO(editItem.specialConditionsExpiresAt)
          : null,
        isIntermediary: editItem.isIntermediary || false,
        isForeign: editItem.isForeign || false,
        withVAT: editItem.withVAT || false,
        isActive: editItem.isActive,
      });
      const pricesMap: Record<string, BasisPriceEntry> = {};
      if (editItem.basisPrices && Array.isArray(editItem.basisPrices)) {
        editItem.basisPrices.forEach((bp: { basisId: string; servicePrice?: string | null; pvkjPrice?: string | null; agentFee?: string | null; otherServiceType?: string | null; otherServiceValue?: string | null }) => {
          pricesMap[bp.basisId] = {
            servicePrice: bp.servicePrice || "",
            pvkjPrice: bp.pvkjPrice || "",
            agentFee: bp.agentFee || "",
            otherServiceType: bp.otherServiceType || "",
            otherServiceValue: bp.otherServiceValue || "",
          };
        });
      }
      setBasisPricesMap(pricesMap);
    }
  }, [editItem, form]);

  // When supplier name changes, update the default new warehouse name
  const watchedName = form.watch("name");
  useEffect(() => {
    if (!editItem) {
      form.setValue("newWarehouseName", watchedName);
    }
  }, [watchedName, editItem, form]);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      form.reset({
        name: "",
        fullName: "",
        iata: "",
        inn: "",
        supplyNomenclature: "",
        description: "",
        baseIds: [""],
        warehouseLinkMode: "none",
        linkedWarehouseId: "",
        newWarehouseName: "",
        newWarehouseStorageCost: "",
        hasSpecialConditions: false,
        specialConditions: "",
        specialConditionsExpiresAt: null,
        isIntermediary: false,
        isForeign: false,
        withVAT: false,
        isActive: true,
      });
      setBasisPricesMap({});
      if (onEditComplete) {
        onEditComplete();
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!isInline && (
        <DialogTrigger asChild>
          <Button size="sm" data-testid="button-add-supplier">
            <Plus className="mr-2 h-4 w-4" />
            Добавить
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editItem ? "Редактирование поставщика" : "Новый поставщик"}
          </DialogTitle>
          <DialogDescription>
            {editItem
              ? "Изменение записи в справочнике"
              : "Добавление нового поставщика"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit((data) => createMutation.mutate(data))(e);
            }}
            className="space-y-4"
          >
            <div className="flex gap-3">
              <div className="flex-[3]">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Название</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Сокращенное название"
                          data-testid="input-supplier-name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex-1">
                <FormField
                  control={form.control}
                  name="iata"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Код IATA</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="IATA"
                          data-testid="input-supplier-iata"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Полное название</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Полное название"
                      data-testid="input-supplier-fullname"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="inn"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ИНН</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="ИНН организации"
                      data-testid="input-supplier-inn"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="supplyNomenclature"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Номенклатура поставки</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Номенклатура поставки"
                      data-testid="input-supplier-nomenclature"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <FormLabel>Базисы</FormLabel>
                <div className="flex items-center gap-2">
                  {hasPermission("directories", "create") && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setAddBaseOpen(true)}
                      data-testid="button-add-base-inline"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Создать новый
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newIndex = fields.length;
                      append("");
                      setNewlyAddedBasisIndex(newIndex);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {fields.map((field, index) => {
                const currentBasisId = form.watch(`baseIds.${index}`) || "";
                const basisPrices = basisPricesMap[currentBasisId] || defaultBasisPriceEntry();
                return (
                <div
                  key={field.id}
                  ref={index === newlyAddedBasisIndex ? newBasisRef : undefined}
                  className={cn(
                    "border rounded-md p-3 space-y-2 transition-all duration-300",
                    index === newlyAddedBasisIndex && "ring-2 ring-primary border-primary bg-primary/5",
                  )}
                >
                  <div className="flex gap-2 items-center">
                    <div className="flex-1 min-w-0">
                      <Combobox
                        options={(bases || []).map((b) => ({
                          value: b.id,
                          label: b.name,
                          render: (
                            <div className="flex items-center gap-2">
                              {b.name}
                              <BaseTypeBadge type={b.baseType} />
                            </div>
                          ),
                        }))}
                        value={currentBasisId}
                        onValueChange={(value) =>
                          form.setValue(`baseIds.${index}`, value)
                        }
                        placeholder="Выберите базис"
                        className="w-full"
                        dataTestId={`select-base-${index}`}
                      />
                      {form.formState.errors.baseIds?.[index] && (
                        <p className="text-sm text-destructive mt-1">
                          {form.formState.errors.baseIds[index]?.message}
                        </p>
                      )}
                    </div>
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(index)}
                        className="shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {currentBasisId && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Стоимость услуги</label>
                          <Input
                            placeholder="0.000000"
                            type="number"
                            min="0"
                            step="0.000001"
                            value={basisPrices.servicePrice}
                            onChange={(e) => setBasisPricesMap(prev => ({
                              ...prev,
                              [currentBasisId]: { ...basisPrices, servicePrice: e.target.value }
                            }))}
                            data-testid={`input-service-price-${index}`}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Стоимость ПВКЖ</label>
                          <Input
                            placeholder="0.000000"
                            type="number"
                            min="0"
                            step="0.000001"
                            value={basisPrices.pvkjPrice}
                            onChange={(e) => setBasisPricesMap(prev => ({
                              ...prev,
                              [currentBasisId]: { ...basisPrices, pvkjPrice: e.target.value }
                            }))}
                            data-testid={`input-pvkj-price-${index}`}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Агентские</label>
                          <Input
                            placeholder="0.000000"
                            type="number"
                            min="0"
                            step="0.000001"
                            value={basisPrices.agentFee}
                            onChange={(e) => setBasisPricesMap(prev => ({
                              ...prev,
                              [currentBasisId]: { ...basisPrices, agentFee: e.target.value }
                            }))}
                            data-testid={`input-agent-fee-${index}`}
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Прочие услуги</label>
                        <div className="flex gap-2">
                          <Select
                            value={basisPrices.otherServiceType || ""}
                            onValueChange={(val) => setBasisPricesMap(prev => ({
                              ...prev,
                              [currentBasisId]: { ...basisPrices, otherServiceType: val, otherServiceValue: "" }
                            }))}
                          >
                            <SelectTrigger className="w-48" data-testid={`select-other-service-type-${index}`}>
                              <SelectValue placeholder="Не указано" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="royalty_per_ton">Роялти с тонны</SelectItem>
                              <SelectItem value="percent_of_amount">Процент от суммы</SelectItem>
                              <SelectItem value="fixed">Фиксированная сумма</SelectItem>
                            </SelectContent>
                          </Select>
                          {basisPrices.otherServiceType && (
                            <Input
                              placeholder={
                                basisPrices.otherServiceType === "royalty_per_ton"
                                  ? "₽ / тонну"
                                  : basisPrices.otherServiceType === "percent_of_amount"
                                  ? "% от суммы"
                                  : "Фикс. сумма (₽)"
                              }
                              type="number"
                              min="0"
                              step="0.000001"
                              value={basisPrices.otherServiceValue}
                              onChange={(e) => setBasisPricesMap(prev => ({
                                ...prev,
                                [currentBasisId]: { ...basisPrices, otherServiceValue: e.target.value }
                              }))}
                              data-testid={`input-other-service-value-${index}`}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                );
              })}
              {form.formState.errors.baseIds &&
                !Array.isArray(form.formState.errors.baseIds) && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.baseIds.message}
                  </p>
                )}
            </div>

            <div className="flex gap-4 items-center">
              <FormField
                control={form.control}
                name="isIntermediary"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-is-intermediary"
                      />
                    </FormControl>
                    <FormLabel className="font-normal cursor-pointer text-sm">
                      Посредник
                    </FormLabel>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="isForeign"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-is-foreign"
                      />
                    </FormControl>
                    <FormLabel className="font-normal cursor-pointer text-sm">
                      Зарубеж
                    </FormLabel>
                  </FormItem>
                )}
              />
              {isForeign && (
                <FormField
                  control={form.control}
                  name="withVAT"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-with-vat"
                        />
                      </FormControl>
                      <FormLabel className="font-normal cursor-pointer text-sm">
                        с/без НДС
                      </FormLabel>
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Warehouse linking section */}
            <div className="space-y-3 border rounded-md p-3">
              <div className="flex items-center gap-2">
                <Warehouse className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Связанный склад</span>
              </div>
              <FormField
                control={form.control}
                name="warehouseLinkMode"
                render={({ field }) => (
                  <FormItem>
                    <Select
                      value={field.value}
                      onValueChange={(val) => {
                        field.onChange(val);
                        if (val === "create") {
                          const currentName = form.getValues("name");
                          form.setValue("newWarehouseName", currentName || "");
                        }
                      }}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-warehouse-link-mode">
                          <SelectValue placeholder="Выберите режим" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Без склада</SelectItem>
                        <SelectItem value="existing">Привязать существующий склад</SelectItem>
                        <SelectItem value="create">Создать новый склад</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {warehouseLinkMode === "existing" && (
                <FormField
                  control={form.control}
                  name="linkedWarehouseId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Склад</FormLabel>
                      <FormControl>
                        <Combobox
                          options={freeWarehouses.map((w) => ({
                            value: w.id,
                            label: w.name,
                          }))}
                          value={field.value || ""}
                          onValueChange={field.onChange}
                          placeholder="Выберите склад"
                          className="w-full"
                          dataTestId="select-linked-warehouse"
                        />
                      </FormControl>
                      <FormMessage />
                      {freeWarehouses.length === 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Нет свободных складов (все привязаны к другим поставщикам)
                        </p>
                      )}
                    </FormItem>
                  )}
                />
              )}

              {warehouseLinkMode === "create" && (
                <div className="space-y-3 bg-muted/30 rounded-md p-3">
                  <p className="text-xs text-muted-foreground font-medium">Данные нового склада</p>
                  <FormField
                    control={form.control}
                    name="newWarehouseName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Название склада</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Название склада"
                            data-testid="input-new-warehouse-name"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="newWarehouseStorageCost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Стоимость хранения (₽/т)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="0.000001"
                            placeholder="0.000000"
                            data-testid="input-new-warehouse-storage-cost"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <p className="text-xs text-muted-foreground">
                    Базисы нового склада будут совпадать с базисами поставщика.
                    Все остальные настройки можно изменить после создания.
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <FormField
                control={form.control}
                name="hasSpecialConditions"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-supplier-special-conditions"
                      />
                    </FormControl>
                    <FormLabel className="font-normal cursor-pointer text-sm">
                      Особые условия
                    </FormLabel>
                  </FormItem>
                )}
              />

              {hasSpecialConditions && (
                <div className="space-y-3 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-600 p-3">
                  <FormField
                    control={form.control}
                    name="specialConditions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Текст особых условий</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Введите особые условия или важную информацию по контрагенту..."
                            className="resize-none"
                            rows={3}
                            data-testid="input-supplier-special-conditions"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="specialConditionsExpiresAt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Действует до (необязательно)</FormLabel>
                        <FormControl>
                          <DateInput
                            value={field.value ?? undefined}
                            onChange={(d) => field.onChange(d ?? null)}
                            data-testid="input-supplier-special-conditions-expires"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Описание</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Дополнительная информация..."
                      className="resize-none"
                      data-testid="input-supplier-description"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Отмена
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                data-testid="button-save-supplier"
                onClick={(e) => e.stopPropagation()}
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Сохранение...
                  </>
                ) : editItem ? (
                  "Сохранить"
                ) : (
                  "Создать"
                )}
              </Button>
            </div>
          </form>
        </Form>

        <AddBaseDialog
          isInline
          inlineOpen={addBaseOpen}
          onInlineOpenChange={setAddBaseOpen}
        />
      </DialogContent>
    <ErrorModalComponent />
    </Dialog>
  );
}
