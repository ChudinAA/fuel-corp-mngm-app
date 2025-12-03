import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Loader2,
  Search,
  BookOpen,
  Building2,
  Truck,
  Plane,
  Users,
  MapPin,
  Car,
  Container,
  User,
  Warehouse
} from "lucide-react";
import type { 
  Customer, 
  WholesaleSupplier, 
  WholesaleBase, 
  RefuelingProvider, 
  RefuelingBase, 
  LogisticsCarrier,
  LogisticsDeliveryLocation,
  LogisticsVehicle,
  LogisticsTrailer,
  LogisticsDriver,
  LogisticsWarehouse
} from "@shared/schema";

// ============ TYPE DEFINITIONS ============

const WHOLESALE_TYPES = [
  { value: "supplier", label: "Поставщик", icon: Building2 },
  { value: "basis", label: "Базис поставки", icon: MapPin },
] as const;

const REFUELING_TYPES = [
  { value: "provider", label: "Аэропорт/Поставщик", icon: Plane },
  { value: "basis", label: "Базис заправки", icon: MapPin },
] as const;

const LOGISTICS_TYPES = [
  { value: "carrier", label: "Перевозчик", icon: Truck },
  { value: "delivery_location", label: "Место доставки", icon: MapPin },
  { value: "vehicle", label: "Транспорт", icon: Car },
  { value: "trailer", label: "Прицеп", icon: Container },
  { value: "driver", label: "Водитель", icon: User },
  { value: "warehouse", label: "Склад/Базис", icon: Warehouse },
] as const;

type WholesaleType = typeof WHOLESALE_TYPES[number]["value"];
type RefuelingType = typeof REFUELING_TYPES[number]["value"];
type LogisticsType = typeof LOGISTICS_TYPES[number]["value"];

// ============ WHOLESALE TAB ============

