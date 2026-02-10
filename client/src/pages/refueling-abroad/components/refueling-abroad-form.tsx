import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Loader2,
  Plane,
  DollarSign,
  ArrowRightLeft,
  CalendarIcon,
  Plus,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  refuelingAbroadFormSchema,
  type RefuelingAbroadFormData,
} from "../schemas";
import type { RefuelingAbroadFormProps } from "../types";
import { useRefuelingAbroadCalculations } from "../hooks/use-refueling-abroad-calculations";
import {
  IntermediariesSection,
  IntermediaryItem,
} from "./intermediaries-section";
import { formatCurrency, formatNumber } from "../utils";
import { PRODUCT_TYPES_ABROAD } from "../constants";
import type {
  Supplier,
  Customer,
  ExchangeRate,
  StorageCard,
  Base,
} from "@shared/schema";
import { Combobox } from "@/components/ui/combobox";
import { BaseTypeBadge } from "@/components/base-type-badge";
import { BASE_TYPE, COUNTERPARTY_TYPE, PRODUCT_TYPE } from "@shared/constants";
import { useAuth } from "@/hooks/use-auth";
import { AddCustomerDialog } from "@/pages/counterparties/customers-dialog";
import { AddSupplierDialog } from "@/pages/counterparties/suppliers-dialog";
import { useRefuelingFilters } from "@/pages/refueling/hooks/use-refueling-filters";
import { useAutoPriceSelection } from "@/pages/shared/hooks/use-auto-price-selection";
import { extractPriceIdsForSubmit } from "@/pages/shared/utils/price-utils";
import { CalculatedField } from "@/pages/refueling/calculated-field";
import { AddPriceDialog } from "@/pages/prices/components/add-price-dialog";

