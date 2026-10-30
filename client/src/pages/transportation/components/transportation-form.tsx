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
import { DeliveryContractHint } from "@/pages/shared/components/delivery-contract-hint";
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
import { DateInput } from "@/components/ui/date-input";
import { Plus, Loader2 } from "lucide-react";
import type {
  Base,
  Customer,
  LogisticsCarrier,
  LogisticsDeliveryLocation,
} from "@shared/schema";
import type { DeliveryCostApiRecord } from "@/pages/delivery/types";
import { PRODUCT_TYPE } from "@shared/constants";
import { extractPriceIdsForSubmit } from "@/pages/shared/utils/price-utils";
import { useDuplicateCheck } from "@/pages/shared/hooks/use-duplicate-check";
import { DuplicateAlertDialog } from "@/pages/shared/components/duplicate-alert-dialog";
import { ContractHint, getSelectedPriceContract } from "@/pages/shared/components/contract-hint";
import { getReadableZodError } from "@/lib/form-errors";
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
import { AddLogisticsDialog } from "@/pages/directories/logistics-dialog";
import { AddDeliveryCostDialog } from "@/pages/delivery/components/delivery-cost-dialog";
import { AddPriceDialog } from "@/pages/prices/components/add-price-dialog";
import { AddBaseDialog } from "@/pages/directories/bases-dialog";
import { CalculatedField } from "@/pages/opt/components/calculated-field";
import { formatCurrency, formatPrice } from "@/pages/opt/utils";
import { formatPricePerTonne, formatTonnes } from "@shared/units";
import {
  calculateTransportationMassTonnes,
  formatTransportationPriceOption,
  type TransportationPriceUnit,
} from "../unit-calculations";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { NomenclatureField } from "@/pages/shared/components/nomenclature-field";
import { getPriceRateOptions } from "@/pages/shared/utils/price-rate";

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
  const [selectedSalePriceId, setSelectedSalePriceId] = useState<string>("");
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [addCarrierOpen, setAddCarrierOpen] = useState(false);
  const [addLocationOpen, setAddLocationOpen] = useState(false);
  const [addCostOpen, setAddCostOpen] = useState(false);
  const [addSalePriceOpen, setAddSalePriceOpen] = useState(false);
  const [addLoadingBasisOpen, setAddLoadingBasisOpen] = useState(false);
  const [addDeliveryBasisOpen, setAddDeliveryBasisOpen] = useState(false);
  const isEditing = !!editData && !!editData.id;
  const initialValuesRef = useRef<TransportationFormSchema | null>(null);

  const form = useForm<TransportationFormSchema>({
    resolver: zodResolver(transportationFormSchema),
    defaultValues: {
      supplierId: null,
      buyerId: "",
      dealDate: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
      basisId: null,
      customerBasisId: null,
      productType: PRODUCT_TYPE.KEROSENE,
      nomenclatureId: "",
      quantityLiters: null,
      density: null,
      quantityTonnes: null,
      inputMode: "tonnes",
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
  const { data: deliveryCosts } = useQuery<DeliveryCostApiRecord[]>({
    queryKey: ["/api/delivery-costs"],
  });

  const watchBuyerId = form.watch("buyerId") || "";
  const watchDealDate = form.watch("dealDate");
  const watchBasisId = form.watch("basisId") || "";
  const watchCustomerBasisId = form.watch("customerBasisId") || "";
  const watchCarrierId = form.watch("carrierId") || "";
  const watchProductType = form.watch("productType") || PRODUCT_TYPE.KEROSENE;
  const watchNomenclatureId = form.watch("nomenclatureId") || "";
  const watchQuantityLiters = form.watch("quantityLiters");
  const watchDensity = form.watch("density");
  const watchQuantityTonnes = form.watch("quantityTonnes");
  const watchFormInputMode = form.watch("inputMode") || "tonnes";

  const dealDateObj = watchDealDate ? new Date(watchDealDate) : null;

  const {
    salePrices,
    allBases: availableBases,
    aviaServiceCarrier,
    isAviaService,
    carriers: availableCarriers,
    deliveryLocations: availableLocations,
  } = useTransportationFilters({
    supplierId: "",
    buyerId: watchBuyerId,
    dealDate: dealDateObj,
    basisId: watchBasisId,
    customerBasisId: watchCustomerBasisId,
    carrierId: watchCarrierId,
    productType: watchProductType,
    nomenclatureId: watchNomenclatureId || undefined,
    allBases,
    carriers,
    deliveryLocations,
    deliveryCosts,
    inputMode: watchFormInputMode,
  });

  const {
    finalTonnes,
    salePrice,
    salePricePerTonne,
    deliveryCost,
    matchedDeliveryCost,
    deliveryTariffPerTonne,
    saleAmount,
    profit: calculatedProfit,
  } = useTransportationCalculations({
    inputMode: watchFormInputMode as "liters" | "tonnes",
    quantityLiters: watchQuantityLiters?.toString() || "",
    density: watchDensity?.toString() || "",
    quantityTonnes: watchQuantityTonnes?.toString() || "",
    basisId: watchBasisId,
    purchasePrices: [],
    salePrices,
    selectedPurchasePriceId: "",
    selectedSalePriceId,
    deliveryCosts,
    carrierId: watchCarrierId,
    deliveryLocationId: form.watch("deliveryLocationId") || "",
    isAviaService,
    productType: watchProductType,
  });

  // Для АвиаСервис прибыль = сумма услуги (нет внешних затрат на доставку)
  const profit = isAviaService ? saleAmount : calculatedProfit;

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
      supplierId: form.watch("supplierId") || "",
      buyerId: watchBuyerId,
      productType: watchProductType,
      basisId: watchBasisId,
      customerBasisId: watchCustomerBasisId,
      deliveryLocationId: form.watch("deliveryLocationId") || null,
      quantityTonnes: finalTonnes ?? 0,
    }),
  });

  // Auto-select АвиаСервис as default carrier on create
  useEffect(() => {
    if (!editData && aviaServiceCarrier && !watchCarrierId) {
      form.setValue("carrierId", aviaServiceCarrier.id, { shouldDirty: false });
    }
  }, [aviaServiceCarrier, editData]);

  // When switching away from АвиаСервис, clear delivery location (irrelevant for АвиаСервис)
  const prevIsAviaServiceRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (prevIsAviaServiceRef.current === null) {
      prevIsAviaServiceRef.current = isAviaService;
      return;
    }
    const changed = prevIsAviaServiceRef.current !== isAviaService;
    prevIsAviaServiceRef.current = isAviaService;
    if (!changed) return;

    if (isAviaService) {
      form.setValue("deliveryLocationId", null, { shouldDirty: false });
    }
  }, [isAviaService]);

  // Отслеживаем была ли уже инициализирована цена при редактировании
  const salePriceInitializedRef = useRef(false);

  // Автовыбор цены услуги: при создании — первая доступная; при редактировании — из editData
  useEffect(() => {
    if (!editData) {
      if (watchBuyerId && salePrices.length > 0) {
        setSelectedSalePriceId((prev) => prev || `${salePrices[0].id}-0`);
      } else if (watchBuyerId && salePrices.length === 0) {
        setSelectedSalePriceId("");
      }
    } else {
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

  // Авто-подставление пункта доставки при смене базиса доставки (не в режиме редактирования)
  const prevCustomerBasisIdRef = useRef<string>("");
  useEffect(() => {
    if (editData) return;
    if (!watchCustomerBasisId) return;
    if (prevCustomerBasisIdRef.current === watchCustomerBasisId) return;
    prevCustomerBasisIdRef.current = watchCustomerBasisId;

    if (availableLocations.length > 0) {
      form.setValue("deliveryLocationId", availableLocations[0].id, {
        shouldDirty: true,
      });
    } else {
      form.setValue("deliveryLocationId", null, { shouldDirty: true });
    }
  }, [watchCustomerBasisId, availableLocations, editData]);

  // Load editData into form
  useEffect(() => {
    if (editData) {
      const salePriceCompositeId =
        editData.salePriceId &&
        editData.salePriceIndex !== undefined &&
        editData.salePriceIndex !== null
          ? `${editData.salePriceId}-${editData.salePriceIndex}`
          : editData.salePriceId || "";

      const resetValues: TransportationFormSchema = {
        supplierId: editData.supplierId || null,
        buyerId: editData.buyerId || "",
        dealDate: editData.dealDate
          ? format(editData.dealDate, "yyyy-MM-dd'T'HH:mm:ss")
          : format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
        basisId: editData.basisId || null,
        customerBasisId: editData.customerBasisId || null,
        productType: editData.productType || PRODUCT_TYPE.KEROSENE,
        nomenclatureId: editData.nomenclatureId || "",
        quantityLiters: editData.quantityLiters
          ? parseFloat(editData.quantityLiters)
          : null,
        density: editData.density ? parseFloat(editData.density) : null,
        quantityTonnes:
          editData.quantityTonnes !== null &&
          editData.quantityTonnes !== undefined
            ? Number(editData.quantityTonnes)
            : null,
        inputMode:
          editData.inputMode === "liters" ||
          Number.parseFloat(editData.quantityLiters || "0") > 0
            ? "liters"
            : "tonnes",
        purchasePriceId: null,
        purchasePriceIndex: 0,
        salePriceId: salePriceCompositeId || null,
        salePriceIndex: editData.salePriceIndex || 0,
        carrierId: editData.carrierId || null,
        deliveryLocationId: editData.deliveryLocationId || null,
        notes: editData.notes || "",
        isDraft: editData.isDraft || false,
      };
      initialValuesRef.current = resetValues;
      form.reset(resetValues, { keepDefaultValues: false });
      setSelectedSalePriceId(salePriceCompositeId);
    }
  }, [editData]);

  const buildPayload = (data: TransportationFormSchema, isDraft: boolean) => {
    const { salePriceId, salePriceIndex } = extractPriceIdsForSubmit(
      "",
      selectedSalePriceId,
      [],
      salePrices,
      false,
    );
    return {
      supplierId: data.supplierId || null,
      buyerId: data.buyerId || null,
      dealDate: data.dealDate
        ? format(data.dealDate, "yyyy-MM-dd'T'HH:mm:ss")
        : null,
      basisId: data.basisId || null,
      customerBasisId: data.customerBasisId || null,
      productType: data.productType || PRODUCT_TYPE.KEROSENE,
      nomenclatureId: data.nomenclatureId || null,
      contractNumber: salePrices.find((price) => price.id === salePriceId)?.contractNumber || null,
      quantityTonnes: finalTonnes,
      quantityLiters: data.quantityLiters || null,
      density: data.density || null,
      inputMode: data.inputMode,
      purchasePriceId: null,
      purchasePriceIndex: null,
      salePricePerTonne:
        salePricePerTonne !== null ? salePricePerTonne : null,
      salePriceId: salePriceId || null,
      salePriceIndex: salePriceIndex !== undefined ? salePriceIndex : null,
      purchaseAmount: null,
      saleAmount: saleAmount !== null ? saleAmount : null,
      carrierId: data.carrierId || null,
      deliveryLocationId: data.deliveryLocationId || null,
      deliveryCost: deliveryCost !== null ? deliveryCost : null,
      deliveryTariffPerTonne:
        deliveryTariffPerTonne !== null ? deliveryTariffPerTonne : null,
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
      const tonnesValue = finalTonnes ?? 0;
      if (tonnesValue <= 0) {
        showError("Укажите корректное количество топлива");
        return;
      }
      if (salePrice === null) {
        showError("Не указана цена услуги");
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
    return getPriceRateOptions(p).flatMap(({ value, unit }, idx) => {
      if (value === null) return [];
      const priceUnit: TransportationPriceUnit = unit;
        return {
          value: `${p.id}-${idx}`,
          label: formatTransportationPriceOption(
            value,
            priceUnit,
            watchDensity?.toString(),
          ),
        };
    });
  };

  return (
    <>
      <Form {...form}>
          <form
          onSubmit={form.handleSubmit(
            (data) => onSubmit(data, false),
            (errors) => {
              showError(
                getReadableZodError(
                  errors,
                  "Заполните все обязательные поля перед созданием сделки.",
                ),
              );
            },
          )}
            className="space-y-6"
        >
          {/* Main fields */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Основные данные</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <FormField
                  control={form.control}
                  name="dealDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Дата сделки</FormLabel>
                      <FormControl>
                        <DateInput
                          value={field.value ? new Date(field.value) : undefined}
                          onChange={(d) => field.onChange(d ? format(d, "yyyy-MM-dd'T'HH:mm:ss") : "")}
                          data-testid="input-deal-date"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="buyerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Заказчик</FormLabel>
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
                            placeholder="Выберите заказчика"
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

                <FormField control={form.control} name="productType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Тип продукта</FormLabel>
                    <Select value={field.value || PRODUCT_TYPE.KEROSENE} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger data-testid="select-transportation-product"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value={PRODUCT_TYPE.KEROSENE}>Керосин</SelectItem>
                        <SelectItem value={PRODUCT_TYPE.PVKJ}>ПВКЖ</SelectItem>
                        <SelectItem value={PRODUCT_TYPE.SERVICE}>Услуга</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <NomenclatureField form={form} productType={watchProductType} preserveLegacySelection={isEditing && !editData?.nomenclatureId} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="basisId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Базис погрузки</FormLabel>
                      <div className="flex gap-1 items-center">
                        <FormControl>
                          <Combobox
                            options={availableBases.map((b) => ({
                              value: b.id,
                              label: b.name,
                              render: (
                                <div className="flex items-center gap-2">
                                  {b.name}
                                  <BaseTypeBadge
                                    type={b.baseType}
                                    short={true}
                                  />
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
                        {hasPermission("directories", "create") && (
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            onClick={() => setAddLoadingBasisOpen(true)}
                            data-testid="button-add-loading-basis"
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
                  name="customerBasisId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Базис доставки</FormLabel>
                      <div className="flex gap-1 items-center">
                        <FormControl>
                          <Combobox
                            options={availableBases.map((b) => ({
                              value: b.id,
                              label: b.name,
                              render: (
                                <div className="flex items-center gap-2">
                                  {b.name}
                                  <BaseTypeBadge
                                    type={b.baseType}
                                    short={true}
                                  />
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
                        {hasPermission("directories", "create") && (
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            onClick={() => setAddDeliveryBasisOpen(true)}
                            data-testid="button-add-delivery-basis"
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
                        checked={field.value === "tonnes"}
                        onCheckedChange={(checked) => {
                          const mode = checked ? "tonnes" : "liters";
                          if (mode === "tonnes") {
                            const tonnes = calculateTransportationMassTonnes(
                              "liters",
                              form.getValues("quantityLiters"),
                              form.getValues("density"),
                            );
                            form.setValue("quantityTonnes", tonnes, {
                              shouldDirty: true,
                              shouldValidate: true,
                            });
                          } else {
                            const density =
                              form.getValues("density") ?? 0;
                            const tonnes =
                              form.getValues("quantityTonnes") ?? 0;
                            form.setValue(
                              "quantityLiters",
                              density > 0 ? (tonnes * 1_000) / density : null,
                              {
                                shouldDirty: true,
                                shouldValidate: true,
                              },
                            );
                          }
                          field.onChange(mode);
                          setSelectedSalePriceId("");
                          form.setValue("salePriceId", null, {
                            shouldDirty: true,
                          });
                        }}
                        data-testid="switch-input-mode"
                      />
                      <Label className="text-sm text-muted-foreground">
                        Т
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
                          disabled={watchFormInputMode === "tonnes"}
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
                          disabled={watchFormInputMode === "tonnes"}
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
                  name="quantityTonnes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Масса (т)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="0.00001"
                          placeholder="0"
                          data-testid="input-quantity-tonnes"
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
              {watchFormInputMode === "liters" && finalTonnes !== null && finalTonnes > 0 && (
                <p className="text-sm text-muted-foreground mt-2">
                  Расчетная масса:{" "}
                  <strong>{formatTonnes(finalTonnes)} т</strong>
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
                      <DeliveryContractHint tariff={matchedDeliveryCost} />
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
                  label="Тариф (₽/т)"
                  value={
                    deliveryTariffPerTonne !== null
                      ? formatPricePerTonne(deliveryTariffPerTonne)
                      : "—"
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
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-0">
                  <Label>Цена услуги</Label>
                  <div className="flex gap-1 items-center">
                    <Select
                      value={selectedSalePriceId}
                      onValueChange={setSelectedSalePriceId}
                    >
                      <SelectTrigger data-testid="select-sale-price">
                        <SelectValue placeholder="Выберите цену услуги" />
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
                    {hasPermission("prices", "create") && (
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={() => setAddSalePriceOpen(true)}
                        data-testid="button-add-sale-price"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <ContractHint
                    contractNumber={getSelectedPriceContract(salePrices, selectedSalePriceId)?.contractNumber}
                    contractName={(getSelectedPriceContract(salePrices, selectedSalePriceId) as any)?.contractName}
                  />
                </div>

                <CalculatedField
                  label="Сумма услуги (₽)"
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
                    label="Прибыль (₽)"
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
                  form.handleSubmit(
                    (data) => onSubmit(data, true),
                    (errors) => {
                      showError(
                        getReadableZodError(
                          errors,
                          "Для сохранения черновика необходимо выбрать заказчика.",
                        ),
                      );
                    },
                  )();
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

      <AddBaseDialog
        isInline
        inlineOpen={addLoadingBasisOpen}
        onInlineOpenChange={setAddLoadingBasisOpen}
        onCreated={(id) => {
          queryClient.invalidateQueries({ queryKey: ["/api/bases"] });
          form.setValue("basisId", id);
        }}
      />
      <AddBaseDialog
        isInline
        inlineOpen={addDeliveryBasisOpen}
        onInlineOpenChange={setAddDeliveryBasisOpen}
        onCreated={(id) => {
          queryClient.invalidateQueries({ queryKey: ["/api/bases"] });
          form.setValue("customerBasisId", id);
        }}
      />

      <ErrorModalComponent />
    </>
  );
});

TransportationForm.displayName = "TransportationForm";
