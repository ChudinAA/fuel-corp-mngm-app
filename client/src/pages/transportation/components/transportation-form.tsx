import {
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useRef,
} from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useErrorModal } from "@/hooks/use-error-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Combobox } from "@/components/ui/combobox";
import { BaseTypeBadge } from "@/components/base-type-badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Plus, Loader2 } from "lucide-react";
import type {
  Supplier,
  Base,
  Customer,
  DeliveryCost,
  LogisticsCarrier,
  LogisticsDeliveryLocation,
} from "@shared/schema";
import { PRODUCT_TYPE, COUNTERPARTY_TYPE } from "@shared/constants";
import { extractPriceIdsForSubmit } from "@/pages/shared/utils/price-utils";
import { useDuplicateCheck } from "@/pages/shared/hooks/use-duplicate-check";
import { DuplicateAlertDialog } from "@/pages/shared/components/duplicate-alert-dialog";
import { useTransportationFilters } from "../hooks/use-transportation-filters";
import { useTransportationCalculations } from "../hooks/use-transportation-calculations";
import {
  transportationFormSchema,
  type TransportationFormSchema,
} from "../schemas";
import {
  TRANSPORTATION_QUERY_KEY,
  AVIA_SERVICE_CARRIER_NAME,
} from "../constants";
import { AddCustomerDialog } from "@/pages/counterparties/customers-dialog";
import { AddSupplierDialog } from "@/pages/counterparties/suppliers-dialog";
import { AddLogisticsDialog } from "@/pages/directories/logistics-dialog";
import { AddDeliveryCostDialog } from "@/pages/delivery/components/delivery-cost-dialog";
import { AddPriceDialog } from "@/pages/prices/components/add-price-dialog";
import { CalculatedField } from "@/pages/opt/components/calculated-field";
import { formatCurrency, formatNumber } from "@/pages/opt/utils";
import { useAuth } from "@/hooks/use-auth";
import { CUSTOMER_MODULE } from "@shared/constants";
import { cn } from "@/lib/utils";

export interface TransportationFormHandle {
  getFormState: () => { supplierId: string; buyerId: string };
  saveAsDraft: () => Promise<void>;
  isDirty: () => boolean;
}

interface TransportationFormProps {
  onSuccess?: () => void;
  editData?: any | null;
}

export const TransportationForm = forwardRef<
  TransportationFormHandle,
  TransportationFormProps
