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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Loader2, Plane, MapPin, ChevronDown, ChevronUp } from "lucide-react";
import type { RefuelingProvider, RefuelingBase } from "@shared/schema";

const REFUELING_TYPES = [
  { value: "provider", label: "Аэропорт/Поставщик", icon: Plane },
  { value: "basis", label: "Базис заправки", icon: MapPin },
] as const;

const refuelingFormSchema = z.object({
  type: z.enum(["provider", "basis"]),
  name: z.string().min(1, "Укажите название"),
  location: z.string().optional(),
  description: z.string().optional(),
  servicePrice: z.string().optional(),
  pvkjPrice: z.string().optional(),
  agentFee: z.string().optional(),
  defaultBaseId: z.number().optional(),
  isActive: z.boolean().default(true),
});

type RefuelingFormData = z.infer<typeof refuelingFormSchema>;

export function AddRefuelingDialog({ providers, bases }: { providers: RefuelingProvider[]; bases: RefuelingBase[] }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [showPriceFields, setShowPriceFields] = useState(false);

  const form = useForm<RefuelingFormData>({
    resolver: zodResolver(refuelingFormSchema),
    defaultValues: {
      type: "provider",
      name: "",
      location: "",
      description: "",
      servicePrice: "",
      pvkjPrice: "",
      agentFee: "",
      defaultBaseId: undefined,
      isActive: true,
    },
  });

  const selectedType = form.watch("type");

  useEffect(() => {
    form.setValue("location", "");
    form.setValue("servicePrice", "");
    form.setValue("pvkjPrice", "");
    form.setValue("agentFee", "");
  }, [selectedType, form]);

  const createRefuelingMutation = useMutation({
    mutationFn: async (data: RefuelingFormData) => {
      const endpoint = data.type === "provider" ? "/api/refueling/providers" : "/api/refueling/bases";
      const payload = data.type === "provider" 
        ? { 
            name: data.name, 
            description: data.description, 
            servicePrice: data.servicePrice || null,
            pvkjPrice: data.pvkjPrice || null,
            agentFee: data.agentFee || null,
            defaultBaseId: data.defaultBaseId || null,
            isActive: data.isActive 
          }
        : { name: data.name, location: data.location, isActive: data.isActive };

      const res = await apiRequest("POST", endpoint, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/refueling/providers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/refueling/bases"] });
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
      setShowPriceFields(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="button-add-refueling">
          <Plus className="mr-2 h-4 w-4" />
          Добавить
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Новая запись: Заправка ВС</DialogTitle>
          <DialogDescription>Добавление записи в справочник заправки воздушных судов</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => createRefuelingMutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Тип</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-refueling-type">
                        <SelectValue placeholder="Выберите тип" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {REFUELING_TYPES.map((t) => (
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
                  <FormLabel>Название</FormLabel>
                  <FormControl>
                    <Input placeholder="Название" data-testid="input-refueling-name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedType === "provider" && (
              <>
                <Collapsible open={showPriceFields} onOpenChange={setShowPriceFields}>
                  <div className="flex justify-between items-center">
                    <FormLabel>Ценообразование</FormLabel>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="icon" type="button">
                        {showPriceFields ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                  <CollapsibleContent className="grid grid-cols-3 gap-3">
                    <FormField
                      control={form.control}
                      name="servicePrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Стоимость услуги</FormLabel>
                          <FormControl>
                            <Input placeholder="0.00" type="number" step="0.01" data-testid="input-service-price" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="pvkjPrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Стоимость ПВКЖ</FormLabel>
                          <FormControl>
                            <Input placeholder="0.00" type="number" step="0.01" data-testid="input-pvkj-price" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="agentFee"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Агентские/прочие</FormLabel>
                          <FormControl>
                            <Input placeholder="0.00" type="number" step="0.01" data-testid="input-agent-fee" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CollapsibleContent>
                </Collapsible>
                <FormField
                  control={form.control}
                  name="defaultBaseId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Базис заправки</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value || ""}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-refueling-provider-basis">
                            <SelectValue placeholder="Выберите базис" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {bases.map((b) => (
                            <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {selectedType === "basis" && (
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Местоположение</FormLabel>
                    <FormControl>
                      <Input placeholder="Местоположение" data-testid="input-refueling-location" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Описание</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Дополнительная информация..." className="resize-none" data-testid="input-refueling-description" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-refueling-active" />
                  </FormControl>
                  <FormLabel className="font-normal cursor-pointer">Активен</FormLabel>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-4 pt-4">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Отмена</Button>
              <Button type="submit" disabled={createRefuelingMutation.isPending} data-testid="button-save-refueling">
                {createRefuelingMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Сохранение...</> : "Создать"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}