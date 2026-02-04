import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CUSTOMER_MODULE } from "@shared/constants";
import type { CustomerModule } from "@shared/constants";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
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
import { Switch } from "@/components/ui/switch";
import { Plus, Loader2 } from "lucide-react";
import type { Base, Customer } from "@shared/schema";
import { Combobox } from "@/components/ui/combobox";
import { BaseTypeBadge } from "@/components/base-type-badge";

const customerFormSchema = z.object({
  name: z.string().min(1, "Укажите название"),
  module: z.enum([
    CUSTOMER_MODULE.WHOLESALE,
    CUSTOMER_MODULE.REFUELING,
    CUSTOMER_MODULE.BOTH,
  ]),
  description: z.string().optional(),
  baseIds: z.array(z.string().optional()),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Неверный формат email").optional().or(z.literal("")),
  inn: z.string().optional(),
  contractNumber: z.string().optional(),
  isIntermediary: z.boolean().default(false),
  isForeign: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

type CustomerFormData = z.infer<typeof customerFormSchema>;

interface AddCustomerDialogProps {
  bases: Base[];
  editCustomer?: Customer | null;
  onEditComplete?: () => void;
  isInline?: boolean;
  inlineOpen?: boolean;
  onInlineOpenChange?: (open: boolean) => void;
  onCreated?: (id: string) => void;
}

export function AddCustomerDialog({
  bases,
  editCustomer,
  onEditComplete,
  isInline = false,
  inlineOpen = false,
  onInlineOpenChange,
  onCreated,
}: AddCustomerDialogProps) {
  const { toast } = useToast();
  const [localOpen, setLocalOpen] = useState(false);

  const open = isInline ? inlineOpen : localOpen;
  const setOpen = isInline ? onInlineOpenChange || setLocalOpen : setLocalOpen;

  const form = useForm<CustomerFormData>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      name: "",
      module: CUSTOMER_MODULE.BOTH,
      description: "",
      baseIds: [""],
      contactPerson: "",
      phone: "",
      email: "",
      inn: "",
      contractNumber: "",
      isIntermediary: false,
      isForeign: false,
      isActive: true,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "baseIds",
  });

  useEffect(() => {
    if (editCustomer) {
      setOpen(true);
      const baseIdsArray =
        editCustomer.baseIds && editCustomer.baseIds.length > 0
          ? editCustomer.baseIds
          : [""];
      form.reset({
        name: editCustomer.name,
        module: editCustomer.module as CustomerModule,
        description: editCustomer.description || "",
        baseIds: baseIdsArray,
        contactPerson: editCustomer.contactPerson || "",
        phone: editCustomer.phone || "",
        email: editCustomer.email || "",
        inn: editCustomer.inn || "",
        contractNumber: editCustomer.contractNumber || "",
        isIntermediary: editCustomer.isIntermediary || false,
        isForeign: editCustomer.isForeign || false,
        isActive: editCustomer.isActive,
      });
    }
  }, [editCustomer, form]);

  const createMutation = useMutation({
    mutationFn: async (data: CustomerFormData) => {
      const filteredBaseIds = data.baseIds.filter(
        (id) => id && id.trim() !== "",
      );
      const payload = {
        name: data.name,
        module: data.module,
        description: data.description,
        baseIds: filteredBaseIds.length > 0 ? filteredBaseIds : null,
        contactPerson: data.contactPerson,
        phone: data.phone,
        email: data.email || null,
        inn: data.inn,
        contractNumber: data.contractNumber,
        isIntermediary: data.isIntermediary,
        isForeign: data.isForeign,
        isActive: data.isActive,
      };

      if (editCustomer) {
        const res = await apiRequest(
          "PATCH",
          `/api/customers/${editCustomer.id}`,
          payload,
        );
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/customers", payload);
        return res.json();
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({
        title: editCustomer ? "Покупатель обновлен" : "Покупатель добавлен",
        description: editCustomer
          ? "Изменения сохранены"
          : "Новый покупатель сохранен в справочнике",
      });
      form.reset({
        name: "",
        module: CUSTOMER_MODULE.BOTH,
        description: "",
        baseIds: [""],
        contactPerson: "",
        phone: "",
        email: "",
        inn: "",
        contractNumber: "",
        isIntermediary: false,
        isForeign: false,
        isActive: true,
      });
      setOpen(false);
      if (onCreated && data?.id) {
        onCreated(data.id);
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

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      form.reset({
        name: "",
        module: CUSTOMER_MODULE.BOTH,
        description: "",
        baseIds: [""],
        contactPerson: "",
        phone: "",
        email: "",
        inn: "",
        contractNumber: "",
        isIntermediary: false,
        isForeign: false,
        isActive: true,
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
          <Button size="sm" data-testid="button-add-customer">
            <Plus className="mr-2 h-4 w-4" />
            Добавить
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editCustomer ? "Редактирование покупателя" : "Новый покупатель"}
          </DialogTitle>
          <DialogDescription>
            {editCustomer
              ? "Изменение данных покупателя"
              : "Добавление покупателя в справочник"}
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
              name="module"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Модуль</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-customer-module">
                        <SelectValue placeholder="Выберите модуль" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={CUSTOMER_MODULE.BOTH}>
                        Общий (ОПТ и Заправка)
                      </SelectItem>
                      <SelectItem value={CUSTOMER_MODULE.WHOLESALE}>
                        Только ОПТ
                      </SelectItem>
                      <SelectItem value={CUSTOMER_MODULE.REFUELING}>
                        Только Заправка ВС
                      </SelectItem>
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
                  <FormLabel>Название</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Название покупателя"
                      data-testid="input-customer-name"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <FormLabel>Базисы</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append("")}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-2 items-center">
                  <div className="flex-1 min-w-0">
                    <Combobox
                      options={bases.map((b) => ({
                        value: b.id,
                        label: b.name,
                        render: (
                          <div className="flex items-center gap-2">
                            {b.name}
                            <BaseTypeBadge type={b.baseType} />
                          </div>
                        ),
                      }))}
                      value={form.watch(`baseIds.${index}`) || ""}
                      onValueChange={(value) =>
                        form.setValue(`baseIds.${index}`, value)
                      }
                      placeholder="Выберите базис"
                      className="w-full"
                      dataTestId={`select-base-${index}`}
                    />
                  </div>
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(index)}
                      className="shrink-0 h-9 w-9"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {/* <FormField
              control={form.control}
              name="contactPerson"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Контактное лицо</FormLabel>
                  <FormControl>
                    <Input placeholder="ФИО контактного лица" data-testid="input-customer-contact" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            /> */}

            {/* <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Телефон</FormLabel>
                    <FormControl>
                      <Input placeholder="+7 (XXX) XXX-XX-XX" data-testid="input-customer-phone" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="email@example.com" type="email" data-testid="input-customer-email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="inn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ИНН</FormLabel>
                    <FormControl>
                      <Input placeholder="ИНН" data-testid="input-customer-inn" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contractNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Номер договора</FormLabel>
                    <FormControl>
                      <Input placeholder="Номер договора" data-testid="input-customer-contract" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div> */}

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
                      data-testid="input-customer-description"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="isIntermediary"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-customer-intermediary"
                      />
                    </FormControl>
                    <FormLabel className="font-normal cursor-pointer text-sm">
                      Посредник
                    </FormLabel>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="isForeign"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-customer-foreign"
                      />
                    </FormControl>
                    <FormLabel className="font-normal cursor-pointer text-sm">
                      Зарубеж
                    </FormLabel>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-customer-active"
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
                data-testid="button-save-customer"
                onClick={(e) => e.stopPropagation()}
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Сохранение...
                  </>
                ) : editCustomer ? (
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
