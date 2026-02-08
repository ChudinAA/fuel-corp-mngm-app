import { useFormContext } from "react-hook-form";
import {
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Supplier, Customer } from "@shared/schema";

interface CounterpartiesSectionProps {
  suppliers: Supplier[];
  customers: Customer[];
}

export function CounterpartiesSection({ suppliers, customers }: CounterpartiesSectionProps) {
  const { control } = useFormContext();

  const foreignSuppliers = suppliers.filter(
    (s) => s.isForeign || s.isIntermediary,
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Контрагенты</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={control}
          name="supplierId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Поставщик</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-supplier">
                    <SelectValue placeholder="Выберите" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {foreignSuppliers.length === 0 ? (
                    <SelectItem value="none" disabled>
                      Нет иностранных поставщиков
                    </SelectItem>
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
          control={control}
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
                    <SelectItem value="none" disabled>
                      Нет покупателей
                    </SelectItem>
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
  );
}
