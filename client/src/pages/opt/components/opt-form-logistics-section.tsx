
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { UseFormReturn } from "react-hook-form";
import type { OptFormData } from "../schemas";

interface OptFormLogisticsSectionProps {
  form: UseFormReturn<OptFormData>;
  availableCarriers: any[];
  availableLocations: any[];
}

export function OptFormLogisticsSection({
  form,
  availableCarriers,
  availableLocations,
}: OptFormLogisticsSectionProps) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Логистика</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <FormField
            control={form.control}
            name="carrierId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Перевозчик</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-carrier">
                      <SelectValue placeholder="Выберите перевозчика" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {availableCarriers.length > 0 ? (
                      availableCarriers.map((carrier: any) => (
                        <SelectItem key={carrier.id} value={carrier.id}>
                          {carrier.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>
                        Нет доступных перевозчиков
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="deliveryLocationId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Место доставки</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-delivery-location">
                      <SelectValue placeholder="Выберите место" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {availableLocations.length > 0 ? (
                      availableLocations.map((location: any) => (
                        <SelectItem key={location.id} value={location.id}>
                          {location.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>
                        Нет доступных мест доставки
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}