export function RefuelingAbroadForm({
  onSuccess,
  editData,
}: RefuelingAbroadFormProps) {
  const { hasPermission } = useAuth();
  const { toast } = useToast();

  const [addPurchasePriceOpen, setAddPurchasePriceOpen] = useState(false);
  const handlePurchasePriceCreated = (id: string) => {
    form.setValue("selectedPurchasePriceId", id);
  };

  const [addSalePriceOpen, setAddSalePriceOpen] = useState(false);
  const handleSalePriceCreated = (id: string) => {
    form.setValue("selectedSalePriceId", id);
  };

  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [addSupplierOpen, setAddSupplierOpen] = useState(false);

  const [selectedPurchasePriceId, setSelectedPurchasePriceId] =
    useState<string>("");
  const [selectedSalePriceId, setSelectedSalePriceId] = useState<string>("");

  const handleCustomerCreated = (id: string) => {
    form.setValue("buyerId", id);
  };

  const handleSupplierCreated = (id: string) => {
    form.setValue("supplierId", id);
  };

  const [intermediariesList, setIntermediariesList] = useState<
    IntermediaryItem[]
  >([]);

  const isCopy = !!editData && !editData.id;
  const originalId = isCopy ? (editData as any).originalId : editData?.id;

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: allBases } = useQuery<Base[]>({
    queryKey: ["/api/bases"],
  });

  const { data: exchangeRates = [] } = useQuery<ExchangeRate[]>({
    queryKey: ["/api/exchange-rates"],
  });

  const { data: storageCards = [] } = useQuery<StorageCard[]>({
    queryKey: ["/api/storage-cards"],
  });

  const { data: currencies = [] } = useQuery<any[]>({
    queryKey: ["/api/currencies"],
  });

  const { data: existingIntermediaries = [] } = useQuery<IntermediaryItem[]>({
    queryKey: ["/api/refueling-abroad", originalId, "intermediaries"],
    queryFn: async () => {
      if (!originalId) return [];
      const res = await fetch(
        `/api/refueling-abroad/${originalId}/intermediaries`,
      );
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!originalId,
  });

  useEffect(() => {
    if (editData) {
      // Construct composite price IDs with indices
      const purchasePriceCompositeId =
        editData.purchasePriceId && editData.purchasePriceIndex !== undefined
          ? `${editData.purchasePriceId}-${editData.purchasePriceIndex}`
          : editData.purchasePriceId || "";

      const salePriceCompositeId =
        editData.salePriceId && editData.salePriceIndex !== undefined
          ? `${editData.salePriceId}-${editData.salePriceIndex}`
          : editData.salePriceId || "";

      setSelectedPurchasePriceId(purchasePriceCompositeId);
      setSelectedSalePriceId(salePriceCompositeId);
    }
    if (existingIntermediaries.length > 0) {
      setIntermediariesList(
        existingIntermediaries.map((item: any) => ({
          // We omit the id when it's a copy so the server creates new intermediary records
          id: isCopy ? undefined : item.id,
          intermediaryId: item.intermediaryId,
          orderIndex: item.orderIndex,
          commissionFormula: item.commissionFormula || "",
          commissionUsd: item.commissionUsd
            ? parseFloat(String(item.commissionUsd))
            : null,
          manualCommissionUsd: item.manualCommissionUsd
            ? parseFloat(item.manualCommissionUsd)
            : null,
          commissionRub: item.commissionRub
            ? parseFloat(String(item.commissionRub))
            : null,
          buyCurrencyId: item.buyCurrencyId,
          sellCurrencyId: item.sellCurrencyId,
          buyExchangeRate: item.buyExchangeRate
            ? parseFloat(String(item.buyExchangeRate))
            : undefined,
          sellExchangeRate: item.sellExchangeRate
            ? parseFloat(String(item.sellExchangeRate))
            : undefined,
          crossConversionCost: item.crossConversionCost
            ? parseFloat(String(item.crossConversionCost))
            : 0,
          crossConversionCostRub: (item as any).crossConversionCostRub
            ? parseFloat(String((item as any).crossConversionCostRub))
            : 0,
          notes: item.notes || "",
        })),
      );
    }
  }, [existingIntermediaries, isCopy, editData]);

  const latestUsdRate = exchangeRates
    .filter((r) => r.currency === "USD" && r.targetCurrency === "RUB")
    .sort(
      (a, b) => new Date(b.rateDate).getTime() - new Date(a.rateDate).getTime(),
    )[0];

  const form = useForm<RefuelingAbroadFormData>({
    resolver: zodResolver(refuelingAbroadFormSchema),
    defaultValues: {
      refuelingDate: editData?.refuelingDate
        ? new Date(editData.refuelingDate)
        : new Date(),
      productType: editData?.productType || PRODUCT_TYPE.KEROSENE,
      aircraftNumber: editData?.aircraftNumber || "",
      flightNumber: editData?.flightNumber || "",
      airportCode: editData?.airport || "",
      supplierId: editData?.supplierId || "",
      buyerId: editData?.buyerId || "",
      basisId: editData?.basisId || "",
      storageCardId: editData?.storageCardId || "",
      intermediaries: [],
      inputMode:
        (editData?.inputMode as "liters" | "kg") ||
        (editData?.quantityLiters ? "liters" : "kg"),
      quantityLiters: editData?.quantityLiters?.toString() || "",
      density: editData?.density?.toString() || "0.8",
      quantityKg: editData?.quantityKg?.toString() || "",
      selectedPurchasePriceId: "",
      selectedSalePriceId: "",
      purchasePriceUsd: editData?.purchasePriceUsd || "",
      salePriceUsd: editData?.salePriceUsd || "",
      purchaseExchangeRateId:
        editData?.purchaseExchangeRateId || latestUsdRate?.id || "",
      manualPurchaseExchangeRate:
        editData?.purchaseExchangeRateValue?.toString() || "",
      saleExchangeRateId:
        editData?.saleExchangeRateId || latestUsdRate?.id || "",
      manualSaleExchangeRate: editData?.saleExchangeRateValue?.toString() || "",
      notes: editData?.notes || "",
      isApproxVolume: editData?.isApproxVolume || false,
      isDraft: editData?.isDraft || false,
    },
  });

  const watchedValues = form.watch();
  const foreignSuppliers = suppliers.filter((s) => s.isForeign);
  const foreignCustomers = customers.filter((c) => c.isForeign);
  const foreignBases =
    allBases?.filter((b) => b.baseType === BASE_TYPE.ABROAD) || [];

  const selectedSupplier = foreignSuppliers?.find(
    (s) => s.id === watchedValues.supplierId,
  );
  const selectedBasis = foreignBases?.find(
    (b) => b.id === watchedValues.basisId,
  );

  const selectedPurchaseExchangeRate = exchangeRates.find(
    (r) => r.id === watchedValues.purchaseExchangeRateId,
  );
  const purchaseExchangeRate = watchedValues.manualPurchaseExchangeRate
    ? parseFloat(watchedValues.manualPurchaseExchangeRate)
    : selectedPurchaseExchangeRate
      ? parseFloat(selectedPurchaseExchangeRate.rate)
      : 0;

  const selectedSaleExchangeRate = exchangeRates.find(
    (r) => r.id === watchedValues.saleExchangeRateId,
  );
  const saleExchangeRate = watchedValues.manualSaleExchangeRate
    ? parseFloat(watchedValues.manualSaleExchangeRate)
    : selectedSaleExchangeRate
      ? parseFloat(selectedSaleExchangeRate.rate)
      : 0;

  const totalIntermediaryCommissionUsd = intermediariesList.reduce(
    (sum, item) => sum + (item.commissionUsd || 0),
    0,
  );
  const totalIntermediaryCommissionRub = intermediariesList.reduce(
    (sum, item) => sum + (item.commissionRub || 0),
    0,
  );

  const totalCrossConversionCostUsd = intermediariesList.reduce(
    (sum, item) => sum + (item.crossConversionCost || 0),
    0,
  );

  const totalCrossConversionCostRub = intermediariesList.reduce(
    (sum, item) => sum + (item.crossConversionCostRub || 0),
    0,
  );

  // Use filtering hook
  const { refuelingSuppliers, availableBases, purchasePrices, salePrices } =
    useRefuelingFilters({
      supplierId: watchedValues.supplierId,
      buyerId: watchedValues.buyerId,
      refuelingDate: watchedValues.refuelingDate ?? new Date(),
      basisId: watchedValues.basisId,
      customerBasisId: watchedValues.basisId,
      productType: watchedValues.productType ?? PRODUCT_TYPE.KEROSENE,
      baseType: BASE_TYPE.ABROAD,
      counterpartyType: COUNTERPARTY_TYPE.REFUELING_ABROAD,
      suppliers: foreignSuppliers,
      allBases: foreignBases,
    });

  const calculations = useRefuelingAbroadCalculations({
    inputMode: watchedValues.inputMode,
    quantityLiters: watchedValues.quantityLiters || "",
    density: watchedValues.density || "0.8",
    quantityKg: watchedValues.quantityKg || "",
    purchasePriceUsd: watchedValues.purchasePriceUsd || "",
    salePriceUsd: watchedValues.salePriceUsd || "",
    purchaseExchangeRate,
    saleExchangeRate,
    commissionFormula: "",
    manualCommissionUsd: (
      totalIntermediaryCommissionUsd + totalCrossConversionCostUsd
    ).toString(),
    purchasePrices,
    salePrices,
    selectedPurchasePriceId,
    selectedSalePriceId,
    productType: watchedValues.productType || "",
    initialQuantityKg: parseFloat(editData?.quantityKg || "0"),
  });

  // Используем общий хук для автоматического выбора цен
  useAutoPriceSelection({
    supplierId: watchedValues.supplierId,
    buyerId: watchedValues.buyerId,
    purchasePrices,
    salePrices,
    isWarehouseSupplier: false,
    editData,
    setSelectedPurchasePriceId,
    setSelectedSalePriceId,
    formSetValue: form.setValue as any,
  });

  const createMutation = useMutation({
    mutationFn: async (data: RefuelingAbroadFormData) => {
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
        false,
      );
      const payload = {
        refuelingDate: data.refuelingDate
          ? format(data.refuelingDate, "yyyy-MM-dd'T'HH:mm:ss")
          : null,
        productType: data.productType || null,
        aircraftNumber: data.aircraftNumber || null,
        flightNumber: data.flightNumber || null,
        airport: data.airportCode || null,
        country: null,
        supplierId:
          data.supplierId && data.supplierId !== "none"
            ? data.supplierId
            : null,
        buyerId: data.buyerId && data.buyerId !== "none" ? data.buyerId : null,
        basisId: data.basisId && data.basisId !== "none" ? data.basisId : null,
        intermediaryId: null,
        storageCardId:
          data.storageCardId && data.storageCardId !== "none"
            ? data.storageCardId
            : null,
        intermediaryCommissionFormula: null,
        intermediaryCommissionUsd: totalIntermediaryCommissionUsd || null,
        intermediaryCommissionRub: totalIntermediaryCommissionRub || null,
        quantityLiters: data.quantityLiters
          ? parseFloat(data.quantityLiters)
          : null,
        density: data.density ? parseFloat(data.density) : null,
        quantityKg: calculations.finalKg || 0,
        purchasePriceId: purchasePriceId || null,
        purchasePriceIndex:
          purchasePriceIndex !== undefined ? purchasePriceIndex : null,
        salePriceId: salePriceId || null,
        salePriceIndex: salePriceIndex !== undefined ? salePriceIndex : null,
        currency: "USD",
        purchaseExchangeRateId: data.purchaseExchangeRateId || null,
        purchaseExchangeRateValue: purchaseExchangeRate || null,
        saleExchangeRateId: data.saleExchangeRateId || null,
        saleExchangeRateValue: saleExchangeRate || null,
        purchasePriceUsd: calculations.purchasePrice || null,
        purchasePriceRub:
          calculations.purchasePrice && purchaseExchangeRate
            ? calculations.purchasePrice * purchaseExchangeRate
            : null,
        salePriceUsd: calculations.salePrice || null,
        salePriceRub:
          calculations.salePrice && saleExchangeRate
            ? calculations.salePrice * saleExchangeRate
            : null,
        purchaseAmountUsd: calculations.purchaseAmountUsd || null,
        saleAmountUsd: calculations.saleAmountUsd || null,
        purchaseAmountRub: calculations.purchaseAmountRub || null,
        saleAmountRub: calculations.saleAmountRub || null,
        profitUsd: calculations.profitUsd ?? null,
        profitRub: calculations.profitRub ?? null,
        notes: data.notes || null,
        isApproxVolume: data.isApproxVolume || false,
        inputMode: data.inputMode,
        isDraft: data.isDraft,
      };

      let refuelingId: string;

      if (editData && editData.id) {
        const response = await apiRequest(
          "PATCH",
          `/api/refueling-abroad/${editData.id}`,
          payload,
        );
        const result = await response.json();
        refuelingId = editData.id;
      } else {
        const response = await apiRequest(
          "POST",
          "/api/refueling-abroad",
          payload,
        );
        const result = await response.json();
        refuelingId = result.id;
      }

      const intermediariesPayload = intermediariesList
        .filter((item) => item.intermediaryId && item.intermediaryId !== "none")
        .map((item, index) => ({
          intermediaryId: item.intermediaryId,
          orderIndex: index,
          commissionFormula: item.commissionFormula !== undefined ? item.commissionFormula : null,
          manualCommissionUsd: item.manualCommissionUsd || null,
          commissionUsd: item.commissionUsd ?? null,
          commissionRub: item.commissionRub ?? null,
          buyCurrencyId: item.buyCurrencyId || null,
          sellCurrencyId: item.sellCurrencyId || null,
          buyExchangeRate: item.buyExchangeRate ?? null,
          sellExchangeRate: item.sellExchangeRate ?? null,
          crossConversionCost: item.crossConversionCost ?? 0,
          crossConversionCostRub: item.crossConversionCostRub ?? 0,
          notes: item.notes || null,
        }));

      await apiRequest(
        "PUT",
        `/api/refueling-abroad/${refuelingId}/intermediaries`,
        intermediariesPayload,
      );

      return { id: refuelingId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/refueling-abroad/contract-used"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/refueling-abroad"] });
      toast({ title: editData ? "Запись обновлена" : "Запись создана" });
      setSelectedPurchasePriceId("");
      setSelectedSalePriceId("");
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось сохранить запись",
        variant: "destructive",
      });
    },
  });

  const isEditing = !!editData && !!editData.id;
  const isDraft = watchedValues.isDraft;

  const onSubmit = async (
    data: RefuelingAbroadFormData,
    isDraftOverride?: boolean,
  ) => {
    const finalIsDraft = isDraftOverride ?? data.isDraft;
    // Update the form state directly so validation pass or fail based on current state
    form.setValue("isDraft", finalIsDraft);

    if (calculations.contractVolumeStatus.status === "error") {
      toast({
        title: "Ошибка: недостаточно объема по договору Поставщика",
        description: calculations.contractVolumeStatus.message,
        variant: "destructive",
      });
      return;
    }

    if (calculations.supplierContractVolumeStatus.status === "error") {
      toast({
        title: "Ошибка: недостаточно объема по договору Поставщика",
        description: calculations.supplierContractVolumeStatus.message,
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate({ ...data, isDraft: finalIsDraft });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((data) => onSubmit(data))}
        className="space-y-4"
      >
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Plane className="h-4 w-4" />
              Информация о рейсе
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <FormField
              control={form.control}
              name="refuelingDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Дата заправки</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal"
                          data-testid="input-refueling-date"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value
                            ? format(field.value, "yyyy-MM-dd", {
                                locale: ru,
                              })
                            : "Выберите дату"}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value || undefined}
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
              name="airportCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Код аэропорта</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="JFK"
                      {...field}
                      value={field.value || ""}
                      data-testid="input-airport-code"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="aircraftNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Борт</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="RA-12345"
                      {...field}
                      value={field.value || ""}
                      data-testid="input-aircraft-number"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="flightNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Номер рейса</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="SU-123"
                      {...field}
                      value={field.value || ""}
                      data-testid="input-flight-number"
                    />
                  </FormControl>
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
                        <SelectValue placeholder="Выберите" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PRODUCT_TYPES_ABROAD.map((pt) => (
                        <SelectItem key={pt.value} value={pt.value}>
                          {pt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="storageCardId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Карта хранения</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || ""}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-storage-card">
                        <SelectValue placeholder="Не выбрано" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Без карты</SelectItem>
                      {storageCards.map((card) => (
                        <SelectItem key={card.id} value={card.id}>
                          {card.name} ({card.airportCode})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Контрагенты</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="supplierId"
              render={({ field }) => (
                <FormItem className="col-span-1 min-w-0">
                  <FormLabel>Поставщик</FormLabel>
                  <div className="flex gap-1 items-center w-full">
                    <FormControl>
                      <div className="flex-1 min-w-0">
                        <Combobox
                          options={foreignSuppliers.map((s) => ({
                            value: s.id,
                            label: s.name,
                          }))}
                          value={field.value}
                          onValueChange={field.onChange}
                          placeholder="Выберите поставщика"
                          className="w-full"
                          dataTestId="select-supplier"
                        />
                      </div>
                    </FormControl>
                    {hasPermission("directories", "create") && (
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={() => setAddSupplierOpen(true)}
                        data-testid="button-add-supplier-inline"
                        className="shrink-0 h-9 w-9"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedSupplier &&
            selectedSupplier.baseIds &&
            selectedSupplier.baseIds.length > 0 ? (
              <FormField
                control={form.control}
                name="basisId"
                render={({ field }) => (
                  <FormItem className="col-span-1 min-w-0">
                    <FormLabel>Базис</FormLabel>
                    <FormControl>
                      <div className="w-full">
                        <Combobox
                          options={availableBases.map((base) => ({
                            value: base.id,
                            label: base.name,
                            render: (
                              <div className="flex items-center gap-2">
                                {base.name}
                                <BaseTypeBadge
                                  type={base.baseType}
                                  short={true}
                                />
                              </div>
                            ),
                          }))}
                          value={field.value || ""}
                          onValueChange={field.onChange}
                          placeholder="Выберите базис"
                          dataTestId="select-basis"
                          className="w-full"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <div className="space-y-2 col-span-1 min-w-0">
                <label className="text-sm font-medium flex items-center h-6">
                  Базис
                </label>
                <div className="flex items-center gap-2 h-9 px-3 bg-muted rounded-md text-sm overflow-hidden truncate">
                  {selectedBasis?.name || "—"}
                </div>
              </div>
            )}

            <FormField
              control={form.control}
              name="buyerId"
              render={({ field }) => (
                <FormItem className="col-span-1 min-w-0">
                  <FormLabel>Покупатель</FormLabel>
                  <div className="flex gap-1 items-center w-full">
                    <FormControl>
                      <div className="flex-1 min-w-0">
                        <Combobox
                          options={(foreignCustomers || [])?.map((c) => ({
                            value: c.id,
                            label: c.name,
                          }))}
                          value={field.value}
                          onValueChange={field.onChange}
                          placeholder="Выберите покупателя"
                          className="w-full"
                          dataTestId="select-buyer"
                        />
                      </div>
                    </FormControl>
                    {hasPermission("directories", "create") && (
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={() => setAddCustomerOpen(true)}
                        data-testid="button-add-customer-inline"
                        className="shrink-0 h-9 w-9"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <IntermediariesSection
          intermediaries={intermediariesList}
          onChange={setIntermediariesList}
          purchasePrice={calculations.purchasePrice ?? 0}
          salePrice={calculations.salePrice ?? 0}
          quantity={calculations.finalKg}
          exchangeRate={saleExchangeRate}
          currencies={currencies}
        />

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Объем топлива</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="inputMode"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="kg" id="mode-kg" />
                        <Label htmlFor="mode-kg">Ввод в кг</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="liters" id="mode-liters" />
                        <Label htmlFor="mode-liters">Ввод в литрах</Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {watchedValues.inputMode === "liters" ? (
                <>
                  <FormField
                    control={form.control}
                    name="quantityLiters"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          Литры
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            {...field}
                            value={field.value || ""}
                            data-testid="input-quantity-liters"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="density"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          Плотность
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.001"
                            {...field}
                            value={field.value || ""}
                            data-testid="input-density"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </>
              ) : (
                <FormField
                  control={form.control}
                  name="quantityKg"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        Масса (кг)
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          {...field}
                          value={field.value || ""}
                          data-testid="input-quantity-kg"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}

              <div>
                <Label className="text-muted-foreground">Итого (кг)</Label>
                <div className="h-9 px-3 flex items-center bg-muted rounded-md text-sm font-medium">
                  {formatNumber(calculations.finalKg)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Ценообразование (USD)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {purchasePrices.length > 0 ? (
                <FormField
                  control={form.control}
                  name="selectedPurchasePriceId"
                  render={({ field }) => {
                    const firstPriceId =
                      purchasePrices.length > 0
                        ? `${purchasePrices[0].id}-0`
                        : undefined;
                    const effectiveValue =
                      selectedPurchasePriceId || field.value || firstPriceId;

                    if (
                      !selectedPurchasePriceId &&
                      !field.value &&
                      firstPriceId
                    ) {
                      setSelectedPurchasePriceId(firstPriceId);
                      field.onChange(firstPriceId);
                    }

                    return (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          Покупка
                        </FormLabel>
                        <div className="flex gap-1">
                          <Select
                            onValueChange={(value) => {
                              field.onChange(value);
                              setSelectedPurchasePriceId(value);
                            }}
                            value={effectiveValue}
                          >
                            <FormControl>
                              <SelectTrigger
                                data-testid="select-purchase-price"
                                className="flex-1"
                              >
                                <SelectValue placeholder="Выберите цену" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {purchasePrices.map((price) => {
                                const priceValues = price.priceValues || [];
                                if (priceValues.length === 0) return null;

                                return priceValues.map((priceValueStr, idx) => {
                                  try {
                                    const parsed = JSON.parse(priceValueStr);
                                    const priceVal = parsed.price || "0";
                                    return (
                                      <SelectItem
                                        key={`${price.id}-${idx}`}
                                        value={`${price.id}-${idx}`}
                                      >
                                        {formatNumber(priceVal)} $/кг
                                      </SelectItem>
                                    );
                                  } catch {
                                    return null;
                                  }
                                });
                              })}
                            </SelectContent>
                          </Select>
                          {hasPermission("prices", "create") && (
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              onClick={() => setAddPurchasePriceOpen(true)}
                              data-testid="button-add-purchase-price-inline"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              ) : (
                <div className="flex items-end gap-1">
                  <CalculatedField
                    label="Покупка"
                    value="Нет цены!"
                    status="error"
                  />
                  {hasPermission("prices", "create") && (
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={() => setAddPurchasePriceOpen(true)}
                      data-testid="button-add-purchase-price-inline"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}

              {salePrices.length > 0 ? (
                <FormField
                  control={form.control}
                  name="selectedSalePriceId"
                  render={({ field }) => {
                    const firstPriceId =
                      salePrices.length > 0
                        ? `${salePrices[0].id}-0`
                        : undefined;
                    const effectiveValue =
                      selectedSalePriceId || field.value || firstPriceId;

                    if (!selectedSalePriceId && !field.value && firstPriceId) {
                      setSelectedSalePriceId(firstPriceId);
                      field.onChange(firstPriceId);
                    }

                    return (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          Продажа
                        </FormLabel>
                        <div className="flex gap-1">
                          <Select
                            onValueChange={(value) => {
                              field.onChange(value);
                              setSelectedSalePriceId(value);
                            }}
                            value={effectiveValue}
                          >
                            <FormControl>
                              <SelectTrigger
                                data-testid="select-sale-price"
                                className="flex-1"
                              >
                                <SelectValue placeholder="Выберите цену" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {salePrices.map((price) => {
                                const priceValues = price.priceValues || [];
                                if (priceValues.length === 0) return null;

                                return priceValues.map((priceValueStr, idx) => {
                                  try {
                                    const parsed = JSON.parse(priceValueStr);
                                    const priceVal = parsed.price || "0";
                                    return (
                                      <SelectItem
                                        key={`${price.id}-${idx}`}
                                        value={`${price.id}-${idx}`}
                                      >
                                        {formatNumber(priceVal)} $/кг
                                      </SelectItem>
                                    );
                                  } catch {
                                    return null;
                                  }
                                });
                              })}
                            </SelectContent>
                          </Select>
                          {hasPermission("prices", "create") && (
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              onClick={() => setAddSalePriceOpen(true)}
                              data-testid="button-add-sale-price-inline"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              ) : (
                <div className="flex items-end gap-1">
                  <CalculatedField
                    label="Продажа"
                    value="Нет цены!"
                    status="error"
                  />
                  {hasPermission("prices", "create") && (
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={() => setAddSalePriceOpen(true)}
                      data-testid="button-add-sale-price-inline"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}

              <CalculatedField
                label="Доступн. об-м Поставщика"
                value={calculations.supplierContractVolumeStatus.message}
                status={calculations.supplierContractVolumeStatus.status}
              />

              <CalculatedField
                label="Доступн. об-м Покупателя"
                value={calculations.contractVolumeStatus.message}
                status={calculations.contractVolumeStatus.status}
              />
            </div>

            <div className="border-t pt-4 mt-4">
              <h4 className="text-sm font-medium mb-3">Курсы USD/RUB</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h5 className="text-xs text-muted-foreground font-medium">
                    Для закупки у Поставщика
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="purchaseExchangeRateId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Курс из справочника</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value || ""}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-purchase-exchange-rate">
                                <SelectValue placeholder="Выберите курс" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {exchangeRates
                                .filter(
                                  (r) =>
                                    r.currency === "USD" &&
                                    r.targetCurrency === "RUB",
                                )
                                .map((rate) => (
                                  <SelectItem key={rate.id} value={rate.id}>
                                    {rate.rate} (
                                    {new Date(rate.rateDate).toLocaleDateString(
                                      "ru-RU",
                                    )}
                                    )
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="manualPurchaseExchangeRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Или вручную</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder={
                                selectedPurchaseExchangeRate?.rate || "90.00"
                              }
                              {...field}
                              value={field.value || ""}
                              data-testid="input-manual-purchase-exchange-rate"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <h5 className="text-xs text-muted-foreground font-medium">
                    Для продажи Покупателю
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="saleExchangeRateId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Курс из справочника</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value || ""}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-sale-exchange-rate">
                                <SelectValue placeholder="Выберите курс" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {exchangeRates
                                .filter(
                                  (r) =>
                                    r.currency === "USD" &&
                                    r.targetCurrency === "RUB",
                                )
                                .map((rate) => (
                                  <SelectItem key={rate.id} value={rate.id}>
                                    {rate.rate} (
                                    {new Date(rate.rateDate).toLocaleDateString(
                                      "ru-RU",
                                    )}
                                    )
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="manualSaleExchangeRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Или вручную</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder={
                                selectedSaleExchangeRate?.rate || "90.00"
                              }
                              {...field}
                              value={field.value || ""}
                              data-testid="input-manual-sale-exchange-rate"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4" />
              Расчетные значения
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Закупка (USD)
                </Label>
                <div className="font-medium">
                  {formatCurrency(calculations.purchaseAmountUsd, "USD")}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Продажа (USD)
                </Label>
                <div className="font-medium">
                  {formatCurrency(calculations.saleAmountUsd, "USD")}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Комиссия посредников (USD)
                </Label>
                <div
                  className="font-medium"
                  data-testid="text-intermediary-commission-usd"
                >
                  {formatCurrency(totalIntermediaryCommissionUsd, "USD")}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Потери на кросс-курсах (USD)
                </Label>
                <div
                  className="font-medium text-destructive"
                  data-testid="text-cross-conversion-loss-usd"
                >
                  {formatCurrency(totalCrossConversionCostUsd, "USD")}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Прибыль (USD)
                </Label>
                <div
                  className={`font-medium ${(calculations.profitUsd || 0) < 0 ? "text-destructive" : "text-green-600"}`}
                >
                  {formatCurrency(calculations.profitUsd, "USD")}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4 pt-4 border-t">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Закупка (RUB)
                </Label>
                <div className="font-medium">
                  {formatCurrency(calculations.purchaseAmountRub, "RUB")}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Продажа (RUB)
                </Label>
                <div className="font-medium">
                  {formatCurrency(calculations.saleAmountRub, "RUB")}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Комиссия посредников (RUB)
                </Label>
                <div
                  className="font-medium"
                  data-testid="text-intermediary-commission-rub"
                >
                  {formatCurrency(totalIntermediaryCommissionRub, "RUB")}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Потери на кросс-курсах (RUB)
                </Label>
                <div
                  className="font-medium text-destructive"
                  data-testid="text-cross-conversion-loss-usd"
                >
                  {formatCurrency(totalCrossConversionCostRub, "RUB")}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Прибыль (RUB)
                </Label>
                <div
                  className={`font-medium ${(calculations.profitRub || 0) < 0 ? "text-destructive" : "text-green-600"}`}
                >
                  {formatCurrency(calculations.profitRub, "RUB")}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

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
                    value={field.value || ""}
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

        <div className="flex justify-end gap-3 pt-4 border-t">
          {!isEditing || (editData && editData.isDraft) ? (
            <Button
              type="button"
              variant="secondary"
              disabled={createMutation.isPending}
              onClick={() => {
                form.clearErrors();
                onSubmit(form.getValues(), true);
              }}
            >
              {createMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Сохранить черновик
            </Button>
          ) : null}

          <Button
            type="button"
            disabled={createMutation.isPending}
            onClick={() => {
              form.handleSubmit((data) => onSubmit(data, false))();
            }}
            data-testid="button-submit-refueling"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isEditing ? "Сохранение..." : "Создание..."}
              </>
            ) : (
              <>
                {isEditing && !editData.isDraft
                  ? "Сохранить изменения"
                  : "Создать сделку"}
              </>
            )}
          </Button>
        </div>
      </form>

      <AddPriceDialog
        isInline
        inlineOpen={addPurchasePriceOpen}
        onInlineOpenChange={setAddPurchasePriceOpen}
        onCreated={handlePurchasePriceCreated}
      />

      <AddPriceDialog
        isInline
        inlineOpen={addSalePriceOpen}
        onInlineOpenChange={setAddSalePriceOpen}
        onCreated={handleSalePriceCreated}
      />

      <AddSupplierDialog
        bases={foreignBases}
        isInline
        inlineOpen={addSupplierOpen}
        onInlineOpenChange={setAddSupplierOpen}
        onCreated={handleSupplierCreated}
      />

      <AddCustomerDialog
        bases={foreignBases}
        isInline
        inlineOpen={addCustomerOpen}
        onInlineOpenChange={setAddCustomerOpen}
        onCreated={handleCustomerCreated}
      />
    </Form>
  );
}
