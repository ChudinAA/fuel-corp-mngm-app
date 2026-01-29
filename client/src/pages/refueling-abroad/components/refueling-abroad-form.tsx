import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, Plane, DollarSign, ArrowRightLeft, CalendarIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { refuelingAbroadFormSchema, type RefuelingAbroadFormData } from "../schemas";
import type { RefuelingAbroadFormProps } from "../types";
import { useRefuelingAbroadCalculations } from "../hooks/use-refueling-abroad-calculations";
import { IntermediariesSection } from "./intermediaries-section";
import { formatCurrency, formatNumber } from "../utils";
import { PRODUCT_TYPES_ABROAD } from "../constants";
import type { Supplier, Customer, ExchangeRate, StorageCard } from "@shared/schema";

interface IntermediaryItem {
  id?: string;
  intermediaryId: string;
  orderIndex: number;
  commissionFormula: string;
  commissionUsd: number | null;
  commissionRub: number | null;
  notes: string;
}

export function RefuelingAbroadForm({ onSuccess, editData }: RefuelingAbroadFormProps) {
  const { toast } = useToast();
  const [intermediariesList, setIntermediariesList] = useState<IntermediaryItem[]>([]);
  
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
    queryKey: ["/api/refueling-abroad", editData?.id, "intermediaries"],
    queryFn: async () => {
      if (!editData?.id) return [];
      const res = await fetch(`/api/refueling-abroad/${editData.id}/intermediaries`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!editData?.id,
  });
  
  useEffect(() => {
    if (existingIntermediaries.length > 0) {
      setIntermediariesList(existingIntermediaries.map(item => ({
        id: item.id,
        intermediaryId: item.intermediaryId,
        orderIndex: item.orderIndex,
        commissionFormula: item.commissionFormula || "",
        commissionUsd: item.commissionUsd ? parseFloat(String(item.commissionUsd)) : null,
        commissionRub: item.commissionRub ? parseFloat(String(item.commissionRub)) : null,
        notes: item.notes || "",
      })));
    }
  }, [existingIntermediaries]);
  
  const foreignSuppliers = suppliers.filter(s => s.isForeign || s.isIntermediary);
  
  const latestUsdRate = exchangeRates
    .filter(r => r.currency === "USD" && r.isActive)
    .sort((a, b) => new Date(b.rateDate).getTime() - new Date(a.rateDate).getTime())[0];
  
  const form = useForm<RefuelingAbroadFormData>({
    resolver: zodResolver(refuelingAbroadFormSchema),
    defaultValues: {
      refuelingDate: editData?.refuelingDate ? new Date(editData.refuelingDate) : new Date(),
      productType: editData?.productType || PRODUCT_TYPES_ABROAD[0].value,
      aircraftNumber: editData?.aircraftNumber || "",
      flightNumber: editData?.orderNumber || "",
      airportCode: editData?.airport || "",
      supplierId: editData?.supplierId || "",
      buyerId: editData?.buyerId || "",
      storageCardId: editData?.storageCardId || "",
      intermediaries: [],
      inputMode: "kg",
      quantityLiters: "",
      density: "0.8",
      quantityKg: editData?.quantityKg?.toString() || "",
      purchasePriceUsd: editData?.purchasePriceUsd || "",
      salePriceUsd: editData?.salePriceUsd || "",
      purchaseExchangeRateId: editData?.purchaseExchangeRateId || latestUsdRate?.id || "",
      manualPurchaseExchangeRate: editData?.purchaseExchangeRateValue?.toString() || "",
      saleExchangeRateId: editData?.saleExchangeRateId || latestUsdRate?.id || "",
      manualSaleExchangeRate: editData?.saleExchangeRateValue?.toString() || "",
      notes: editData?.notes || "",
      isDraft: editData?.isDraft || false,
    },
  });
  
  const watchedValues = form.watch();
  
  const selectedPurchaseExchangeRate = exchangeRates.find(r => r.id === watchedValues.purchaseExchangeRateId);
  const purchaseExchangeRate = watchedValues.manualPurchaseExchangeRate 
    ? parseFloat(watchedValues.manualPurchaseExchangeRate) 
    : (selectedPurchaseExchangeRate ? parseFloat(selectedPurchaseExchangeRate.rate) : 0);
  
  const selectedSaleExchangeRate = exchangeRates.find(r => r.id === watchedValues.saleExchangeRateId);
  const saleExchangeRate = watchedValues.manualSaleExchangeRate 
    ? parseFloat(watchedValues.manualSaleExchangeRate) 
    : (selectedSaleExchangeRate ? parseFloat(selectedSaleExchangeRate.rate) : 0);
  
  const totalIntermediaryCommissionUsd = intermediariesList.reduce(
    (sum, item) => sum + (item.commissionUsd || 0),
    0
  );
  const totalIntermediaryCommissionRub = intermediariesList.reduce(
    (sum, item) => sum + (item.commissionRub || 0),
    0
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
        refuelingDate: data.refuelingDate ? format(data.refuelingDate, "yyyy-MM-dd'T'HH:mm:ss") : null,
        productType: data.productType || null,
        aircraftNumber: data.aircraftNumber || null,
        orderNumber: data.flightNumber || null,
        airport: data.airportCode || null,
        country: null,
        supplierId: (data.supplierId && data.supplierId !== "none") ? data.supplierId : null,
        buyerId: (data.buyerId && data.buyerId !== "none") ? data.buyerId : null,
        intermediaryId: null,
        storageCardId: (data.storageCardId && data.storageCardId !== "none") ? data.storageCardId : null,
        intermediaryCommissionFormula: null,
        intermediaryCommissionUsd: totalIntermediaryCommissionUsd || null,
        intermediaryCommissionRub: totalIntermediaryCommissionRub || null,
        quantityLiters: data.quantityLiters ? parseFloat(data.quantityLiters) : null,
        density: data.density ? parseFloat(data.density) : null,
        quantityKg: calculations.finalKg || 0,
        currency: "USD",
        purchaseExchangeRateId: data.purchaseExchangeRateId || null,
        purchaseExchangeRateValue: purchaseExchangeRate || null,
        saleExchangeRateId: data.saleExchangeRateId || null,
        saleExchangeRateValue: saleExchangeRate || null,
        purchasePriceUsd: calculations.purchasePrice || null,
        purchasePriceRub: calculations.purchasePrice && purchaseExchangeRate ? calculations.purchasePrice * purchaseExchangeRate : null,
        salePriceUsd: calculations.salePrice || null,
        salePriceRub: calculations.salePrice && saleExchangeRate ? calculations.salePrice * saleExchangeRate : null,
        purchaseAmountUsd: calculations.purchaseAmountUsd || null,
        saleAmountUsd: calculations.saleAmountUsd || null,
        purchaseAmountRub: calculations.purchaseAmountRub || null,
        saleAmountRub: calculations.saleAmountRub || null,
        profitUsd: calculations.profitUsd ?? null,
        profitRub: calculations.profitRub ?? null,
        notes: data.notes || null,
        isDraft: data.isDraft,
      };
      
      let refuelingId: string;
      
      if (editData) {
        const response = await apiRequest("PATCH", `/api/refueling-abroad/${editData.id}`, payload);
        const result = await response.json();
        refuelingId = editData.id;
      } else {
        const response = await apiRequest("POST", "/api/refueling-abroad", payload);
        const result = await response.json();
        refuelingId = result.id;
      }
      
      const intermediariesPayload = intermediariesList
        .filter(item => item.intermediaryId && item.intermediaryId !== "none")
        .map((item, index) => ({
          intermediaryId: item.intermediaryId,
          orderIndex: index,
          commissionFormula: item.commissionFormula || null,
          commissionUsd: item.commissionUsd ?? null,
          commissionRub: item.commissionRub ?? null,
          notes: item.notes || null,
        }));
      
      await apiRequest("PUT", `/api/refueling-abroad/${refuelingId}/intermediaries`, intermediariesPayload);
      
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
  
  const onSubmit = (data: RefuelingAbroadFormData) => {
    createMutation.mutate(data);
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                            ? format(field.value, "dd.MM.yyyy", { locale: ru })
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
                    <Input placeholder="JFK" {...field} value={field.value || ""} data-testid="input-airport-code" />
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
                    <Input placeholder="RA-12345" {...field} value={field.value || ""} data-testid="input-aircraft-number" />
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
                    <Input placeholder="SU-123" {...field} value={field.value || ""} data-testid="input-flight-number" />
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
                  <Select onValueChange={field.onChange} value={field.value || ""}>
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
                  <Select onValueChange={field.onChange} value={field.value || ""}>
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
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="supplierId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Поставщик (иностранный)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-supplier">
                        <SelectValue placeholder="Выберите" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {foreignSuppliers.length === 0 ? (
                        <SelectItem value="none" disabled>Нет иностранных поставщиков</SelectItem>
                      ) : (
                        foreignSuppliers.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name} {s.isIntermediary ? "(посредник)" : ""}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
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
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-buyer">
                        <SelectValue placeholder="Выберите" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {customers.length === 0 ? (
                        <SelectItem value="none" disabled>Нет покупателей</SelectItem>
                      ) : (
                        customers.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} {c.isForeign ? "(иностранный)" : ""}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>
        
        <IntermediariesSection
          intermediaries={intermediariesList}
          onChange={setIntermediariesList}
          purchasePrice={calculations.purchasePrice}
          salePrice={calculations.salePrice}
          quantity={calculations.finalKg}
          exchangeRate={saleExchangeRate}
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
                        <FormLabel className="flex items-center gap-2">Литры</FormLabel>
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
                        <FormLabel className="flex items-center gap-2">Плотность</FormLabel>
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
                      <FormLabel className="flex items-center gap-2">Масса (кг)</FormLabel>
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
              <FormField
                control={form.control}
                name="purchasePriceUsd"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Цена закупки ($/кг)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.0001" 
                        {...field} 
                        value={field.value || ""}
                        data-testid="input-purchase-price-usd" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="salePriceUsd"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Цена продажи ($/кг)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.0001" 
                        {...field} 
                        value={field.value || ""}
                        data-testid="input-sale-price-usd" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              </div>
            
            <div className="border-t pt-4 mt-4">
              <h4 className="text-sm font-medium mb-3">Курсы USD/RUB</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h5 className="text-xs text-muted-foreground font-medium">Для закупки</h5>
                  <FormField
                    control={form.control}
                    name="purchaseExchangeRateId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Курс из справочника</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger data-testid="select-purchase-exchange-rate">
                              <SelectValue placeholder="Выберите курс" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {exchangeRates.filter(r => r.currency === "USD").map((rate) => (
                              <SelectItem key={rate.id} value={rate.id}>
                                {rate.rate} ({new Date(rate.rateDate).toLocaleDateString("ru-RU")})
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
                            placeholder={selectedPurchaseExchangeRate?.rate || "90.00"} 
                            {...field} 
                            value={field.value || ""} 
                            data-testid="input-manual-purchase-exchange-rate" 
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="space-y-3">
                  <h5 className="text-xs text-muted-foreground font-medium">Для продажи</h5>
                  <FormField
                    control={form.control}
                    name="saleExchangeRateId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Курс из справочника</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger data-testid="select-sale-exchange-rate">
                              <SelectValue placeholder="Выберите курс" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {exchangeRates.filter(r => r.currency === "USD").map((rate) => (
                              <SelectItem key={rate.id} value={rate.id}>
                                {rate.rate} ({new Date(rate.rateDate).toLocaleDateString("ru-RU")})
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
                            placeholder={selectedSaleExchangeRate?.rate || "90.00"} 
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Закупка (USD)</Label>
                <div className="font-medium">{formatCurrency(calculations.purchaseAmountUsd, "USD")}</div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Продажа (USD)</Label>
                <div className="font-medium">{formatCurrency(calculations.saleAmountUsd, "USD")}</div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Комиссия посредников (USD)</Label>
                <div className="font-medium">{formatCurrency(totalIntermediaryCommissionUsd, "USD")}</div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Прибыль (USD)</Label>
                <div className={`font-medium ${(calculations.profitUsd || 0) < 0 ? "text-destructive" : "text-green-600"}`}>
                  {formatCurrency(calculations.profitUsd, "USD")}
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Закупка (RUB)</Label>
                <div className="font-medium">{formatCurrency(calculations.purchaseAmountRub, "RUB")}</div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Продажа (RUB)</Label>
                <div className="font-medium">{formatCurrency(calculations.saleAmountRub, "RUB")}</div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Комиссия посредников (RUB)</Label>
                <div className="font-medium">{formatCurrency(totalIntermediaryCommissionRub, "RUB")}</div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Прибыль (RUB)</Label>
                <div className={`font-medium ${(calculations.profitRub || 0) < 0 ? "text-destructive" : "text-green-600"}`}>
                  {formatCurrency(calculations.profitRub, "RUB")}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Примечания</FormLabel>
              <FormControl>
                <Textarea 
                  {...field} 
                  value={field.value || ""} 
                  placeholder="Дополнительная информация..." 
                  data-testid="input-notes" 
                />
              </FormControl>
            </FormItem>
          )}
        />
        
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              form.setValue("isDraft", true);
              form.handleSubmit(onSubmit)();
            }}
            disabled={createMutation.isPending}
            data-testid="button-save-draft"
          >
            Сохранить как черновик
          </Button>
          <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit">
            {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editData ? "Обновить" : "Создать"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
