import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Plane, CalendarIcon } from "lucide-react";
import { useFormContext } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { PRODUCT_TYPES_ABROAD } from "../../constants";
import type { StorageCard } from "@shared/schema";

interface FlightInfoSectionProps {
  storageCards: StorageCard[];
}

export function FlightInfoSection({ storageCards }: FlightInfoSectionProps) {
  const { control } = useFormContext();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Plane className="h-4 w-4" />
          Информация о рейсе
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <FormField
          control={control}
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
          control={control}
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
          control={control}
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
          control={control}
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
          control={control}
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
          control={control}
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
  );
}
