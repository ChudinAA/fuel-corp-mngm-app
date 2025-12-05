import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Loader2, Truck, MapPin, Car, Container, User, Warehouse } from "lucide-react";
import type { LogisticsCarrier } from "@shared/schema";

export const LOGISTICS_TYPES = [
  { value: "carrier", label: "Перевозчик", icon: Truck },
  { value: "delivery_location", label: "Место доставки", icon: MapPin },
  { value: "vehicle", label: "Транспорт", icon: Car },
  { value: "trailer", label: "Прицеп", icon: Container },
  { value: "driver", label: "Водитель", icon: User },
  { value: "warehouse", label: "Склад/Базис", icon: Warehouse },
] as const;

const logisticsFormSchema = z.object({
  type: z.enum(["carrier", "delivery_location", "vehicle", "trailer", "driver", "warehouse"]),
  name: z.string().min(1, "Укажите название"),
  description: z.string().optional(),
  address: z.string().optional(),
  inn: z.string().optional(),
  carrierId: z.number().optional(),
  plateNumber: z.string().optional(),
  vehicleType: z.string().optional(),
  capacityKg: z.string().optional(),
  fullName: z.string().optional(),
  phone: z.string().optional(),
  licenseNumber: z.string().optional(),
  licenseExpiry: z.string().optional(),
  storageCost: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().default(true),
});

type LogisticsFormData = z.infer<typeof logisticsFormSchema>;

