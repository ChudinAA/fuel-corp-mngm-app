import { Combobox } from "@/components/ui/combobox";
import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  Plus,
  Loader2,
  Truck,
  MapPin,
  Car,
  Container,
  User,
  Warehouse,
} from "lucide-react";
import type { LogisticsCarrier, Base } from "@shared/schema";
import { BaseTypeBadge } from "@/components/base-type-badge";

export const LOGISTICS_TYPES = [
  { value: "carrier", label: "Перевозчик", icon: Truck },
  { value: "delivery_location", label: "Место доставки", icon: MapPin },
  { value: "vehicle", label: "Транспорт", icon: Car },
  { value: "trailer", label: "Прицеп", icon: Container },
  { value: "driver", label: "Водитель", icon: User },
] as const;

const logisticsFormSchema = z
  .object({
    type: z.enum([
      "carrier",
      "delivery_location",
      "vehicle",
      "trailer",
      "driver",
    ]),
    name: z.string().min(1, "Укажите название"),
    description: z.string().optional(),
    address: z.string().optional(),
    inn: z.string().optional(),
    carrierId: z.string().optional(),
    baseId: z.string().optional(),
    plateNumber: z.string().optional(),
    vehicleType: z.string().optional(),
    capacityKg: z.string().optional(),
    fullName: z.string().optional(),
    phone: z.string().optional(),
    licenseNumber: z.string().optional(),
    licenseExpiry: z.string().optional(),
    notes: z.string().optional(),
    isActive: z.boolean().default(true),
  })
  .refine(
    (data) => {
      if (data.type === "delivery_location" && !data.baseId) {
        return false;
      }
      return true;
    },
    {
      message: "Выберите базис",
      path: ["baseId"],
    },
  );

type LogisticsFormData = z.infer<typeof logisticsFormSchema>;

interface AddLogisticsDialogProps {
  carriers: LogisticsCarrier[];
  editItem?: { type: string; data: any } | null;
  onEditComplete?: () => void;
  isInline?: boolean;
  inlineOpen?: boolean;
  onInlineOpenChange?: (open: boolean) => void;
  onCreated?: (id: string, type: string) => void;
  defaultType?:
    | "carrier"
    | "delivery_location"
    | "vehicle"
    | "trailer"
    | "driver";
}

