import { Combobox } from "@/components/ui/combobox";
import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Plus, Loader2 } from "lucide-react";
import type { Base } from "@shared/schema";
import { BASE_TYPE, BaseType } from "@shared/constants";

const baseFormSchema = z.object({
  name: z.string().min(1, "Укажите название"),
  baseType: z.enum(
    [BASE_TYPE.WHOLESALE, BASE_TYPE.REFUELING, BASE_TYPE.ABROAD],
    {
      required_error: "Выберите тип базиса",
    },
  ),
  location: z.string().optional(),
  isActive: z.boolean().default(true),
});

type BaseFormData = z.infer<typeof baseFormSchema>;

interface AddBaseDialogProps {
  editItem?: Base | null;
  onEditComplete?: () => void;
  isInline?: boolean;
  inlineOpen?: boolean;
  onInlineOpenChange?: (open: boolean) => void;
  onCreated?: (id: string) => void;
}

export function AddBaseDialog({
  editItem,
  onEditComplete,
  isInline = false,
  inlineOpen = false,
  onInlineOpenChange,
  onCreated,
}: AddBaseDialogProps) {
  const { toast } = useToast();
  const [localOpen, setLocalOpen] = useState(false);

  const open = isInline ? inlineOpen : localOpen;
  const setOpen = isInline ? onInlineOpenChange || setLocalOpen : setLocalOpen;

  const form = useForm<BaseFormData>({
    resolver: zodResolver(baseFormSchema),
    defaultValues: {
      name: "",
      baseType: BASE_TYPE.WHOLESALE,
      location: "",
      isActive: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: BaseFormData) => {
      const endpoint = editItem ? `/api/bases/${editItem.id}` : "/api/bases";
      const res = await apiRequest(editItem ? "PATCH" : "POST", endpoint, data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bases"] });
      toast({
        title: editItem ? "Базис обновлен" : "Базис добавлен",
        description: editItem
          ? "Изменения сохранены"
          : "Новый базис сохранен в справочнике",
      });
      form.reset({
        name: "",
        baseType: BASE_TYPE.WHOLESALE,
        location: "",
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

  useEffect(() => {
    if (editItem) {
      setOpen(true);
      form.reset({
        name: editItem.name,
        baseType: editItem.baseType as BaseType,
        location: editItem.location || "",
        isActive: editItem.isActive,
      });
    }
  }, [editItem, form]);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      form.reset({
        name: "",
        baseType: BASE_TYPE.WHOLESALE,
        location: "",
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
          <Button size="sm" data-testid="button-add-base">
            <Plus className="mr-2 h-4 w-4" />
            Добавить
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editItem ? "Редактирование базиса" : "Новый базис"}
          </DialogTitle>
          <DialogDescription>
            {editItem
              ? "Изменение записи в справочнике"
              : "Добавление нового базиса"}
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
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Название</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Название"
                      data-testid="input-base-name"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="baseType"
              render={({ field }) => (
                <FormItem className="col-span-1 min-w-0">
                  <FormLabel>Тип базиса</FormLabel>
                  <FormControl>
                    <div className="w-full">
                      <Combobox
                        options={[
                          { value: BASE_TYPE.WHOLESALE, label: "ОПТ" },
                          { value: BASE_TYPE.REFUELING, label: "Заправка" },
                          { value: BASE_TYPE.ABROAD, label: "Зарубеж" },
                        ]}
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder="Выберите тип"
                        className="w-full"
                        dataTestId="select-base-type"
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Местоположение</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Местоположение"
                      data-testid="input-base-location"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
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
                data-testid="button-save-base"
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
