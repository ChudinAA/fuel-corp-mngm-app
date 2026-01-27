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
import { CommissionCalculator } from "./commission-calculator";
import { formatCurrency, formatNumber } from "../utils";
import { PRODUCT_TYPES_ABROAD } from "../constants";
import type { Supplier, Customer, ExchangeRate, StorageCard } from "@shared/schema";

export function RefuelingAbroadForm({ onSuccess, editData }: RefuelingAbroadFormProps) {
  const { toast } = useToast();
  
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
  
  const foreignSuppliers = suppliers.filter(s => s.isForeign || s.isIntermediary);
  const intermediaries = suppliers.filter(s => s.isIntermediary);
  
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
      intermediaryId: editData?.intermediaryId || "",
      storageCardId: editData?.storageCardId || "",
      inputMode: "kg",
      quantityLiters: "",
      density: "0.8",
      quantityKg: editData?.quantityKg?.toString() || "",
      purchasePriceUsd: editData?.purchasePriceUsd || "",
      salePriceUsd: editData?.salePriceUsd || "",
      exchangeRateId: editData?.exchangeRateId || latestUsdRate?.id || "",
      manualExchangeRate: "",
      commissionFormula: editData?.intermediaryCommissionFormula || "",
      commissionUsd: editData?.intermediaryCommissionUsd || "",
      notes: editData?.notes || "",
      isDraft: editData?.isDraft || false,
    },
  });
  
  const watchedValues = form.watch();
  const selectedExchangeRate = exchangeRates.find(r => r.id === watchedValues.exchangeRateId);
  const currentExchangeRate = watchedValues.manualExchangeRate 
    ? parseFloat(watchedValues.manualExchangeRate) 
    : (selectedExchangeRate ? parseFloat(selectedExchangeRate.rate) : 0);
  
  const calculations = useRefuelingAbroadCalculations({
    inputMode: watchedValues.inputMode,
    quantityLiters: watchedValues.quantityLiters || "",
    density: watchedValues.density || "0.8",
    quantityKg: watchedValues.quantityKg || "",
    purchasePriceUsd: watchedValues.purchasePriceUsd || "",
    salePriceUsd: watchedValues.salePriceUsd || "",
    exchangeRate: currentExchangeRate,
    commissionFormula: watchedValues.commissionFormula || "",
    manualCommissionUsd: watchedValues.commissionUsd || "",
  });
  
  const createMutation = useMutation({
    mutationFn: async (data: RefuelingAbroadFormData) => {
      const payload = {
        refuelingDate: data.refuelingDate.toISOString().split("T")[0],
        productType: data.productType,
        aircraftNumber: data.aircraftNumber || null,
        orderNumber: data.flightNumber || null,
        airport: data.airportCode,
        country: null,
        supplierId: data.supplierId,
        buyerId: data.buyerId,
        intermediaryId: data.intermediaryId || null,
        storageCardId: data.storageCardId || null,
        intermediaryCommissionFormula: data.commissionFormula || null,
        intermediaryCommissionUsd: calculations.commissionUsd?.toString() || null,
        intermediaryCommissionRub: calculations.commissionRub?.toString() || null,
        quantityLiters: data.quantityLiters ? parseFloat(data.quantityLiters) : null,
        density: data.density ? parseFloat(data.density) : null,
        quantityKg: calculations.finalKg,
        currency: "USD",
        exchangeRateId: data.exchangeRateId || null,
        exchangeRateValue: currentExchangeRate,
        purchasePriceUsd: calculations.purchasePrice,
        purchasePriceRub: calculations.purchasePrice * currentExchangeRate,
        salePriceUsd: calculations.salePrice,
        salePriceRub: calculations.salePrice * currentExchangeRate,
        purchaseAmountUsd: calculations.purchaseAmountUsd,
        saleAmountUsd: calculations.saleAmountUsd,
        purchaseAmountRub: calculations.purchaseAmountRub,
        saleAmountRub: calculations.saleAmountRub,
        profitUsd: calculations.profitUsd?.toString() || null,
        profitRub: calculations.profitRub?.toString() || null,
        notes: data.notes || null,
        isDraft: data.isDraft,
      };
      
      if (editData) {
        return apiRequest("PATCH", `/api/refueling-abroad/${editData.id}`, payload);
      }
      return apiRequest("POST", "/api/refueling-abroad", payload);
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
              name="airportCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Код аэропорта</FormLabel>
                  <FormControl>
                    <Input placeholder="JFK" {...field} data-testid="input-airport-code" />
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
                  <Select onValueChange={field.onChange} value={field.value}>
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
                      <SelectItem value="">Без карты</SelectItem>
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
                <FormItem>
                  <FormLabel>Поставщик (иностранный)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-supplier">
                        <SelectValue placeholder="Выберите" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {foreignSuppliers.length === 0 && (
                        <SelectItem value="" disabled>Нет иностранных поставщиков</SelectItem>
                      )}
                      {foreignSuppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} {s.isIntermediary ? "(посредник)" : ""}
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
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} {c.isForeign ? "(иностранный)" : ""}
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
              name="intermediaryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Посредник (опционально)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger data-testid="select-intermediary">
                        <SelectValue placeholder="Не выбран" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">Без посредника</SelectItem>
                      {intermediaries.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
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
                        <FormLabel>Литры</FormLabel>
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
                        <FormLabel>Плотность</FormLabel>
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
                      <FormLabel>Масса (кг)</FormLabel>
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
                        data-testid="input-sale-price-usd" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="exchangeRateId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Курс USD/RUB</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger data-testid="select-exchange-rate">
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
                name="manualExchangeRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Или ввести вручную</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        placeholder={selectedExchangeRate?.rate || "90.00"} 
                        {...field} 
                        value={field.value || ""} 
                        data-testid="input-manual-exchange-rate" 
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            
            <CommissionCalculator
              formula={watchedValues.commissionFormula || ""}
              onFormulaChange={(val) => form.setValue("commissionFormula", val)}
              purchasePrice={calculations.purchasePrice}
              salePrice={calculations.salePrice}
              quantity={calculations.finalKg}
              exchangeRate={currentExchangeRate}
              manualCommission={watchedValues.commissionUsd || ""}
              onManualCommissionChange={(val) => form.setValue("commissionUsd", val)}
            />
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
                <Label className="text-xs text-muted-foreground">Комиссия (USD)</Label>
                <div className="font-medium">{formatCurrency(calculations.commissionUsd, "USD")}</div>
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
                <Label className="text-xs text-muted-foreground">Комиссия (RUB)</Label>
                <div className="font-medium">{formatCurrency(calculations.commissionRub, "RUB")}</div>
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