export function AddLogisticsDialog({
  carriers,
  editItem,
  onEditComplete,
  isInline = false,
  inlineOpen = false,
  onInlineOpenChange,
  onCreated,
  defaultType,
}: AddLogisticsDialogProps) {
  const { toast } = useToast();
  const [localOpen, setLocalOpen] = useState(false);

  const open = isInline ? inlineOpen : localOpen;
  const setOpen = isInline ? onInlineOpenChange || setLocalOpen : setLocalOpen;

  const { data: bases = [] } = useQuery<Base[]>({
    queryKey: ["/api/bases"],
  });

  const form = useForm<LogisticsFormData>({
    resolver: zodResolver(logisticsFormSchema),
    defaultValues: {
      type: defaultType || "carrier",
      name: "",
      description: "",
      isActive: true,
      inn: "",
      contactPerson: "",
      phone: "",
      address: "",
      coordinates: "",
      carrierId: undefined,
      baseId: undefined,
      plateNumber: "",
      vehicleType: "",
      capacityKg: "",
      licenseNumber: "",
      licenseExpiry: "",
      storageCost: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (defaultType && isInline) {
      form.setValue("type", defaultType);
    }
  }, [defaultType, isInline, form]);

  const selectedType = form.watch("type");

  useEffect(() => {
    // Custom reset logic to preserve baseId if needed
    const currentBaseId = form.getValues("baseId");

    form.setValue("inn", "");
    form.setValue("contactPerson", "");
    form.setValue("phone", "");
    form.setValue("address", "");
    form.setValue("coordinates", "");
    form.setValue("carrierId", undefined);

    if (selectedType !== "delivery_location") {
      form.setValue("baseId", undefined);
    } else {
      form.setValue("baseId", currentBaseId);
    }

    form.setValue("plateNumber", "");
    form.setValue("vehicleType", "");
    form.setValue("capacityKg", "");
    form.setValue("licenseNumber", "");
    form.setValue("licenseExpiry", "");
    form.setValue("notes", "");
  }, [selectedType, form]);

  const createMutation = useMutation({
    mutationFn: async (data: LogisticsFormData) => {
      let endpoint = "";
      let payload: Record<string, unknown> = {};

      if (data.type === "carrier") {
        endpoint = editItem
          ? `/api/logistics/carriers/${editItem.data.id}`
          : "/api/logistics/carriers";
        payload = {
          name: data.name,
          description: data.description,
          inn: data.inn,
          contactPerson: data.contactPerson,
          phone: data.phone,
          isActive: data.isActive,
        };
      } else if (data.type === "delivery_location") {
        endpoint = editItem
          ? `/api/logistics/delivery-locations/${editItem.data.id}`
          : "/api/logistics/delivery-locations";
        payload = {
          name: data.name,
          address: data.address,
          notes: data.coordinates,
          baseId: data.baseId || null,
          isActive: data.isActive,
        };
      } else if (data.type === "vehicle") {
        endpoint = editItem
          ? `/api/logistics/vehicles/${editItem.data.id}`
          : "/api/logistics/vehicles";
        payload = {
          regNumber: data.plateNumber,
          carrierId: data.carrierId || null,
          model: data.vehicleType,
          capacityKg: data.capacityKg ? parseFloat(data.capacityKg) : null,
          isActive: data.isActive,
        };
      } else if (data.type === "trailer") {
        endpoint = editItem
          ? `/api/logistics/trailers/${editItem.data.id}`
          : "/api/logistics/trailers";
        payload = {
          regNumber: data.plateNumber,
          carrierId: data.carrierId || null,
          capacityKg: data.capacityKg ? parseFloat(data.capacityKg) : null,
          isActive: data.isActive,
        };
      } else if (data.type === "driver") {
        endpoint = editItem
          ? `/api/logistics/drivers/${editItem.data.id}`
          : "/api/logistics/drivers";
        payload = {
          fullName: data.name,
          carrierId: data.carrierId || null,
          phone: data.phone,
          licenseNumber: data.licenseNumber,
          licenseExpiry: data.licenseExpiry || null,
          isActive: data.isActive,
        };
      }

      const res = await apiRequest(
        editItem ? "PATCH" : "POST",
        endpoint,
        payload,
      );
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/logistics/carriers"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/logistics/delivery-locations"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/logistics/vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/logistics/trailers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/logistics/drivers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prices/find-active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/delivery-costs"] });
      toast({
        title: editItem ? "Запись обновлена" : "Запись добавлена",
        description: editItem
          ? "Изменения сохранены"
          : "Новая запись сохранена в справочнике",
      });
      const currentType = form.getValues("type");
      form.reset({
        type: defaultType || "carrier",
        name: "",
        description: "",
        isActive: true,
        inn: "",
        contactPerson: "",
        phone: "",
        address: "",
        coordinates: "",
        carrierId: undefined,
        baseId: undefined,
        plateNumber: "",
        vehicleType: "",
        capacityKg: "",
        licenseNumber: "",
        licenseExpiry: "",
        notes: "",
      });
      setOpen(false);
      if (onCreated && data?.id) {
        onCreated(data.id, currentType);
      }
      if (onEditComplete) {
        onEditComplete();
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (editItem) {
      setOpen(true);
      const data = editItem.data;
      const formData: any = {
        type: editItem.type,
        isActive: data.isActive,
      };

      if (editItem.type === "carrier") {
        formData.name = data.name;
        formData.description = data.description || "";
        formData.inn = data.inn || "";
        formData.contactPerson = data.contactPerson || "";
        formData.phone = data.phone || "";
      } else if (editItem.type === "delivery_location") {
        formData.name = data.name;
        formData.address = data.address || "";
        formData.notes = data.notes || "";
        formData.baseId = data.baseId || undefined;
      } else if (editItem.type === "vehicle") {
        formData.name = "";
        formData.plateNumber = data.regNumber;
        formData.carrierId = data.carrierId || undefined;
        formData.vehicleType = data.model || "";
        formData.capacityKg = data.capacityKg || "";
      } else if (editItem.type === "trailer") {
        formData.name = "";
        formData.plateNumber = data.regNumber;
        formData.carrierId = data.carrierId || undefined;
        formData.capacityKg = data.capacityKg || "";
      } else if (editItem.type === "driver") {
        formData.name = data.fullName;
        formData.carrierId = data.carrierId || undefined;
        formData.phone = data.phone || "";
        formData.licenseNumber = data.licenseNumber || "";
        formData.licenseExpiry = data.licenseExpiry || "";
      }

      form.reset(formData);
    }
  }, [editItem, form]);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      form.reset({
        type: defaultType || "carrier",
        name: "",
        description: "",
        isActive: true,
        inn: "",
        contactPerson: "",
        phone: "",
        address: "",
        coordinates: "",
        carrierId: undefined,
        baseId: undefined,
        plateNumber: "",
        vehicleType: "",
        capacityKg: "",
        licenseNumber: "",
        licenseExpiry: "",
        notes: "",
      });
      if (onEditComplete) {
        onEditComplete();
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!isInline && (
        <DialogTrigger asChild>
          <Button size="sm" data-testid="button-add-logistics">
            <Plus className="mr-2 h-4 w-4" />
            Добавить
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editItem
              ? "Редактирование записи: Логистика"
              : "Новая запись: Логистика"}
          </DialogTitle>
          <DialogDescription>
            {editItem
              ? "Изменение записи в справочнике"
              : "Добавление записи в справочник логистики"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit((data) => createMutation.mutate(data))(e);
            }}
            className="space-y-4"
          >
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
                      placeholder={
                        selectedType === "driver"
                          ? "Иванов Иван Иванович"
                          : "Название"
                      }
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
                        <Input
                          placeholder="ИНН"
                          data-testid="input-logistics-inn"
                          {...field}
                        />
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
                        <Input
                          placeholder="ФИО контактного лица"
                          data-testid="input-logistics-contact"
                          {...field}
                        />
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
                        <Input
                          placeholder="+7 (XXX) XXX-XX-XX"
                          data-testid="input-logistics-phone"
                          {...field}
                        />
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
                  name="baseId"
                  render={({ field }) => (
                    <FormItem className="col-span-1 min-w-0">
                      <FormLabel>Базис</FormLabel>
                      <FormControl>
                        <div className="w-full">
                          <Combobox
                            options={bases.map((b) => ({
                              value: b.id,
                              label: b.name,
                              render: (
                                <div className="flex items-center gap-2">
                                  {b.name}
                                  <BaseTypeBadge type={b.baseType} />
                                </div>
                              )
                            }))}
                            value={field.value || ""}
                            onValueChange={(v) => field.onChange(v || undefined)}
                            placeholder="Выберите базис"
                            className="w-full"
                            dataTestId="select-logistics-base"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Адрес</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Полный адрес"
                          data-testid="input-logistics-address"
                          {...field}
                        />
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
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
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
                      <Input
                        placeholder="А123БВ777"
                        data-testid="input-logistics-plate"
                        {...field}
                      />
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
                      <Input
                        placeholder="Бензовоз, Цистерна"
                        data-testid="input-logistics-vehicle-type"
                        {...field}
                      />
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
                      <Input
                        type="number"
                        placeholder="Вместимость"
                        data-testid="input-logistics-capacity"
                        {...field}
                      />
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
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
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
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Телефон</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="+7 (XXX) XXX-XX-XX"
                          data-testid="input-logistics-driver-phone"
                          {...field}
                        />
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
                        <Input
                          placeholder="77 АА 123456"
                          data-testid="input-logistics-license"
                          {...field}
                        />
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
                        <Input
                          type="date"
                          data-testid="input-logistics-license-expiry"
                          {...field}
                        />
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
                      <Textarea
                        placeholder="Дополнительная информация..."
                        className="resize-none"
                        data-testid="input-logistics-description"
                        {...field}
                      />
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
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-logistics-active"
                    />
                  </FormControl>
                  <FormLabel className="font-normal cursor-pointer">
                    Активен
                  </FormLabel>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Отмена
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                data-testid="button-save-logistics"
                onClick={(e) => e.stopPropagation()}
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Сохранение...
                  </>
                ) : editItem ? (
                  "Сохранить"
                ) : (
                  "Создать"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