export function AddLogisticsDialog({ carriers }: { carriers: LogisticsCarrier[] }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const form = useForm<LogisticsFormData>({
    resolver: zodResolver(logisticsFormSchema),
    defaultValues: {
      type: "carrier",
      name: "",
      description: "",
      isActive: true,
      inn: "",
      contactPerson: "",
      phone: "",
      address: "",
      coordinates: "",
      carrierId: undefined,
      plateNumber: "",
      vehicleType: "",
      capacityKg: "",
      licenseNumber: "",
      licenseExpiry: "",
      storageCost: "",
      notes: "",
    },
  });

  const selectedType = form.watch("type");

  useEffect(() => {
    form.setValue("inn", "");
    form.setValue("contactPerson", "");
    form.setValue("phone", "");
    form.setValue("address", "");
    form.setValue("coordinates", "");
    form.setValue("carrierId", undefined);
    form.setValue("plateNumber", "");
    form.setValue("vehicleType", "");
    form.setValue("capacityKg", "");
    form.setValue("licenseNumber", "");
    form.setValue("licenseExpiry", "");
    form.setValue("storageCost", "");
    form.setValue("notes", "");
  }, [selectedType, form]);

  const createMutation = useMutation({
    mutationFn: async (data: LogisticsFormData) => {
      let endpoint = "";
      let payload: Record<string, unknown> = {};

      if (data.type === "carrier") {
        endpoint = "/api/logistics/carriers";
        payload = {
          name: data.name,
          description: data.description,
          inn: data.inn,
          contactPerson: data.contactPerson,
          phone: data.phone,
          isActive: data.isActive,
        };
      } else if (data.type === "delivery_location") {
        endpoint = "/api/logistics/delivery-locations";
        payload = {
          name: data.name,
          address: data.address,
          notes: data.coordinates,
          isActive: data.isActive,
        };
      } else if (data.type === "vehicle") {
        endpoint = "/api/logistics/vehicles";
        payload = {
          regNumber: data.plateNumber,
          carrierId: data.carrierId || null,
          model: data.vehicleType,
          capacityKg: data.capacityKg ? parseFloat(data.capacityKg) : null,
          isActive: data.isActive,
        };
      } else if (data.type === "trailer") {
        endpoint = "/api/logistics/trailers";
        payload = {
          regNumber: data.plateNumber,
          carrierId: data.carrierId || null,
          capacityKg: data.capacityKg ? parseFloat(data.capacityKg) : null,
          isActive: data.isActive,
        };
      } else if (data.type === "driver") {
        endpoint = "/api/logistics/drivers";
        payload = {
          fullName: data.name,
          carrierId: data.carrierId || null,
          phone: data.phone,
          licenseNumber: data.licenseNumber,
          licenseExpiry: data.licenseExpiry || null,
          isActive: data.isActive,
        };
      } else if (data.type === "warehouse") {
        endpoint = "/api/logistics/warehouses";
        payload = { 
          name: data.name, 
          description: data.description, 
          address: data.address, 
          storageCost: data.storageCost || null,
          isActive: data.isActive 
        };
      }

      const res = await apiRequest("POST", endpoint, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/logistics/carriers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/logistics/delivery-locations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/logistics/vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/logistics/trailers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/logistics/drivers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/logistics/warehouses"] });
      toast({ title: "Запись добавлена", description: "Новая запись сохранена в справочнике" });
      form.reset();
      setOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      form.reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="button-add-logistics">
          <Plus className="mr-2 h-4 w-4" />
          Добавить
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Новая запись: Логистика</DialogTitle>
          <DialogDescription>Добавление записи в справочник логистики</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Тип</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-logistics-type">
                        <SelectValue placeholder="Выберите тип" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {LOGISTICS_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          <div className="flex items-center gap-2">
                            <t.icon className="h-4 w-4" />
                            {t.label}
                          </div>
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
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {selectedType === "driver" ? "ФИО водителя" : "Название"}
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder={selectedType === "driver" ? "Иванов Иван Иванович" : "Название"} 
                      data-testid="input-logistics-name" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedType === "carrier" && (
              <>
                <FormField
                  control={form.control}
                  name="inn"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ИНН</FormLabel>
                      <FormControl>
                        <Input placeholder="ИНН" data-testid="input-logistics-inn" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="contactPerson"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Контактное лицо</FormLabel>
                      <FormControl>
                        <Input placeholder="ФИО контактного лица" data-testid="input-logistics-contact" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Телефон</FormLabel>
                      <FormControl>
                        <Input placeholder="+7 (XXX) XXX-XX-XX" data-testid="input-logistics-phone" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {selectedType === "delivery_location" && (
              <>
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Адрес</FormLabel>
                      <FormControl>
                        <Input placeholder="Полный адрес" data-testid="input-logistics-address" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Координаты</FormLabel>
                      <FormControl>
                        <Input placeholder="55.7558, 37.6173" data-testid="input-logistics-coordinates" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {(selectedType === "vehicle" || selectedType === "trailer") && (
              <FormField
                control={form.control}
                name="carrierId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Перевозчик</FormLabel>
                    <Select 
                        onValueChange={field.onChange} 
                        value={field.value || ""}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-logistics-carrier">
                            <SelectValue placeholder="Выберите перевозчика" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {carriers.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            {(selectedType === "vehicle" || selectedType === "trailer") && (
              <FormField
                control={form.control}
                name="plateNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Гос. номер</FormLabel>
                    <FormControl>
                      <Input placeholder="А123БВ777" data-testid="input-logistics-plate" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            {selectedType === "vehicle" && (
              <FormField
                control={form.control}
                name="vehicleType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Тип транспорта</FormLabel>
                    <FormControl>
                      <Input placeholder="Бензовоз, Цистерна" data-testid="input-logistics-vehicle-type" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            {(selectedType === "vehicle" || selectedType === "trailer") && (
              <FormField
                control={form.control}
                name="capacityKg"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Вместимость (кг)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Вместимость" data-testid="input-logistics-capacity" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {selectedType === "driver" && (
              <>
                <FormField
                  control={form.control}
                  name="carrierId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Перевозчик</FormLabel>
                      <Select 
                        onValueChange={(v) => field.onChange(v || undefined)} 
                        value={field.value || ""}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-logistics-driver-carrier">
                            <SelectValue placeholder="Выберите перевозчика" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {carriers.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Телефон</FormLabel>
                      <FormControl>
                        <Input placeholder="+7 (XXX) XXX-XX-XX" data-testid="input-logistics-driver-phone" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="licenseNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Номер удостоверения</FormLabel>
                      <FormControl>
                        <Input placeholder="77 АА 123456" data-testid="input-logistics-license" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="licenseExpiry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Срок действия удостоверения</FormLabel>
                      <FormControl>
                        <Input type="date" data-testid="input-logistics-license-expiry" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {selectedType === "warehouse" && (
              <>
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Адрес</FormLabel>
                      <FormControl>
                        <Input placeholder="Полный адрес склада" data-testid="input-logistics-warehouse-address" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="storageCost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Стоимость хранения (₽)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0.00" data-testid="input-storage-cost" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {selectedType === "carrier" && (
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Описание</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Дополнительная информация..." className="resize-none" data-testid="input-logistics-description" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-logistics-active" />
                  </FormControl>
                  <FormLabel className="font-normal cursor-pointer">Активен</FormLabel>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-4 pt-4">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Отмена</Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-logistics">
                {createMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Сохранение...</> : "Создать"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}