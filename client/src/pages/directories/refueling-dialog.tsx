
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
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Loader2, Plane, MapPin, ChevronDown, ChevronUp, X } from "lucide-react";
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
  baseIds: z.array(z.string()).default([]),
  isWarehouse: z.boolean().default(false),
  storageCost: z.string().optional(),
  isActive: z.boolean().default(true),
});

type RefuelingFormData = z.infer<typeof refuelingFormSchema>;

export function AddRefuelingDialog({ 
  providers, 
  bases,
  editItem,
  onEditComplete
}: { 
  providers: RefuelingProvider[]; 
  bases: RefuelingBase[];
  editItem?: { type: "provider" | "basis"; data: RefuelingProvider | RefuelingBase } | null;
  onEditComplete?: () => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [showPriceFields, setShowPriceFields] = useState(false);
  const [selectedBases, setSelectedBases] = useState<string[]>([""]);

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
      baseIds: [],
      isWarehouse: false,
      storageCost: "",
      isActive: true,
    },
  });

  const selectedType = form.watch("type");
  const isWarehouse = form.watch("isWarehouse");

  useEffect(() => {
    form.setValue("location", "");
    form.setValue("servicePrice", "");
    form.setValue("pvkjPrice", "");
    form.setValue("agentFee", "");
    form.setValue("isWarehouse", false);
    form.setValue("storageCost", "");
  }, [selectedType, form]);

  const createRefuelingMutation = useMutation({
    mutationFn: async (data: RefuelingFormData) => {
      let endpoint = "";
      if (editItem) {
        endpoint = data.type === "provider" 
          ? `/api/refueling/providers/${editItem.data.id}` 
          : `/api/refueling/bases/${editItem.data.id}`;
      } else {
        endpoint = data.type === "provider" ? "/api/refueling/providers" : "/api/refueling/bases";
      }
      
      const payload = data.type === "provider" 
        ? { 
            name: data.name, 
            description: data.description, 
            servicePrice: data.servicePrice || null,
            pvkjPrice: data.pvkjPrice || null,
            agentFee: data.agentFee || null,
            baseIds: data.baseIds.filter(id => id),
            isWarehouse: data.isWarehouse,
            storageCost: data.isWarehouse && data.storageCost ? data.storageCost : null,
            isActive: data.isActive 
          }
        : { name: data.name, location: data.location, isActive: data.isActive };

      const res = await apiRequest(editItem ? "PATCH" : "POST", endpoint, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/refueling/providers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/refueling/bases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
      toast({ 
        title: editItem ? "Запись обновлена" : "Запись добавлена", 
        description: editItem ? "Изменения сохранены" : "Новая запись сохранена в справочнике" 
      });
      form.reset();
      setSelectedBases([""]);
      setOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (editItem) {
      setOpen(true);
      const data = editItem.data as any;
      const baseIdsArray = data.baseIds || [];
      form.reset({
        type: editItem.type,
        name: data.name,
        location: data.location || "",
        description: data.description || "",
        servicePrice: data.servicePrice || "",
        pvkjPrice: data.pvkjPrice || "",
        agentFee: data.agentFee || "",
        baseIds: baseIdsArray,
        isWarehouse: data.isWarehouse || false,
        storageCost: data.storageCost || "",
        isActive: data.isActive,
      });
      setSelectedBases(baseIdsArray.length > 0 ? baseIdsArray : [""]);
      if (editItem.type === "provider" && (data.servicePrice || data.pvkjPrice || data.agentFee)) {
        setShowPriceFields(true);
      }
    }
  }, [editItem, form]);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      form.reset();
      setSelectedBases([""]);
      setShowPriceFields(false);
      if (onEditComplete) {
        onEditComplete();
      }
    } else if (isOpen && !editItem) {
      form.reset({
        type: "provider",
        name: "",
        location: "",
        description: "",
        servicePrice: "",
        pvkjPrice: "",
        agentFee: "",
        baseIds: [],
        isWarehouse: false,
        storageCost: "",
        isActive: true,
      });
      setSelectedBases([""]);
      setShowPriceFields(false);
    }
  };

  const handleAddBase = () => {
    setSelectedBases([...selectedBases, ""]);
  };

  const handleRemoveBase = (index: number) => {
    const newBases = selectedBases.filter((_, i) => i !== index);
    setSelectedBases(newBases.length > 0 ? newBases : [""]);
    form.setValue("baseIds", newBases.filter(id => id));
  };

  const handleBaseChange = (index: number, value: string) => {
    const newBases = [...selectedBases];
    newBases[index] = value;
    setSelectedBases(newBases);
    form.setValue("baseIds", newBases.filter(id => id));
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="button-add-refueling">
          <Plus className="mr-2 h-4 w-4" />
          Добавить
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editItem ? "Редактирование записи: Заправка ВС" : "Новая запись: Заправка ВС"}</DialogTitle>
          <DialogDescription>{editItem ? "Изменение записи в справочнике" : "Добавление записи в справочник заправки воздушных судов"}</DialogDescription>
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

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <FormLabel>Базисы заправки</FormLabel>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleAddBase}
                      data-testid="button-add-base"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Добавить
                    </Button>
                  </div>
                  {selectedBases.map((baseId, index) => (
                    <div key={index} className="flex gap-2">
                      <Select 
                        value={baseId}
                        onValueChange={(value) => handleBaseChange(index, value)}
                      >
                        <SelectTrigger data-testid={`select-base-${index}`}>
                          <SelectValue placeholder="Выберите базис" />
                        </SelectTrigger>
                        <SelectContent>
                          {bases.map((b) => (
                            <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedBases.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveBase(index)}
                          data-testid={`button-remove-base-${index}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                <FormField
                  control={form.control}
                  name="isWarehouse"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0 rounded-md border p-3">
                      <FormControl>
                        <Checkbox 
                          checked={field.value} 
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-is-warehouse"
                        />
                      </FormControl>
                      <FormLabel className="font-normal cursor-pointer">
                        Является складом
                      </FormLabel>
                    </FormItem>
                  )}
                />

                {isWarehouse && (
                  <FormField
                    control={form.control}
                    name="storageCost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Стоимость хранения на складе (₽)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="0.00" 
                            type="number" 
                            step="0.01" 
                            data-testid="input-storage-cost" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
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
                {createRefuelingMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Сохранение...</> : editItem ? "Сохранить" : "Создать"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
