import { DollarSign, ArrowRightLeft } from "lucide-react";
import { useFormContext } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ExchangeRate } from "@shared/schema";

interface PriceAndRatesSectionProps {
  exchangeRates: ExchangeRate[];
}

export function PriceAndRatesSection({ exchangeRates }: PriceAndRatesSectionProps) {
  const { control } = useFormContext();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Цена закупки
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField
            control={control}
            name="purchasePriceUsd"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Цена USD / ед.</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.0001"
                    placeholder="0.0000"
                    {...field}
                    value={field.value || ""}
                    data-testid="input-purchase-price-usd"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-2">
            <FormField
              control={control}
              name="purchaseExchangeRateId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1">
                    <ArrowRightLeft className="h-3 w-3" />
                    Курс закупки
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-purchase-rate">
                        <SelectValue placeholder="Выберите" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {exchangeRates.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.rate} ({r.currency})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="manualPurchaseExchangeRate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Свой курс</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.0001"
                      placeholder="0.0000"
                      {...field}
                      value={field.value || ""}
                      data-testid="input-manual-purchase-rate"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Цена продажи
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField
            control={control}
            name="salePriceUsd"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Цена USD / ед.</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.0001"
                    placeholder="0.0000"
                    {...field}
                    value={field.value || ""}
                    data-testid="input-sale-price-usd"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-2">
            <FormField
              control={control}
              name="saleExchangeRateId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1">
                    <ArrowRightLeft className="h-3 w-3" />
                    Курс продажи
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-sale-rate">
                        <SelectValue placeholder="Выберите" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {exchangeRates.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.rate} ({r.currency})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="manualSaleExchangeRate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Свой курс</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.0001"
                      placeholder="0.0000"
                      {...field}
                      value={field.value || ""}
                      data-testid="input-manual-sale-rate"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
