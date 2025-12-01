import { useState } from "react";
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
  Plane
} from "lucide-react";
import type { DirectoryWholesale, DirectoryRefueling, DirectoryLogistics } from "@shared/schema";

const WHOLESALE_TYPES = [
  { value: "supplier", label: "Поставщик" },
  { value: "buyer", label: "Покупатель" },
  { value: "basis", label: "Базис" },
];

const REFUELING_TYPES = [
  { value: "airport", label: "Аэропорт" },
  { value: "buyer", label: "Покупатель" },
  { value: "service", label: "Услуга" },
];

const LOGISTICS_TYPES = [
  { value: "carrier", label: "Перевозчик" },
  { value: "delivery_location", label: "Место доставки" },
  { value: "vehicle", label: "Транспорт" },
  { value: "trailer", label: "Прицеп" },
  { value: "driver", label: "Водитель" },
];

const directoryFormSchema = z.object({
  name: z.string().min(1, "Укажите название"),
  type: z.string().min(1, "Выберите тип"),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});

type DirectoryFormData = z.infer<typeof directoryFormSchema>;

function AddDirectoryDialog({ category, types, onSuccess }: { 
  category: "wholesale" | "refueling" | "logistics"; 
  types: { value: string; label: string }[];
  onSuccess?: () => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const form = useForm<DirectoryFormData>({
    resolver: zodResolver(directoryFormSchema),
    defaultValues: {
      name: "",
      type: "",
      description: "",
      isActive: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: DirectoryFormData) => {
      const res = await apiRequest("POST", `/api/directories/${category}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/directories/${category}`] });
      toast({ title: "Запись добавлена", description: "Новая запись справочника сохранена" });
      form.reset();
      setOpen(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const categoryLabels = {
    wholesale: "ОПТ",
    refueling: "Заправка ВС",
    logistics: "Логистика",
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid={`button-add-${category}`}>
          <Plus className="mr-2 h-4 w-4" />
          Добавить
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Новая запись: {categoryLabels[category]}</DialogTitle>
          <DialogDescription>Добавление записи в справочник</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Название</FormLabel>
                  <FormControl>
                    <Input placeholder="Название" data-testid="input-directory-name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Тип</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-directory-type">
                        <SelectValue placeholder="Выберите тип" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {types.map((type) => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Описание</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Дополнительная информация..." className="resize-none" data-testid="input-directory-description" {...field} />
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
                    <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-directory-active" />
                  </FormControl>
                  <FormLabel className="font-normal cursor-pointer">Активен</FormLabel>
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-4 pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Отмена</Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-directory">
                {createMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Сохранение...</> : "Создать"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function DirectoryTable({ 
  category, 
  types 
}: { 
  category: "wholesale" | "refueling" | "logistics"; 
  types: { value: string; label: string }[];
}) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data, isLoading } = useQuery<(DirectoryWholesale | DirectoryRefueling | DirectoryLogistics)[]>({
    queryKey: [`/api/directories/${category}`],
  });

  const getTypeLabel = (type: string) => types.find(t => t.value === type)?.label || type;

  const filteredData = data?.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || item.type === typeFilter;
    return matchesSearch && matchesType;
  }) || [];

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Поиск..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Все типы" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все типы</SelectItem>
            {types.map((type) => (
              <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <AddDirectoryDialog category={category} types={types} />
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead>Тип</TableHead>
              <TableHead>Описание</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  Нет данных
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell><Badge variant="outline">{getTypeLabel(item.type)}</Badge></TableCell>
                  <TableCell className="text-muted-foreground max-w-xs truncate">{item.description || "—"}</TableCell>
                  <TableCell>
                    {item.isActive ? (
                      <Badge variant="outline" className="text-green-600 border-green-600">Активен</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">Неактивен</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8"><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default function DirectoriesPage() {
  const [activeTab, setActiveTab] = useState<"wholesale" | "refueling" | "logistics">("wholesale");

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
        </TabsList>

        <TabsContent value="wholesale">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Справочник ОПТ
              </CardTitle>
              <CardDescription>Поставщики, покупатели и базисы для оптовых операций</CardDescription>
            </CardHeader>
            <CardContent>
              <DirectoryTable category="wholesale" types={WHOLESALE_TYPES} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="refueling">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plane className="h-5 w-5" />
                Справочник заправки ВС
              </CardTitle>
              <CardDescription>Аэропорты, покупатели и услуги заправки</CardDescription>
            </CardHeader>
            <CardContent>
              <DirectoryTable category="refueling" types={REFUELING_TYPES} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logistics">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Справочник логистики
              </CardTitle>
              <CardDescription>Перевозчики, транспорт и места доставки</CardDescription>
            </CardHeader>
            <CardContent>
              <DirectoryTable category="logistics" types={LOGISTICS_TYPES} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
