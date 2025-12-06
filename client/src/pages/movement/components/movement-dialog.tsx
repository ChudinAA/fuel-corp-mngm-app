
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarIcon, Plus, Loader2 } from "lucide-react";
import { movementFormSchema, type MovementFormData } from "../schemas";
import { calculateValues, formatNumber, formatCurrency } from "../utils";
import type { MovementDialogProps } from "../types";
import { CalculatedField } from "./calculated-field";

export function MovementDialog({
  warehouses,
  suppliers,
  carriers,
  vehicles,
  trailers,
  drivers,
  editMovement,
  open,
  onOpenChange
}: MovementDialogProps) {
  const { toast } = useToast();
  const [inputMode, setInputMode] = useState<"liters" | "kg">("liters");
  const isEditing = !!editMovement;

  const form = useForm<MovementFormData>({
    resolver: zodResolver(movementFormSchema),
    defaultValues: {
      movementDate: editMovement ? new Date(editMovement.movementDate) : new Date(),
      movementType: editMovement?.movementType || "supply",
      productType: editMovement?.productType || "kerosene",
      supplierId: editMovement?.supplierId || "",
      fromWarehouseId: editMovement?.fromWarehouseId || "",
      toWarehouseId: editMovement?.toWarehouseId || "",
      inputMode: "liters",
      quantityLiters: editMovement?.quantityLiters || "",
      density: editMovement?.density || "",
      quantityKg: editMovement?.quantityKg || "",
      carrierId: editMovement?.carrierId || "",
      vehicleNumber: editMovement?.vehicleNumber || "",
      trailerNumber: editMovement?.trailerNumber || "",
      driverName: editMovement?.driverName || "",
      notes: editMovement?.notes || "",
    },
  });

  const watchMovementType = form.watch("movementType");
  const watchLiters = form.watch("quantityLiters");
  const watchDensity = form.watch("density");
  const watchKg = form.watch("quantityKg");

  const { calculatedKg, purchasePrice, deliveryCost, totalCost, costPerKg } = calculateValues(
    watchLiters || "",
    watchDensity || "",
    watchKg || "",
    inputMode
  );

  const createMutation = useMutation({
    mutationFn: async (data: MovementFormData) => {
      const payload = {
        ...data,
        movementDate: format(data.movementDate, "yyyy-MM-dd"),
        supplierId: data.supplierId || null,
        fromWarehouseId: data.fromWarehouseId || null,
        toWarehouseId: data.toWarehouseId,
        carrierId: data.carrierId || null,
        quantityKg: calculatedKg || data.quantityKg,
      };
      const res = await apiRequest(isEditing ? "PATCH" : "POST", isEditing ? `/api/movement/${editMovement?.id}` : "/api/movement", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/movement"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
      toast({ title: isEditing ? "Перемещение обновлено" : "Перемещение создано", description: "Запись успешно сохранена" });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Редактирование перемещения" : "Новое перемещение"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Изменение существующей записи" : "Создание записи о поставке или внутреннем перемещении"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <FormField
                control={form.control}
                name="movementDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Дата</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" className="w-full justify-start text-left font-normal" data-testid="input-movement-date">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, "dd.MM.yyyy", { locale: ru }) : "Выберите дату"}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} locale={ru} />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="movementType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Тип перемещения</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-movement-type">
                          <SelectValue placeholder="Выберите тип" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="supply">Поставка</SelectItem>
                        <SelectItem value="internal">Внутреннее перемещение</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="productType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Тип продукта</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-movement-product">
                          <SelectValue placeholder="Выберите тип" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="kerosene">Керосин</SelectItem>
                        <SelectItem value="pvkj">ПВКЖ</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {watchMovementType === "supply" ? (
                <FormField
                  control={form.control}
                  name="supplierId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Поставщик</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-movement-supplier">
                            <SelectValue placeholder="Выберите поставщика" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {suppliers?.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          )) || <SelectItem value="none" disabled>Нет данных</SelectItem>}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <FormField
                  control={form.control}
                  name="fromWarehouseId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Откуда (склад)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-movement-from">
                            <SelectValue placeholder="Выберите склад" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {warehouses?.map((w) => (
                            <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                          )) || <SelectItem value="none" disabled>Нет данных</SelectItem>}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <FormField
              control={form.control}
              name="toWarehouseId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Куда (склад)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-movement-to">
                        <SelectValue placeholder="Выберите склад" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {warehouses?.map((w) => (
                        <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                      )) || <SelectItem value="none" disabled>Нет данных</SelectItem>}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between gap-4">
                  <CardTitle className="text-lg">Объем</CardTitle>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm text-muted-foreground">Литры/Плотность</Label>
                    <Switch checked={inputMode === "kg"} onCheckedChange={(c) => setInputMode(c ? "kg" : "liters")} data-testid="switch-movement-input" />
                    <Label className="text-sm text-muted-foreground">КГ</Label>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  {inputMode === "liters" ? (
                    <>
                      <FormField control={form.control} name="quantityLiters" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Литры</FormLabel>
                          <FormControl><Input type="number" placeholder="0.00" data-testid="input-movement-liters" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="density" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Плотность</FormLabel>
                          <FormControl><Input type="number" step="0.0001" placeholder="0.8000" data-testid="input-movement-density" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <CalculatedField label="КГ (расчет)" value={formatNumber(calculatedKg)} suffix=" кг" />
                    </>
                  ) : (
                    <FormField control={form.control} name="quantityKg" render={({ field }) => (
                      <FormItem className="md:col-span-3">
                        <FormLabel>Количество (КГ)</FormLabel>
                        <FormControl><Input type="number" placeholder="0.00" data-testid="input-movement-kg" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <CalculatedField label="Цена закупки" value={formatNumber(purchasePrice)} suffix=" ₽/кг" />
              <CalculatedField label="Доставка" value={formatCurrency(deliveryCost)} />
              <CalculatedField label="Общая стоимость" value={formatCurrency(totalCost)} />
              <CalculatedField label="Себестоимость на месте" value={formatNumber(costPerKg)} suffix=" ₽/кг" />
            </div>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Логистика</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <FormField control={form.control} name="carrierId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Перевозчик</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger data-testid="select-movement-carrier"><SelectValue placeholder="Выберите" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {carriers?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>) || <SelectItem value="none" disabled>Нет данных</SelectItem>}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="vehicleNumber" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Госномер</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger data-testid="select-movement-vehicle"><SelectValue placeholder="Выберите" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {vehicles?.map((v) => <SelectItem key={v.id} value={v.name}>{v.name}</SelectItem>) || <SelectItem value="none" disabled>Нет данных</SelectItem>}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="trailerNumber" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Госномер ПП</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger data-testid="select-movement-trailer"><SelectValue placeholder="Выберите" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {trailers?.map((t) => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>) || <SelectItem value="none" disabled>Нет данных</SelectItem>}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="driverName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>ФИО водителя</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger data-testid="select-movement-driver"><SelectValue placeholder="Выберите" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {drivers?.map((d) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>) || <SelectItem value="none" disabled>Нет данных</SelectItem>}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </CardContent>
            </Card>

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Примечания</FormLabel>
                <FormControl><Textarea placeholder="Дополнительная информация..." className="resize-none" data-testid="input-movement-notes" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="flex justify-end gap-4 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-create-movement">
                {createMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{isEditing ? "Обновление..." : "Сохранение..."}</> : <><Plus className="mr-2 h-4 w-4" />{isEditing ? "Обновить" : "Создать"}</>}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
