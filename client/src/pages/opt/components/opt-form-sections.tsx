
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import type { UseFormReturn } from "react-hook-form";
import type { DirectoryLogistics } from "@shared/schema";
import { CalculatedField } from "./calculated-field";
import { formatNumber } from "../utils";
import type { OptFormData } from "../schemas";

interface VolumeInputSectionProps {
  form: UseFormReturn<OptFormData>;
  inputMode: "liters" | "kg";
  setInputMode: (mode: "liters" | "kg") => void;
  calculatedKg: string;
}

export function VolumeInputSection({ form, inputMode, setInputMode, calculatedKg }: VolumeInputSectionProps) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-lg">Объем топлива</CardTitle>
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">Литры/Плотность</Label>
            <Switch
              checked={inputMode === "kg"}
              onCheckedChange={(checked) => setInputMode(checked ? "kg" : "liters")}
              data-testid="switch-input-mode"
            />
            <Label className="text-sm text-muted-foreground">КГ</Label>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          {inputMode === "liters" ? (
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
                        placeholder="0.00"
                        data-testid="input-liters"
                        {...field} 
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
                        step="0.0001"
                        placeholder="0.8000"
                        data-testid="input-density"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <CalculatedField 
                label="КГ (расчет)" 
                value={formatNumber(calculatedKg)}
                suffix=" кг"
              />
            </>
          ) : (
            <FormField
              control={form.control}
              name="quantityKg"
              render={({ field }) => (
                <FormItem className="md:col-span-3">
                  <FormLabel>Количество (КГ)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="0.00"
                      data-testid="input-kg"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface LogisticsSectionProps {
  form: UseFormReturn<OptFormData>;
  carriers?: DirectoryLogistics[];
  deliveryLocations?: DirectoryLogistics[];
  vehicles?: DirectoryLogistics[];
  trailers?: DirectoryLogistics[];
  drivers?: DirectoryLogistics[];
}

export function LogisticsSection({ 
  form, 
  carriers, 
  deliveryLocations, 
  vehicles, 
  trailers, 
  drivers 
}: LogisticsSectionProps) {
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
                    {carriers?.map((carrier) => (
                      <SelectItem key={carrier.id} value={carrier.id}>
                        {carrier.name}
                      </SelectItem>
                    )) || (
                      <SelectItem value="none" disabled>Нет данных</SelectItem>
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
                    {deliveryLocations?.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                      </SelectItem>
                    )) || (
                      <SelectItem value="none" disabled>Нет данных</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="vehicleNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Госномер</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-vehicle">
                      <SelectValue placeholder="Выберите номер" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {vehicles?.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.name}>
                        {vehicle.name}
                      </SelectItem>
                    )) || (
                      <SelectItem value="none" disabled>Нет данных</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="trailerNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Госномер ПП</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-trailer">
                      <SelectValue placeholder="Выберите номер" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {trailers?.map((trailer) => (
                      <SelectItem key={trailer.id} value={trailer.name}>
                        {trailer.name}
                      </SelectItem>
                    )) || (
                      <SelectItem value="none" disabled>Нет данных</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="driverName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ФИО водителя</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-driver">
                      <SelectValue placeholder="Выберите водителя" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {drivers?.map((driver) => (
                      <SelectItem key={driver.id} value={driver.name}>
                        {driver.name}
                      </SelectItem>
                    )) || (
                      <SelectItem value="none" disabled>Нет данных</SelectItem>
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