function WholesaleTab() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<WholesaleType | "all">("all");

  const { data: suppliers, isLoading: suppliersLoading } = useQuery<WholesaleSupplier[]>({
    queryKey: ["/api/wholesale/suppliers"],
  });

  const { data: bases, isLoading: basesLoading } = useQuery<WholesaleBase[]>({
    queryKey: ["/api/wholesale/bases"],
  });

  const isLoading = suppliersLoading || basesLoading;

  const allItems = [
    ...(suppliers?.map(s => ({ ...s, type: "supplier" as const, typeName: "Поставщик" })) || []),
    ...(bases?.map(b => ({ ...b, type: "basis" as const, typeName: "Базис" })) || []),
  ];

  const filteredItems = allItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || item.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const getSupplierName = (supplierId: number | null | undefined) => {
    if (!supplierId) return null;
    return suppliers?.find(s => s.id === supplierId)?.name || null;
  };

  const getBaseName = (baseId: number | null | undefined) => {
    if (!baseId) return null;
    return bases?.find(b => b.id === baseId)?.name || null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Справочник ОПТ
        </CardTitle>
        <CardDescription>Поставщики, покупатели и базисы для оптовых операций</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Поиск..." 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
                className="pl-9" 
                data-testid="input-search-wholesale" 
              />
            </div>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as WholesaleType | "all")}>
              <SelectTrigger className="w-[180px]" data-testid="select-wholesale-type-filter">
                <SelectValue placeholder="Все типы" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все типы</SelectItem>
                {WHOLESALE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <AddWholesaleDialog suppliers={suppliers || []} bases={bases || []} />
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Тип</TableHead>
                    <TableHead>Название</TableHead>
                    <TableHead>Базис поставки</TableHead>
                    <TableHead>Доп. информация</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        Нет данных
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredItems.map((item) => (
                      <TableRow key={`${item.type}-${item.id}`} data-testid={`row-wholesale-${item.type}-${item.id}`}>
                        <TableCell>
                          <Badge variant="outline">{item.typeName}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>
                          {item.type === "supplier" 
                            ? getBaseName((item as WholesaleSupplier & { type: string }).defaultBaseId) || "—"
                            : item.type === "basis" 
                              ? getSupplierName((item as WholesaleBase & { type: string }).supplierId) || "—"
                              : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-xs truncate">
                          {item.type === "supplier" 
                            ? (item as WholesaleSupplier & { type: string }).inn || "—" 
                            : (item as WholesaleBase & { type: string }).location || "—"}
                        </TableCell>
                        <TableCell>
                          {item.isActive ? (
                            <Badge variant="outline" className="text-green-600 border-green-600">Активен</Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">Неактивен</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" data-testid={`button-edit-${item.type}-${item.id}`}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive" data-testid={`button-delete-${item.type}-${item.id}`}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============ ADD WHOLESALE DIALOG ============

const wholesaleFormSchema = z.object({
  type: z.enum(["supplier", "basis"]),
  name: z.string().min(1, "Укажите название"),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  defaultBaseId: z.number().optional(),
  location: z.string().optional(),
});

type WholesaleFormData = z.infer<typeof wholesaleFormSchema>;

function AddWholesaleDialog({ suppliers, bases }: { suppliers: WholesaleSupplier[]; bases: WholesaleBase[] }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const form = useForm<WholesaleFormData>({
    resolver: zodResolver(wholesaleFormSchema),
    defaultValues: {
      type: "supplier",
      name: "",
      description: "",
      isActive: true,
      defaultBaseId: undefined,
      location: "",
    },
  });

  const selectedType = form.watch("type");

  useEffect(() => {
    form.setValue("location", "");
  }, [selectedType, form]);

  const createMutation = useMutation({
    mutationFn: async (data: WholesaleFormData) => {
      let endpoint = "";
      let payload: Record<string, unknown> = {};

      if (data.type === "supplier") {
        endpoint = "/api/wholesale/suppliers";
        payload = {
          name: data.name,
          description: data.description,
          defaultBaseId: data.defaultBaseId || null,
          isActive: data.isActive,
        };
      } else if (data.type === "basis") {
        endpoint = "/api/wholesale/bases";
        payload = {
          name: data.name,
          location: data.location,
          isActive: data.isActive,
        };
      }

      const res = await apiRequest("POST", endpoint, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wholesale/suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wholesale/bases"] });
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
        <Button size="sm" data-testid="button-add-wholesale">
          <Plus className="mr-2 h-4 w-4" />
          Добавить
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Новая запись: ОПТ</DialogTitle>
          <DialogDescription>Добавление записи в справочник оптовых операций</DialogDescription>
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
                      <SelectTrigger data-testid="select-wholesale-type">
                        <SelectValue placeholder="Выберите тип" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {WHOLESALE_TYPES.map((t) => (
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
                    <Input placeholder="Название" data-testid="input-wholesale-name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedType === "supplier" && (
              <FormField
                control={form.control}
                name="defaultBaseId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Базис поставки</FormLabel>
                    <Select 
                      onValueChange={(v) => field.onChange(v ? parseInt(v) : undefined)} 
                      value={field.value?.toString() || ""}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-wholesale-supplier-basis">
                          <SelectValue placeholder="Выберите базис" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {bases.map((b) => (
                          <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {selectedType === "basis" && (
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Местоположение</FormLabel>
                    <FormControl>
                      <Input placeholder="Местоположение" data-testid="input-wholesale-location" {...field} />
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
                    <Textarea placeholder="Дополнительная информация..." className="resize-none" data-testid="input-wholesale-description" {...field} />
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
                    <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-wholesale-active" />
                  </FormControl>
                  <FormLabel className="font-normal cursor-pointer">Активен</FormLabel>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-4 pt-4">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Отмена</Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-wholesale">
                {createMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Сохранение...</> : "Создать"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ============ REFUELING TAB ============

function RefuelingTab() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<RefuelingType | "all">("all");

  const { data: providers, isLoading: providersLoading } = useQuery<RefuelingProvider[]>({
    queryKey: ["/api/refueling/providers"],
  });

  const { data: bases = [] } = useQuery<RefuelingBase[]>({
    queryKey: ["/api/refueling/bases"],
  });

  const isLoading = providersLoading;

  const allItems = [
    ...(providers?.map(p => ({ ...p, type: "provider" as const, typeName: "Аэропорт/Поставщик" })) || []),
    ...(bases?.map(b => ({ ...b, type: "basis" as const, typeName: "Базис" })) || []),
  ];

  const filteredItems = allItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || item.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const getProviderName = (providerId: number | null | undefined) => {
    if (!providerId) return null;
    return providers?.find(p => p.id === providerId)?.name || null;
  };

  const getBaseName = (baseId: number | null | undefined) => {
    if (!baseId) return null;
    return bases?.find(b => b.id === baseId)?.name || null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plane className="h-5 w-5" />
          Справочник Заправка ВС
        </CardTitle>
        <CardDescription>Аэропорты, поставщики и базисы для заправки воздушных судов</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Поиск..." 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
                className="pl-9" 
                data-testid="input-search-refueling" 
              />
            </div>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as RefuelingType | "all")}>
              <SelectTrigger className="w-[200px]" data-testid="select-refueling-type-filter">
                <SelectValue placeholder="Все типы" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все типы</SelectItem>
                {REFUELING_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <AddRefuelingDialog providers={providers || []} bases={bases || []} />
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[160px]">Тип</TableHead>
                    <TableHead>Название</TableHead>
                    <TableHead>Базис заправки</TableHead>
                    <TableHead>Доп. информация</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        <Plane className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        Нет данных
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredItems.map((item) => (
                      <TableRow key={`${item.type}-${item.id}`} data-testid={`row-refueling-${item.type}-${item.id}`}>
                        <TableCell>
                          <Badge variant="outline">{item.typeName}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>
                          {item.type === "provider" 
                            ? getBaseName((item as RefuelingProvider & { type: string }).defaultBaseId) 
                            : item.type === "basis"
                              ? "—"
                              : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-xs truncate">
                          {item.type === "provider" 
                            ? (item as RefuelingProvider & { type: string }).icaoCode || "—"
                            : (item as RefuelingBase & { type: string }).location || "—"}
                        </TableCell>
                        <TableCell>
                          {item.isActive ? (
                            <Badge variant="outline" className="text-green-600 border-green-600">Активен</Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">Неактивен</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" data-testid={`button-edit-${item.type}-${item.id}`}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive" data-testid={`button-delete-${item.type}-${item.id}`}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============ ADD REFUELING DIALOG ============

const refuelingFormSchema = z.object({
  type: z.enum(["provider", "basis"]),
  name: z.string().min(1, "Введите название"),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  defaultBaseId: z.number().optional(),
  location: z.string().optional(),
});

type RefuelingFormData = z.infer<typeof refuelingFormSchema>;

function AddRefuelingDialog({ providers, bases }: { providers: RefuelingProvider[]; bases: RefuelingBase[] }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const form = useForm<RefuelingFormData>({
    resolver: zodResolver(refuelingFormSchema),
    defaultValues: {
      type: "provider",
      name: "",
      description: "",
      isActive: true,
      defaultBaseId: undefined,
      location: "",
    },
  });

  const selectedType = form.watch("type");

  useEffect(() => {
    form.setValue("location", "");
  }, [selectedType, form]);

  const createMutation = useMutation({
    mutationFn: async (data: RefuelingFormData) => {
      let endpoint = "";
      let payload: Record<string, unknown> = {};

      if (data.type === "provider") {
        endpoint = "/api/refueling/providers";
        payload = {
          name: data.name,
          description: data.description,
          defaultBaseId: data.defaultBaseId || null,
          isActive: data.isActive,
        };
      } else if (data.type === "basis") {
        endpoint = "/api/refueling/bases";
        payload = {
          name: data.name,
          location: data.location,
          isActive: data.isActive,
        };
      }

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
          <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
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
              <FormField
                control={form.control}
                name="defaultBaseId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Базис заправки</FormLabel>
                    <Select 
                      onValueChange={(v) => field.onChange(v ? parseInt(v) : undefined)} 
                      value={field.value?.toString() || ""}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-refueling-provider-basis">
                          <SelectValue placeholder="Выберите базис" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {bases.map((b) => (
                          <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-refueling">
                {createMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Сохранение...</> : "Создать"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ============ LOGISTICS TAB ============

function LogisticsTab() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<LogisticsType | "all">("all");

  const { data: carriers, isLoading: carriersLoading } = useQuery<LogisticsCarrier[]>({
    queryKey: ["/api/logistics/carriers"],
  });

  const { data: deliveryLocations, isLoading: locationsLoading } = useQuery<LogisticsDeliveryLocation[]>({
    queryKey: ["/api/logistics/delivery-locations"],
  });

  const { data: vehicles, isLoading: vehiclesLoading } = useQuery<LogisticsVehicle[]>({
    queryKey: ["/api/logistics/vehicles"],
  });

  const { data: trailers, isLoading: trailersLoading } = useQuery<LogisticsTrailer[]>({
    queryKey: ["/api/logistics/trailers"],
  });

  const { data: drivers, isLoading: driversLoading } = useQuery<LogisticsDriver[]>({
    queryKey: ["/api/logistics/drivers"],
  });

  const { data: warehouses, isLoading: warehousesLoading } = useQuery<LogisticsWarehouse[]>({
    queryKey: ["/api/logistics/warehouses"],
  });

  const isLoading = carriersLoading || locationsLoading || vehiclesLoading || trailersLoading || driversLoading || warehousesLoading;

  const allItems = [
    ...(carriers?.map(c => ({ ...c, type: "carrier" as const, typeName: "Перевозчик" })) || []),
    ...(deliveryLocations?.map(d => ({ ...d, type: "delivery_location" as const, typeName: "Место доставки" })) || []),
    ...(vehicles?.map(v => ({ ...v, type: "vehicle" as const, typeName: "Транспорт" })) || []),
    ...(trailers?.map(t => ({ ...t, type: "trailer" as const, typeName: "Прицеп" })) || []),
    ...(drivers?.map(d => ({ ...d, type: "driver" as const, typeName: "Водитель" })) || []),
    ...(warehouses?.map(w => ({ ...w, type: "warehouse" as const, typeName: "Склад/Базис" })) || []),
  ];

  const getItemDisplayName = (item: typeof allItems[number]): string => {
    if (item.type === "vehicle") {
      return (item as LogisticsVehicle & { type: string }).regNumber;
    }
    if (item.type === "trailer") {
      return (item as LogisticsTrailer & { type: string }).regNumber;
    }
    if (item.type === "driver") {
      return (item as LogisticsDriver & { type: string }).fullName;
    }
    return (item as { name: string }).name;
  };

  const filteredItems = allItems.filter(item => {
    const displayName = getItemDisplayName(item);
    const matchesSearch = displayName.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || item.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const getCarrierName = (carrierId: number | null | undefined) => {
    if (!carrierId) return null;
    return carriers?.find(c => c.id === carrierId)?.name || null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Справочник Логистика
        </CardTitle>
        <CardDescription>Перевозчики, транспорт, водители и точки доставки</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Поиск..." 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
                className="pl-9" 
                data-testid="input-search-logistics" 
              />
            </div>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as LogisticsType | "all")}>
              <SelectTrigger className="w-[180px]" data-testid="select-logistics-type-filter">
                <SelectValue placeholder="Все типы" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все типы</SelectItem>
                {LOGISTICS_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <AddLogisticsDialog carriers={carriers || []} />
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Тип</TableHead>
                    <TableHead>Название</TableHead>
                    <TableHead>Перевозчик</TableHead>
                    <TableHead>Доп. информация</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        <Truck className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        Нет данных
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredItems.map((item) => (
                      <TableRow key={`${item.type}-${item.id}`} data-testid={`row-logistics-${item.type}-${item.id}`}>
                        <TableCell>
                          <Badge variant="outline">{item.typeName}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{getItemDisplayName(item)}</TableCell>
                        <TableCell>
                          {(item.type === "vehicle" || item.type === "trailer" || item.type === "driver") 
                            ? getCarrierName((item as any).carrierId) || "—"
                            : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-xs truncate">
                          {item.type === "vehicle" ? (item as LogisticsVehicle & { type: string }).model || "—" :
                           item.type === "trailer" ? (item as LogisticsTrailer & { type: string }).capacityKg || "—" :
                           item.type === "driver" ? (item as LogisticsDriver & { type: string }).phone || "—" :
                           item.type === "delivery_location" ? (item as LogisticsDeliveryLocation & { type: string }).address || "—" :
                           item.type === "warehouse" ? (item as LogisticsWarehouse & { type: string }).address || "—" :
                           (item as LogisticsCarrier & { type: string }).inn || "—"}
                        </TableCell>
                        <TableCell>
                          {item.isActive ? (
                            <Badge variant="outline" className="text-green-600 border-green-600">Активен</Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">Неактивен</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" data-testid={`button-edit-${item.type}-${item.id}`}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive" data-testid={`button-delete-${item.type}-${item.id}`}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============ ADD LOGISTICS DIALOG ============

const logisticsFormSchema = z.object({
  type: z.enum(["carrier", "delivery_location", "vehicle", "trailer", "driver", "warehouse"]),
  name: z.string().min(1, "Укажите название"),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  inn: z.string().optional(),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  coordinates: z.string().optional(),
  carrierId: z.number().optional(),
  plateNumber: z.string().optional(),
  vehicleType: z.string().optional(),
  capacity: z.string().optional(),
  licenseNumber: z.string().optional(),
  licenseExpiry: z.string().optional(),
});

type LogisticsFormData = z.infer<typeof logisticsFormSchema>;

function AddLogisticsDialog({ carriers }: { carriers: LogisticsCarrier[] }) {
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
      capacity: "",
      licenseNumber: "",
      licenseExpiry: "",
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
    form.setValue("capacity", "");
    form.setValue("licenseNumber", "");
    form.setValue("licenseExpiry", "");
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
          capacityKg: data.capacity ? parseFloat(data.capacity) : null,
          isActive: data.isActive,
        };
      } else if (data.type === "trailer") {
        endpoint = "/api/logistics/trailers";
        payload = {
          regNumber: data.plateNumber,
          carrierId: data.carrierId || null,
          capacityKg: data.capacity ? parseFloat(data.capacity) : null,
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
          address: data.address,
          capacity: data.capacity ? parseFloat(data.capacity) : null,
          isActive: data.isActive,
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
                  name="coordinates"
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
              <>
                <FormField
                  control={form.control}
                  name="carrierId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Перевозчик</FormLabel>
                      <Select 
                        onValueChange={(v) => field.onChange(v ? parseInt(v) : undefined)} 
                        value={field.value?.toString() || ""}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-logistics-carrier">
                            <SelectValue placeholder="Выберите перевозчика" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {carriers.map((c) => (
                            <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                <FormField
                  control={form.control}
                  name="capacity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Вместимость (л)</FormLabel>
                      <FormControl>
                        <Input placeholder="20000" type="number" data-testid="input-logistics-capacity" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
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
                        onValueChange={(v) => field.onChange(v ? parseInt(v) : undefined)} 
                        value={field.value?.toString() || ""}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-logistics-driver-carrier">
                            <SelectValue placeholder="Выберите перевозчика" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {carriers.map((c) => (
                            <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
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
                  name="capacity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Вместимость (л)</FormLabel>
                      <FormControl>
                        <Input placeholder="100000" type="number" data-testid="input-logistics-warehouse-capacity" {...field} />
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

// ============ CUSTOMERS TAB ============

function CustomersTab() {
  const [search, setSearch] = useState("");

  const { data: customers, isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const filteredItems = customers?.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Справочник Покупатели
        </CardTitle>
        <CardDescription>Единый справочник покупателей для ОПТ и Заправки ВС</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Поиск..." 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
                className="pl-9" 
                data-testid="input-search-customers" 
              />
            </div>
            <AddCustomerDialog />
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Название</TableHead>
                    <TableHead>Модуль</TableHead>
                    <TableHead>Контактное лицо</TableHead>
                    <TableHead>Телефон</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        Нет данных
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredItems.map((item) => (
                      <TableRow key={item.id} data-testid={`row-customer-${item.id}`}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {item.module === "wholesale" ? "ОПТ" : item.module === "refueling" ? "Заправка" : "Общий"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{item.contactPerson || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{item.phone || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{item.email || "—"}</TableCell>
                        <TableCell>
                          {item.isActive ? (
                            <Badge variant="outline" className="text-green-600 border-green-600">Активен</Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">Неактивен</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" data-testid={`button-edit-customer-${item.id}`}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive" data-testid={`button-delete-customer-${item.id}`}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============ ADD CUSTOMER DIALOG ============

const customerFormSchema = z.object({
  name: z.string().min(1, "Укажите название"),
  module: z.enum(["wholesale", "refueling", "both"]),
  description: z.string().optional(),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Неверный формат email").optional().or(z.literal("")),
  inn: z.string().optional(),
  contractNumber: z.string().optional(),
  isActive: z.boolean().default(true),
});

type CustomerFormData = z.infer<typeof customerFormSchema>;

function AddCustomerDialog() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const form = useForm<CustomerFormData>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      name: "",
      module: "both",
      description: "",
      contactPerson: "",
      phone: "",
      email: "",
      inn: "",
      contractNumber: "",
      isActive: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CustomerFormData) => {
      const payload = {
        name: data.name,
        module: data.module,
        description: data.description,
        contactPerson: data.contactPerson,
        phone: data.phone,
        email: data.email || null,
        inn: data.inn,
        contractNumber: data.contractNumber,
        isActive: data.isActive,
      };
      const res = await apiRequest("POST", "/api/customers", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({ title: "Покупатель добавлен", description: "Новый покупатель сохранен в справочнике" });
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
        <Button size="sm" data-testid="button-add-customer">
          <Plus className="mr-2 h-4 w-4" />
          Добавить
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Новый покупатель</DialogTitle>
          <DialogDescription>Добавление покупателя в справочник</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
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
                      <SelectItem value="both">Общий (ОПТ и Заправка)</SelectItem>
                      <SelectItem value="wholesale">Только ОПТ</SelectItem>
                      <SelectItem value="refueling">Только Заправка ВС</SelectItem>
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
                    <Input placeholder="Название покупателя" data-testid="input-customer-name" {...field} />
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
                    <Input placeholder="ФИО контактного лица" data-testid="input-customer-contact" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
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
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Описание</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Дополнительная информация..." className="resize-none" data-testid="input-customer-description" {...field} />
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
                    <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-customer-active" />
                  </FormControl>
                  <FormLabel className="font-normal cursor-pointer">Активен</FormLabel>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-4 pt-4">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Отмена</Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-customer">
                {createMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Сохранение...</> : "Создать"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ============ MAIN PAGE ============

export default function DirectoriesPage() {
  const [activeTab, setActiveTab] = useState<"wholesale" | "refueling" | "logistics" | "customers">("wholesale");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Справочники</h1>
        <p className="text-muted-foreground">Управление справочными данными системы</p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="wholesale" className="flex items-center gap-2" data-testid="tab-wholesale">
            <Building2 className="h-4 w-4" />
            ОПТ
          </TabsTrigger>
          <TabsTrigger value="refueling" className="flex items-center gap-2" data-testid="tab-refueling">
            <Plane className="h-4 w-4" />
            Заправка ВС
          </TabsTrigger>
          <TabsTrigger value="logistics" className="flex items-center gap-2" data-testid="tab-logistics">
            <Truck className="h-4 w-4" />
            Логистика
          </TabsTrigger>
          <TabsTrigger value="customers" className="flex items-center gap-2" data-testid="tab-customers">
            <Users className="h-4 w-4" />
            Покупатели
          </TabsTrigger>
        </TabsList>

        <TabsContent value="wholesale">
          <WholesaleTab />
        </TabsContent>

        <TabsContent value="refueling">
          <RefuelingTab />
        </TabsContent>

        <TabsContent value="logistics">
          <LogisticsTab />
        </TabsContent>

        <TabsContent value="customers">
          <CustomersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}