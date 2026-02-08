import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  refuelingAbroadFormSchema,
  type RefuelingAbroadFormData,
} from "../schemas";
import type { RefuelingAbroadFormProps } from "../types";
import { useRefuelingAbroadCalculations } from "../hooks/use-refueling-abroad-calculations";
import { IntermediariesSection } from "./intermediaries-section";
import { PRODUCT_TYPES_ABROAD } from "../constants";
import type {
  Supplier,
  Customer,
  ExchangeRate,
  StorageCard,
} from "@shared/schema";

// Import new sections
import { FlightInfoSection } from "./sections/FlightInfoSection";
import { CounterpartiesSection } from "./sections/CounterpartiesSection";
import { FuelVolumeSection } from "./sections/FuelVolumeSection";
import { PriceAndRatesSection } from "./sections/PriceAndRatesSection";
import { CalculationSummarySection } from "./sections/CalculationSummarySection";
import { FormActions } from "./sections/FormActions";

interface IntermediaryItem {
  id?: string;
  intermediaryId: string;
  orderIndex: number;
  commissionFormula: string;
  commissionUsd: number | null;
  commissionRub: number | null;
  notes: string;
}

export function RefuelingAbroadForm({
  onSuccess,
  editData,
}: RefuelingAbroadFormProps) {
  const { toast } = useToast();
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

  const { data: exchangeRates = [] } = useQuery<ExchangeRate[]>({
    queryKey: ["/api/exchange-rates"],
  });

  const { data: storageCards = [] } = useQuery<StorageCard[]>({
    queryKey: ["/api/storage-cards"],
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
    if (existingIntermediaries.length > 0) {
      setIntermediariesList(
        existingIntermediaries.map((item) => ({
          id: isCopy ? undefined : item.id,
          intermediaryId: item.intermediaryId,
          orderIndex: item.orderIndex,
          commissionFormula: item.commissionFormula || "",
          commissionUsd: item.commissionUsd
            ? parseFloat(String(item.commissionUsd))
            : null,
          commissionRub: item.commissionRub
            ? parseFloat(String(item.commissionRub))
            : null,
          notes: item.notes || "",
        })),
      );
    }
  }, [existingIntermediaries, isCopy]);

  const latestUsdRate = exchangeRates
    .filter((r) => r.currency === "USD" && r.isActive)
    .sort(
      (a, b) => new Date(b.rateDate).getTime() - new Date(a.rateDate).getTime(),
    )[0];

  const form = useForm<RefuelingAbroadFormData>({
    resolver: zodResolver(refuelingAbroadFormSchema),
    defaultValues: {
      refuelingDate: editData?.refuelingDate
        ? new Date(editData.refuelingDate)
        : new Date(),
      productType: editData?.productType || PRODUCT_TYPES_ABROAD[0].value,
      aircraftNumber: editData?.aircraftNumber || "",
      flightNumber: editData?.flightNumber || "",
      airportCode: editData?.airport || "",
      supplierId: editData?.supplierId || "",
      buyerId: editData?.buyerId || "",
      storageCardId: editData?.storageCardId || "",
      intermediaries: [],
      inputMode: (editData?.inputMode as "liters" | "kg") || (editData?.quantityLiters ? "liters" : "kg"),
      quantityLiters: editData?.quantityLiters?.toString() || "",
      density: editData?.density?.toString() || "0.8",
      quantityKg: editData?.quantityKg?.toString() || "",
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
    manualCommissionUsd: totalIntermediaryCommissionUsd.toString(),
  });

  const createMutation = useMutation({
    mutationFn: async (data: RefuelingAbroadFormData) => {
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
        await apiRequest(
          "PATCH",
          `/api/refueling-abroad/${editData.id}`,
          payload,
        );
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
          commissionFormula: item.commissionFormula || null,
          commissionUsd: item.commissionUsd ?? null,
          commissionRub: item.commissionRub ?? null,
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
      queryClient.invalidateQueries({ queryKey: ["/api/refueling-abroad"] });
      toast({ title: editData ? "Запись обновлена" : "Запись создана" });
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

  const onSubmit = (
    data: RefuelingAbroadFormData,
    isDraftOverride?: boolean,
  ) => {
    const finalIsDraft = isDraftOverride ?? data.isDraft;
    form.setValue("isDraft", finalIsDraft);
    createMutation.mutate({ ...data, isDraft: finalIsDraft });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((data) => onSubmit(data))}
        className="space-y-4"
      >
        <FlightInfoSection storageCards={storageCards} />
        <CounterpartiesSection suppliers={suppliers} customers={customers} />

        <IntermediariesSection
          intermediaries={intermediariesList}
          onChange={setIntermediariesList}
          purchasePrice={calculations.purchasePrice}
          salePrice={calculations.salePrice}
          quantity={Number(calculations.finalKg)}
          exchangeRate={saleExchangeRate}
        />

        <FuelVolumeSection />
        <PriceAndRatesSection exchangeRates={exchangeRates} />

        <CalculationSummarySection
          calculations={calculations}
          purchaseExchangeRate={purchaseExchangeRate}
          saleExchangeRate={saleExchangeRate}
          totalIntermediaryCommissionUsd={totalIntermediaryCommissionUsd}
          totalIntermediaryCommissionRub={totalIntermediaryCommissionRub}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Примечания</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Дополнительная информация..."
                  {...field}
                  value={field.value || ""}
                  data-testid="input-notes"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormActions
          isEditing={isEditing}
          isPending={createMutation.isPending}
          isDraft={isDraft}
          onDraftSubmit={() => onSubmit(form.getValues(), true)}
        />
      </form>
    </Form>
  );
}
