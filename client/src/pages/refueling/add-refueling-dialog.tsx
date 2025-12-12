import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarIcon, Plus, Loader2 } from "lucide-react";
import type { AircraftRefueling, DirectoryRefueling } from "@shared/schema";
import { PRODUCT_TYPES } from "./constants";
import { CalculatedField } from "./calculated-field";
import { formatNumber, formatCurrency } from "./utils";

const refuelingFormSchema = z.object({
  refuelingDate: z.date({ required_error: "Укажите дату заправки" }),
  productType: z.string().min(1, "Выберите тип товара/услуги"),
  aircraftNumber: z.string().optional(),
  orderNumber: z.string().optional(),
  supplierId: z.string().min(1, "Выберите поставщика"),
  buyerId: z.string().min(1, "Выберите покупателя"),
  inputMode: z.enum(["liters", "kg"]),
  quantityLiters: z.string().optional(),
  density: z.string().optional(),
  quantityKg: z.string().min(1, "Укажите количество"),
  notes: z.string().optional(),
  isApproxVolume: z.boolean().default(false),
  selectedPriceId: z.string().optional(),
});

type RefuelingFormData = z.infer<typeof refuelingFormSchema>;

interface AddRefuelingDialogProps {
  suppliers: any[];
  buyers: any[];
  editRefueling: AircraftRefueling | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddRefuelingDialog({
  suppliers,
  buyers,
  editRefueling,
  open,
  onOpenChange
}: AddRefuelingDialogProps) {
  const { toast } = useToast();
  const [inputMode, setInputMode] = useState<"liters" | "kg">("liters");
  const isEditing = !!editRefueling;

  const { data: allBases = [] } = useQuery<any[]>({
    queryKey: ["/api/bases"],
  });

  // Filter only refueling bases
  const bases = allBases.filter(b => b.baseType === 'refueling');


  const form = useForm<RefuelingFormData>({
    resolver: zodResolver(refuelingFormSchema),
    defaultValues: {
      refuelingDate: editRefueling ? new Date(editRefueling.refuelingDate) : new Date(),
      productType: editRefueling?.productType || "kerosene",
      aircraftNumber: editRefueling?.aircraftNumber || "",
      orderNumber: editRefueling?.orderNumber || "",
      supplierId: editRefueling?.supplierId || "",
      buyerId: editRefueling?.buyerId || "",
      inputMode: "liters",
      quantityLiters: editRefueling?.quantityLiters || "",
      density: editRefueling?.density || "",
      quantityKg: editRefueling?.quantityKg || "",
      notes: editRefueling?.notes || "",
      isApproxVolume: editRefueling?.isApproxVolume || false,
      selectedPriceId: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: RefuelingFormData) => {
      const payload = {
        ...data,
        supplierId: data.supplierId,
        buyerId: data.buyerId,
        refuelingDate: format(data.refuelingDate, "yyyy-MM-dd"),
      };
      const res = await apiRequest(isEditing ? "PATCH" : "POST", isEditing ? `/api/refueling/${editRefueling?.id}` : "/api/refueling", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/refueling"] });
      toast({ title: isEditing ? "Заправка обновлена" : "Заправка создана", description: "Запись о заправке успешно сохранена" });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const watchLiters = form.watch("quantityLiters");
  const watchDensity = form.watch("density");
  const watchKg = form.watch("quantityKg");
  const watchProductType = form.watch("productType");

  const calculatedKg = inputMode === "liters" && watchLiters && watchDensity
    ? (parseFloat(watchLiters) * parseFloat(watchDensity)).toFixed(2)
    : watchKg;

  const isServiceType = ["service", "storage", "agent"].includes(watchProductType);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Редактирование заправки" : "Новая заправка ВС"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Измените данные заправки" : "Заполните данные для записи заправки"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
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
                            {field.value ? format(field.value, "dd.MM.yyyy", { locale: ru }) : "Выберите дату"}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          locale={ru}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="productType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Товар/Услуга</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-product-type">
                          <SelectValue placeholder="Выберите тип" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PRODUCT_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
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
                name="aircraftNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Бортовой номер</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="RA-12345"
                        data-testid="input-aircraft-number"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="orderNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Номер РТ</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="RT-001234"
                        data-testid="input-order-number"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <FormField
                control={form.control}
                name="supplierId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Поставщик (Аэропорт)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-refueling-supplier">
                          <SelectValue placeholder="Выберите поставщика" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {suppliers?.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.name}
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

              <CalculatedField
                label="Базис"
                value="Шереметьево"
              />

              <FormField
                control={form.control}
                name="buyerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Покупатель</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-refueling-buyer">
                          <SelectValue placeholder="Выберите покупателя" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {buyers?.map((buyer) => (
                          <SelectItem key={buyer.id} value={buyer.id}>
                            {buyer.name}
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

            {!isServiceType && (
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between gap-4">
                    <CardTitle className="text-lg">Объем топлива</CardTitle>
                    <div className="flex items-center gap-2">
                      <Label className="text-sm text-muted-foreground">Литры/Плотность</Label>
                      <Switch
                        checked={inputMode === "kg"}
                        onCheckedChange={(checked) => setInputMode(checked ? "kg" : "liters")}
                        data-testid="switch-refueling-input-mode"
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
                                  data-testid="input-refueling-liters"
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
                                  data-testid="input-refueling-density"
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
                                data-testid="input-refueling-kg"
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
            )}

            {isServiceType && (
              <FormField
                control={form.control}
                name="quantityKg"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {watchProductType === "service" ? "Количество заправок" :
                       watchProductType === "storage" ? "Объем хранения (кг)" :
                       "Сумма услуги"}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="0.00"
                        data-testid="input-service-quantity"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <CalculatedField
                label="Объем на складе"
                value="ОК: 45,000"
                status="ok"
                suffix=" кг"
              />
              <CalculatedField
                label="Покупка"
                value={formatNumber(58.50)}
                suffix=" ₽/кг"
              />
              <CalculatedField
                label="Сумма закупки"
                value={formatCurrency(187200)}
              />
              <CalculatedField
                label="Продажа"
                value={formatNumber(65.00)}
                suffix=" ₽/кг"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <CalculatedField
                label="Сумма продажи"
                value={formatCurrency(208000)}
              />
              <CalculatedField
                label="Прибыль"
                value={formatCurrency(20800)}
                status="ok"
              />
              <CalculatedField
                label="Накопительно"
                value={formatCurrency(458000)}
              />
            </div>

            <div className="flex items-center gap-4">
              <FormField
                control={form.control}
                name="isApproxVolume"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-refueling-approx-volume"
                      />
                    </FormControl>
                    <FormLabel className="text-sm font-normal cursor-pointer">
                      Примерный объем (требует уточнения)
                    </FormLabel>
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-4 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-refueling">
                {createMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{isEditing ? "Сохранение..." : "Сохранение..."}</>
                ) : (
                  <><Plus className="mr-2 h-4 w-4" />{isEditing ? "Сохранить изменения" : "Создать запись"}</>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}