>(({ onSuccess, editData }, ref) => {
  const { toast } = useToast();
  const { showError, ErrorModalComponent } = useErrorModal();
  const { hasPermission } = useAuth();
  const [inputMode, setInputMode] = useState<"liters" | "kg">("kg");
  const [selectedPurchasePriceId, setSelectedPurchasePriceId] =
    useState<string>("");
  const [selectedSalePriceId, setSelectedSalePriceId] = useState<string>("");
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [addSupplierOpen, setAddSupplierOpen] = useState(false);
  const [addCarrierOpen, setAddCarrierOpen] = useState(false);
  const [addLocationOpen, setAddLocationOpen] = useState(false);
  const [addCostOpen, setAddCostOpen] = useState(false);
  const [addPurchasePriceOpen, setAddPurchasePriceOpen] = useState(false);
  const [addSalePriceOpen, setAddSalePriceOpen] = useState(false);
  const isEditing = !!editData && !!editData.id;
  const initialValuesRef = useRef<TransportationFormSchema | null>(null);

  const form = useForm<TransportationFormSchema>({
    resolver: zodResolver(transportationFormSchema),
    defaultValues: {
      supplierId: "",
      buyerId: "",
      dealDate: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
      basisId: null,
      customerBasisId: null,
      productType: PRODUCT_TYPE.KEROSENE,
      quantityLiters: null,
      density: null,
      quantityKg: null,
      inputMode: "kg",
      purchasePriceId: null,
      purchasePriceIndex: 0,
      salePriceId: null,
      salePriceIndex: 0,
      carrierId: null,
      deliveryLocationId: null,
      notes: "",
      isDraft: false,
    },
  });

  useImperativeHandle(ref, () => ({
    getFormState: () => ({
      supplierId: form.getValues("supplierId") || "",
      buyerId: form.getValues("buyerId") || "",
    }),
    saveAsDraft: async () => {
      const values = form.getValues();
      if (editData?.id) {
        await updateMutation.mutateAsync({
          ...values,
          isDraft: true,
          id: editData.id,
        });
      } else {
        await createMutation.mutateAsync({ ...values, isDraft: true });
      }
    },
    isDirty: () => {
      if (!initialValuesRef.current) return form.formState.isDirty;
      return (
        JSON.stringify(form.getValues()) !==
        JSON.stringify(initialValuesRef.current)
      );
    },
  }));

  const { data: suppliers } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });
  const { data: allBases } = useQuery<Base[]>({ queryKey: ["/api/bases"] });
  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });
  const { data: carriers } = useQuery<LogisticsCarrier[]>({
    queryKey: ["/api/logistics/carriers"],
  });
  const { data: deliveryLocations } = useQuery<LogisticsDeliveryLocation[]>({
    queryKey: ["/api/logistics/delivery-locations"],
  });
  const { data: deliveryCosts } = useQuery<DeliveryCost[]>({
    queryKey: ["/api/delivery-costs"],
  });

  const watchSupplierId = form.watch("supplierId") || "";
  const watchBuyerId = form.watch("buyerId") || "";
  const watchDealDate = form.watch("dealDate");
  const watchBasisId = form.watch("basisId") || "";
  const watchCustomerBasisId = form.watch("customerBasisId") || "";
  const watchCarrierId = form.watch("carrierId") || "";
  const watchProductType = form.watch("productType") || PRODUCT_TYPE.KEROSENE;
  const watchQuantityLiters = form.watch("quantityLiters");
  const watchDensity = form.watch("density");
  const watchQuantityKg = form.watch("quantityKg");
  const watchFormInputMode = form.watch("inputMode") || "kg";

  const dealDateObj = watchDealDate ? new Date(watchDealDate) : null;

  const {
    purchasePrices,
    salePrices,
    allBases: availableBases,
    aviaServiceCarrier,
    isAviaService,
    carriers: availableCarriers,
    deliveryLocations: availableLocations,
  } = useTransportationFilters({
    supplierId: watchSupplierId,
    buyerId: watchBuyerId,
    dealDate: dealDateObj,
    basisId: watchBasisId,
    customerBasisId: watchCustomerBasisId,
    carrierId: watchCarrierId,
    productType: watchProductType,
    allBases,
    carriers,
    deliveryLocations,
    deliveryCosts,
  });

  const {
    calculatedKg,
    finalKg,
    purchasePrice,
    salePrice,
    deliveryCost,
    deliveryTariff,
    purchaseAmount,
    saleAmount,
    profit,
  } = useTransportationCalculations({
    inputMode: watchFormInputMode as "liters" | "kg",
    quantityLiters: watchQuantityLiters?.toString() || "",
    density: watchDensity?.toString() || "",
    quantityKg: watchQuantityKg?.toString() || "",
    basisId: watchBasisId,
    purchasePrices,
    salePrices,
    selectedPurchasePriceId,
    selectedSalePriceId,
    deliveryCosts,
    carrierId: watchCarrierId,
    deliveryLocationId: form.watch("deliveryLocationId") || "",
    isAviaService,
    productType: watchProductType,
  });

  const {
    showDuplicateDialog,
    setShowDuplicateDialog,
    checkDuplicate,
    handleConfirm,
    handleCancel,
    isChecking,
  } = useDuplicateCheck({
    type: "transportation",
    getFields: () => ({
      date: dealDateObj,
      supplierId: watchSupplierId,
      buyerId: watchBuyerId,
      productType: watchProductType,
      basisId: watchBasisId,
      customerBasisId: watchCustomerBasisId,
      deliveryLocationId: form.watch("deliveryLocationId") || null,
      quantityKg: calculatedKg ? parseFloat(calculatedKg) : 0,
    }),
  });

  // Auto-select АвиаСервис as default carrier on create
  useEffect(() => {
    if (!editData && aviaServiceCarrier && !watchCarrierId) {
      form.setValue("carrierId", aviaServiceCarrier.id, { shouldDirty: false });
    }
  }, [aviaServiceCarrier, editData]);

  // When switching to АвиаСервис, clear delivery location (irrelevant for АвиаСервис)
  // When switching away from АвиаСервис, clear purchase price (only applicable to АвиаСервис)
  const prevIsAviaServiceRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (prevIsAviaServiceRef.current === null) {
      // First render — just record the value, don't touch anything
      prevIsAviaServiceRef.current = isAviaService;
      return;
    }
    const changed = prevIsAviaServiceRef.current !== isAviaService;
    prevIsAviaServiceRef.current = isAviaService;
    if (!changed) return;

    if (isAviaService) {
      form.setValue("deliveryLocationId", null, { shouldDirty: false });
    } else {
      setSelectedPurchasePriceId("");
    }
  }, [isAviaService]);

  // Отслеживаем была ли уже инициализирована цена при редактировании
  const salePriceInitializedRef = useRef(false);

  // Автовыбор цены покупки: только для АвиаСервис, при создании
  useEffect(() => {
    if (
      !editData &&
      isAviaService &&
      purchasePrices.length > 0 &&
      !selectedPurchasePriceId
    ) {
      setSelectedPurchasePriceId(`${purchasePrices[0].id}-0`);
    }
  }, [isAviaService, purchasePrices, editData]);

  // Автовыбор цены продажи: при создании — первая доступная; при редактировании — из editData
  useEffect(() => {
    if (!editData) {
      // Создание: подставляем первую цену как только загрузится список
      if (watchBuyerId && salePrices.length > 0) {
        setSelectedSalePriceId((prev) => prev || `${salePrices[0].id}-0`);
      } else if (watchBuyerId && salePrices.length === 0) {
        setSelectedSalePriceId("");
      }
    } else {
      // Редактирование: когда salePrices загрузятся и ref не инициализирован — восстановить
      if (!salePriceInitializedRef.current && salePrices.length > 0) {
        const salePriceCompositeId =
          editData.salePriceId !== undefined && editData.salePriceId !== null
            ? editData.salePriceIndex !== undefined &&
              editData.salePriceIndex !== null
              ? `${editData.salePriceId}-${editData.salePriceIndex}`
              : editData.salePriceId
            : "";
        setSelectedSalePriceId(salePriceCompositeId);
        salePriceInitializedRef.current = true;
      }
    }
  }, [watchBuyerId, salePrices, editData]);

  // Load editData into form
  useEffect(() => {
    if (editData) {
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

      const resetValues: TransportationFormSchema = {
        supplierId: editData.supplierId || "",
        buyerId: editData.buyerId || "",
        dealDate: editData.dealDate
          ? format(editData.dealDate, "yyyy-MM-dd'T'HH:mm:ss")
          : format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
        basisId: editData.basisId || null,
        customerBasisId: editData.customerBasisId || null,
        productType: editData.productType || PRODUCT_TYPE.KEROSENE,
        quantityLiters: editData.quantityLiters
          ? parseFloat(editData.quantityLiters)
          : null,
        density: editData.density ? parseFloat(editData.density) : null,
        quantityKg: editData.quantityKg
          ? parseFloat(editData.quantityKg)
          : null,
        inputMode: editData.inputMode || "kg",
        purchasePriceId: purchasePriceCompositeId || null,
        purchasePriceIndex: editData.purchasePriceIndex || 0,
        salePriceId: salePriceCompositeId || null,
        salePriceIndex: editData.salePriceIndex || 0,
        carrierId: editData.carrierId || null,
        deliveryLocationId: editData.deliveryLocationId || null,
        notes: editData.notes || "",
        isDraft: editData.isDraft || false,
      };
      initialValuesRef.current = resetValues;
      form.reset(resetValues, { keepDefaultValues: false });
      setSelectedPurchasePriceId(purchasePriceCompositeId);
      setSelectedSalePriceId(salePriceCompositeId);
      if (editData.inputMode)
        setInputMode(editData.inputMode as "liters" | "kg");
    }
  }, [editData]);

  const buildPayload = (data: TransportationFormSchema, isDraft: boolean) => {
    const { purchasePriceId, purchasePriceIndex, salePriceId, salePriceIndex } =
      extractPriceIdsForSubmit(
        selectedPurchasePriceId,
        selectedSalePriceId,
        purchasePrices,
        salePrices,
        false,
      );
    return {
      supplierId: data.supplierId,
      buyerId: data.buyerId,
      dealDate: data.dealDate
        ? format(data.dealDate, "yyyy-MM-dd'T'HH:mm:ss")
        : null,
      basisId: data.basisId || null,
      customerBasisId: data.customerBasisId || null,
      productType: data.productType,
      quantityKg: calculatedKg ? parseFloat(calculatedKg) : null,
      quantityLiters: data.quantityLiters || null,
      density: data.density || null,
      inputMode: data.inputMode,
      purchasePrice: purchasePrice !== null ? purchasePrice : null,
      purchasePriceId: purchasePriceId || null,
      purchasePriceIndex:
        purchasePriceIndex !== undefined ? purchasePriceIndex : null,
      salePrice: salePrice !== null ? salePrice : null,
      salePriceId: salePriceId || null,
      salePriceIndex: salePriceIndex !== undefined ? salePriceIndex : null,
      purchaseAmount: purchaseAmount !== null ? purchaseAmount : null,
      saleAmount: saleAmount !== null ? saleAmount : null,
      carrierId: data.carrierId || null,
      deliveryLocationId: data.deliveryLocationId || null,
      deliveryCost: deliveryCost !== null ? deliveryCost : null,
      deliveryTariff: deliveryTariff !== null ? deliveryTariff : null,
      profit: profit !== null ? profit : null,
      notes: data.notes || null,
      isDraft,
    };
  };

  const createMutation = useMutation({
    mutationFn: async (
      data: TransportationFormSchema & { isDraft?: boolean },
    ) => {
      const isDraft = data.isDraft ?? false;
      const payload = buildPayload(data, isDraft);
      const res = await apiRequest("POST", "/api/transportation", payload);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Ошибка создания сделки");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TRANSPORTATION_QUERY_KEY] });
      toast({
        title: "Сделка создана",
        description: "Перевозка успешно сохранена",
      });
      onSuccess?.();
    },
    onError: (e: Error) => showError(e, "transportation"),
  });

  const updateMutation = useMutation({
    mutationFn: async (
      data: TransportationFormSchema & { id: string; isDraft?: boolean },
    ) => {
      const { id, isDraft = false, ...rest } = data;
      const payload = buildPayload(rest as TransportationFormSchema, isDraft);
      const res = await apiRequest(
        "PATCH",
        `/api/transportation/${id}`,
        payload,
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Ошибка обновления сделки");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TRANSPORTATION_QUERY_KEY] });
      toast({
        title: "Сделка обновлена",
        description: "Перевозка успешно обновлена",
      });
      onSuccess?.();
    },
    onError: (e: Error) => showError(e, "transportation"),
  });

  const onSubmit = async (
    data: TransportationFormSchema,
    isDraftSubmit?: boolean,
  ) => {
    const isDraft = isDraftSubmit ?? data.isDraft ?? false;

    if (!isDraft) {
      const kgVal = calculatedKg ? parseFloat(calculatedKg) : 0;
      if (kgVal <= 0) {
        toast({
          title: "Ошибка",
          description: "Укажите корректное количество топлива",
          variant: "destructive",
        });
        return;
      }
      if (salePrice === null) {
        toast({
          title: "Ошибка",
          description: "Не указана цена продажи",
          variant: "destructive",
        });
        return;
      }
    }

    if (isEditing) {
      updateMutation.mutate({ ...data, isDraft, id: editData.id });
    } else {
      checkDuplicate(() => createMutation.mutate({ ...data, isDraft }));
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const formatPriceOption = (p: any) => {
    const priceValues = Array.isArray(p.priceValues) ? p.priceValues : [];
    return priceValues
      .map((pv: any, idx: number) => {
        const parsed = typeof pv === "string" ? JSON.parse(pv) : pv;
        const val = parseFloat(parsed?.price || "0");
        return { value: `${p.id}-${idx}`, label: `${formatNumber(val)} ₽/кг` };
      })
      .flat();
  };

  return (
    <>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((data) => onSubmit(data, false))}
          className="space-y-6"
        >
          {/* Main fields */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Основные данные</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                <FormField
                  control={form.control}
                  name="dealDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Дата сделки</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className="w-full justify-start text-left font-normal"
                              data-testid="input-deal-date"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value
                                ? format(new Date(field.value), "dd.MM.yyyy", {
                                    locale: ru,
                                  })
                                : "Выберите дату"}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={
                              field.value ? new Date(field.value) : undefined
                            }
                            onSelect={(date) => {
                              if (date) {
                                const now = new Date();
                                const combined = new Date(
                                  date.getFullYear(),
                                  date.getMonth(),
                                  date.getDate(),
                                  now.getHours(),
                                  now.getMinutes(),
                                  now.getSeconds(),
                                );
                                field.onChange(
                                  format(combined, "yyyy-MM-dd'T'HH:mm:ss"),
                                );
                              } else {
                                field.onChange("");
                              }
                            }}
                            locale={ru}
                          />
                        </PopoverContent>
                      </Popover>
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
                        value={field.value || ""}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-product-type">
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

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="supplierId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Поставщик</FormLabel>
                      <div className="flex gap-1 items-center">
                        <FormControl>
                          <Combobox
                            options={
                              suppliers?.map((s) => ({
                                value: s.id,
                                label: s.name,
                              })) || []
                            }
                            value={field.value || ""}
                            onValueChange={field.onChange}
                            placeholder="Выберите поставщика"
                            className="w-full"
                            dataTestId="select-supplier"
                          />
                        </FormControl>
                        {hasPermission("directories", "create") && (
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            onClick={() => setAddSupplierOpen(true)}
                            data-testid="button-add-supplier"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="buyerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Покупатель</FormLabel>
                      <div className="flex gap-1 items-center">
                        <FormControl>
                          <Combobox
                            options={
                              customers?.map((c) => ({
                                value: c.id,
                                label: c.name,
                              })) || []
                            }
                            value={field.value || ""}
                            onValueChange={field.onChange}
                            placeholder="Выберите покупателя"
                            className="w-full"
                            dataTestId="select-buyer"
                          />
                        </FormControl>
                        {hasPermission("directories", "create") && (
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            onClick={() => setAddCustomerOpen(true)}
                            data-testid="button-add-buyer"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="basisId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Базис погрузки</FormLabel>
                      <FormControl>
                        <Combobox
                          options={availableBases.map((b) => ({
                            value: b.id,
                            label: b.name,
                            render: (
                              <div className="flex items-center gap-2">
                                {b.name}
                                <BaseTypeBadge type={b.baseType} short={true} />
                              </div>
                            ),
                          }))}
                          value={field.value || ""}
                          onValueChange={field.onChange}
                          placeholder="Выберите базис погрузки"
                          className="w-full"
                          dataTestId="select-basis"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="customerBasisId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Базис доставки</FormLabel>
                      <FormControl>
                        <Combobox
                          options={availableBases.map((b) => ({
                            value: b.id,
                            label: b.name,
                            render: (
                              <div className="flex items-center gap-2">
                                {b.name}
                                <BaseTypeBadge type={b.baseType} short={true} />
                              </div>
                            ),
                          }))}
                          value={field.value || ""}
                          onValueChange={field.onChange}
                          placeholder="Выберите базис доставки"
                          className="w-full"
                          dataTestId="select-customer-basis"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Volume section */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between gap-4">
                <CardTitle className="text-lg">Объем топлива</CardTitle>
                <FormField
                  control={form.control}
                  name="inputMode"
                  render={({ field }) => (
                    <div className="flex items-center gap-2">
                      <Label className="text-sm text-muted-foreground">
                        Литры/Плотность
                      </Label>
                      <Switch
                        checked={field.value === "kg"}
                        onCheckedChange={(checked) => {
                          const mode = checked ? "kg" : "liters";
                          field.onChange(mode);
                          setInputMode(mode);
                        }}
                        data-testid="switch-input-mode"
                      />
                      <Label className="text-sm text-muted-foreground">
                        КГ
                      </Label>
                    </div>
                  )}
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <FormField
                  control={form.control}
                  name="quantityLiters"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Литры</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          data-testid="input-liters"
                          disabled={watchFormInputMode === "kg"}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value
                                ? parseFloat(e.target.value)
                                : null,
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="density"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Плотность</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="0.0001"
                          placeholder="0.8000"
                          data-testid="input-density"
                          disabled={watchFormInputMode === "kg"}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value
                                ? parseFloat(e.target.value)
                                : null,
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="quantityKg"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Кг</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          data-testid="input-kg"
                          disabled={watchFormInputMode === "liters"}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value
                                ? parseFloat(e.target.value)
                                : null,
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              {watchFormInputMode === "liters" && calculatedKg && (
                <p className="text-sm text-muted-foreground mt-2">
                  Расчетный вес:{" "}
                  <strong>{formatNumber(parseFloat(calculatedKg))} кг</strong>
                </p>
              )}
            </CardContent>
          </Card>

          {/* Logistics section */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Логистика</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="carrierId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Перевозчик</FormLabel>
                      <div className="flex gap-1 items-center">
                        <FormControl>
                          <Combobox
                            options={availableCarriers.map((c) => ({
                              value: c.id,
                              label: c.name,
                            }))}
                            value={field.value || ""}
                            onValueChange={field.onChange}
                            placeholder="Выберите перевозчика"
                            className="w-full"
                            dataTestId="select-carrier"
                          />
                        </FormControl>
                        {hasPermission("directories", "create") && (
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            onClick={() => setAddCarrierOpen(true)}
                            data-testid="button-add-carrier"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="deliveryLocationId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Пункт доставки</FormLabel>
                      <div className="flex gap-1 items-center">
                        <FormControl>
                          <Combobox
                            options={availableLocations.map((l) => ({
                              value: l.id,
                              label: l.name,
                            }))}
                            value={field.value || ""}
                            onValueChange={field.onChange}
                            placeholder="Выберите пункт доставки"
                            className="w-full"
                            dataTestId="select-delivery-location"
                          />
                        </FormControl>
                        {hasPermission("directories", "create") && (
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            onClick={() => setAddLocationOpen(true)}
                            data-testid="button-add-location"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {!isAviaService && (
                <div className="flex gap-2">
                  {hasPermission("directories", "create") && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setAddCostOpen(true)}
                      data-testid="button-add-delivery-cost"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Добавить тариф
                    </Button>
                  )}
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <CalculatedField
                  label="Тариф (₽/кг)"
                  value={
                    deliveryTariff !== null ? formatNumber(deliveryTariff) : "—"
                  }
                />
                <CalculatedField
                  label="Стоимость доставки (₽)"
                  value={
                    deliveryCost !== null ? formatCurrency(deliveryCost) : "—"
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Pricing section */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Ценообразование</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <Label>Цена покупки</Label>
                    {isAviaService && hasPermission("prices", "create") && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => setAddPurchasePriceOpen(true)}
                        data-testid="button-add-purchase-price"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {isAviaService ? (
                    <Select
                      value={selectedPurchasePriceId}
                      onValueChange={setSelectedPurchasePriceId}
                    >
                      <SelectTrigger data-testid="select-purchase-price">
                        <SelectValue placeholder="Выберите цену покупки" />
                      </SelectTrigger>
                      <SelectContent>
                        {purchasePrices
                          .flatMap((p) => formatPriceOption(p))
                          .map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <CalculatedField
                      label="Перевозчик не АвиаСервис"
                      value={"0"}
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <Label>Цена продажи</Label>
                    {hasPermission("prices", "create") && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => setAddSalePriceOpen(true)}
                        data-testid="button-add-sale-price"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <Select
                    value={selectedSalePriceId}
                    onValueChange={setSelectedSalePriceId}
                  >
                    <SelectTrigger data-testid="select-sale-price">
                      <SelectValue placeholder="Выберите цену продажи" />
                    </SelectTrigger>
                    <SelectContent>
                      {salePrices
                        .flatMap((p) => formatPriceOption(p))
                        .map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <CalculatedField
                  label="Сумма закупки"
                  value={
                    purchaseAmount !== null
                      ? formatCurrency(purchaseAmount)
                      : !isAviaService
                        ? "0"
                        : "—"
                  }
                />
                <CalculatedField
                  label="Сумма продажи"
                  value={saleAmount !== null ? formatCurrency(saleAmount) : "—"}
                />
                <div
                  className={
                    profit !== null
                      ? profit >= 0
                        ? "text-green-600"
                        : "text-red-600"
                      : ""
                  }
                >
                  <CalculatedField
                    label="Прибыль"
                    value={profit !== null ? formatCurrency(profit) : "—"}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Примечание</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Дополнительная информация"
                    data-testid="input-notes"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                form.reset();
                onSuccess?.();
              }}
              disabled={isPending}
              data-testid="button-cancel"
            >
              {editData ? "Отмена" : "Очистить"}
            </Button>

            {(!isEditing || (editData && editData.isDraft)) && (
              <Button
                type="button"
                variant="secondary"
                disabled={isPending}
                data-testid="button-save-draft"
                onClick={() => {
                  form.clearErrors();
                  form.handleSubmit((data) => onSubmit(data, true))();
                }}
              >
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Сохранить черновик
              </Button>
            )}

            <Button
              type="submit"
              disabled={isPending}
              data-testid="button-submit"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEditing ? "Сохранение..." : "Создание..."}
                </>
              ) : isEditing && !editData?.isDraft ? (
                "Сохранить изменения"
              ) : (
                "Создать сделку"
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
      />

      <AddCustomerDialog
        bases={allBases}
        isInline
        inlineOpen={addCustomerOpen}
        onInlineOpenChange={setAddCustomerOpen}
        onCreated={(id) => form.setValue("buyerId", id)}
      />
      <AddSupplierDialog
        bases={allBases || []}
        isInline
        inlineOpen={addSupplierOpen}
        onInlineOpenChange={setAddSupplierOpen}
        onCreated={(id) => form.setValue("supplierId", id)}
      />
      <AddLogisticsDialog
        carriers={carriers || []}
        isInline
        inlineOpen={addCarrierOpen}
        onInlineOpenChange={setAddCarrierOpen}
        onCreated={(id) => form.setValue("carrierId", id)}
        defaultType="carrier"
      />
      <AddLogisticsDialog
        carriers={carriers || []}
        isInline
        inlineOpen={addLocationOpen}
        onInlineOpenChange={setAddLocationOpen}
        onCreated={(id) => form.setValue("deliveryLocationId", id)}
        defaultType="delivery_location"
      />

      {addCostOpen && (
        <AddDeliveryCostDialog
          editDeliveryCost={null}
          isInline
          inlineOpen={addCostOpen}
          onInlineOpenChange={setAddCostOpen}
        />
      )}
      {addPurchasePriceOpen && (
        <AddPriceDialog
          isInline
          inlineOpen={addPurchasePriceOpen}
          onInlineOpenChange={setAddPurchasePriceOpen}
          onCreated={(id) => {
            queryClient.invalidateQueries({ queryKey: ["/api/prices"] });
          }}
        />
      )}
      {addSalePriceOpen && (
        <AddPriceDialog
          isInline
          inlineOpen={addSalePriceOpen}
          onInlineOpenChange={setAddSalePriceOpen}
          onCreated={(id) => {
            queryClient.invalidateQueries({ queryKey: ["/api/prices"] });
          }}
        />
      )}
      <ErrorModalComponent />
    </>
  );
});

TransportationForm.displayName = "TransportationForm";
