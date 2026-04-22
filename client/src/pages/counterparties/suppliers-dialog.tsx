import { Combobox } from "@/components/ui/combobox";
import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
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
import { Plus, Loader2, X, CalendarIcon } from "lucide-react";
import type { Supplier, Base } from "@shared/schema";
import { BaseTypeBadge } from "@/components/base-type-badge";
import { useAuth } from "@/hooks/use-auth";
import { AddBaseDialog } from "../directories/bases-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";

const supplierFormSchema = z.object({
  name: z.string().min(1, "Укажите название"),
  fullName: z.string().optional(),
  inn: z.string().optional(),
  iata: z.string().optional(),
  supplyNomenclature: z.string().optional(),
  description: z.string().optional(),
  baseIds: z
    .array(z.string().min(1, "Выберите базис"))
    .min(1, "Добавьте хотя бы один базис"),
  isWarehouse: z.boolean().default(false),
  storageCost: z.coerce.number().optional(),
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
  const [basisPricesMap, setBasisPricesMap] = useState<Record<string, BasisPriceEntry>>({});

  const open = isInline ? inlineOpen : localOpen;
  const setOpen = isInline ? onInlineOpenChange || setLocalOpen : setLocalOpen;

  const form = useForm<SupplierFormData>({
    resolver: zodResolver(supplierFormSchema),
    defaultValues: {
      name: "",
      fullName: "",
      inn: "",
      iata: "",
      supplyNomenclature: "",
      description: "",
      baseIds: [""],
      isWarehouse: false,
      storageCost: undefined,
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

  // Ensure at least one field is always present
  useEffect(() => {
    if (fields.length === 0) {
      append("");
    }
  }, [fields.length, append]);

  const isWarehouse = form.watch("isWarehouse");
  const isForeign = form.watch("isForeign");
  const hasSpecialConditions = form.watch("hasSpecialConditions");

  const createMutation = useMutation({
    mutationFn: async (data: SupplierFormData) => {
      const endpoint = editItem
        ? `/api/suppliers/${editItem.id}`
        : "/api/suppliers";
      const filteredBaseIds = data.baseIds.filter(
        (id) => id && id.trim() !== "",
      );
      const basisPricesArray = filteredBaseIds.map((basisId) => {
        const entry = basisPricesMap[basisId] || { servicePrice: "", pvkjPrice: "", agentFee: "" };
        return {
          basisId,
          servicePrice: entry.servicePrice ? entry.servicePrice : null,
          pvkjPrice: entry.pvkjPrice ? entry.pvkjPrice : null,
          agentFee: entry.agentFee ? entry.agentFee : null,
        };
      });

      const payload = {
        name: data.name,
        fullName: data.fullName || null,
        inn: data.inn || null,
        iata: data.iata || null,
        supplyNomenclature: data.supplyNomenclature || null,
        description: data.description,
        baseIds: filteredBaseIds.length > 0 ? filteredBaseIds : null,
        basisPrices: basisPricesArray,
        isWarehouse: data.isWarehouse,
        storageCost:
          data.isWarehouse && data.storageCost
            ? String(data.storageCost)
            : null,
        hasSpecialConditions: data.hasSpecialConditions,
        specialConditions: data.hasSpecialConditions ? (data.specialConditions || null) : null,
        specialConditionsExpiresAt: data.hasSpecialConditions && data.specialConditionsExpiresAt
          ? format(data.specialConditionsExpiresAt, "yyyy-MM-dd")
          : null,
        isIntermediary: data.isIntermediary,
        isForeign: data.isForeign,
        withVAT: data.isForeign ? data.withVAT : false,
        isActive: data.isActive,
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
        inn: "",
        iata: "",
        supplyNomenclature: "",
        description: "",
        baseIds: [""],
        isWarehouse: false,
        storageCost: undefined,
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
      form.reset({
        name: editItem.name,
        fullName: editItem.fullName || "",
        inn: editItem.inn || "",
        iata: editItem.iata || "",
        supplyNomenclature: editItem.supplyNomenclature || "",
        description: editItem.description || "",
        baseIds: baseIdsArray,
        isWarehouse: editItem.isWarehouse || false,
        storageCost: editItem.storageCost
          ? parseFloat(editItem.storageCost)
          : undefined,
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
      // Load per-basis prices from editItem
      const pricesMap: Record<string, BasisPriceEntry> = {};
      if (editItem.basisPrices && Array.isArray(editItem.basisPrices)) {
        editItem.basisPrices.forEach((bp: { basisId: string; servicePrice?: string | null; pvkjPrice?: string | null; agentFee?: string | null }) => {
          pricesMap[bp.basisId] = {
            servicePrice: bp.servicePrice || "",
            pvkjPrice: bp.pvkjPrice || "",
            agentFee: bp.agentFee || "",
          };
        });
      }
      setBasisPricesMap(pricesMap);
    }
  }, [editItem, form]);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      form.reset({
        name: "",
        fullName: "",
        inn: "",
        iata: "",
        supplyNomenclature: "",
        description: "",
        baseIds: [""],
        isWarehouse: false,
        storageCost: undefined,
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
                      placeholder="ИНН поставщика"
                      data-testid="input-supplier-inn"
                      {...field}
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
                    onClick={() => append("")}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {fields.map((field, index) => {
                const currentBasisId = form.watch(`baseIds.${index}`) || "";
                const basisPrices = basisPricesMap[currentBasisId] || { servicePrice: "", pvkjPrice: "", agentFee: "" };
                return (
                <div key={field.id} className="border rounded-md p-3 space-y-2">
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
                        <label className="text-xs text-muted-foreground">Агентские/прочие</label>
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

            <FormField
              control={form.control}
              name="isWarehouse"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-is-warehouse"
                    />
                  </FormControl>
                  <FormLabel className="font-normal cursor-pointer">
                    Этот поставщик является складом
                  </FormLabel>
                </FormItem>
              )}
            />

            {isWarehouse && (
              <FormField
                control={form.control}
                name="storageCost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Стоимость хранения на складе (₽)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        data-testid="input-storage-cost"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

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
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className="w-full justify-start text-left font-normal"
                                data-testid="input-supplier-special-conditions-expires"
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value
                                  ? format(field.value, "dd.MM.yyyy", { locale: ru })
                                  : "Без срока действия"}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value ?? undefined}
                              onSelect={(date) => field.onChange(date ?? null)}
                              locale={ru}
                            />
                            {field.value && (
                              <div className="p-2 border-t">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="w-full"
                                  onClick={() => field.onChange(null)}
                                >
                                  Сбросить дату
                                </Button>
                              </div>
                            )}
                          </PopoverContent>
                        </Popover>
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

            {/* <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-supplier-active"
                    />
                  </FormControl>
                  <FormLabel className="font-normal cursor-pointer">
                    Активен
                  </FormLabel>
                </FormItem>
              )}
            /> */}

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