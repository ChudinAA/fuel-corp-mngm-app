import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Search, CreditCard } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

interface StorageCard {
  id: string;
  name: string;
  country: string;
  airport: string;
  airportCode: string | null;
  currency: string | null;
  currentBalance: string | null;
  averageCost: string | null;
  averageCostCurrency: string | null;
  storageCost: string | null;
  notes: string | null;
  isActive: boolean | null;
  createdAt: string | null;
}

const storageCardFormSchema = z.object({
  name: z.string().min(1, "Название обязательно"),
  country: z.string().min(1, "Страна обязательна"),
  airport: z.string().min(1, "Аэропорт обязателен"),
  airportCode: z.string().optional(),
  currency: z.string().default("USD"),
  storageCost: z.string().optional(),
  notes: z.string().optional(),
});

type StorageCardFormData = z.infer<typeof storageCardFormSchema>;

function StorageCardForm({
  editCard,
  onSuccess,
  onCancel,
}: {
  editCard?: StorageCard | null;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();

  const form = useForm<StorageCardFormData>({
    resolver: zodResolver(storageCardFormSchema),
    defaultValues: {
      name: editCard?.name || "",
      country: editCard?.country || "",
      airport: editCard?.airport || "",
      airportCode: editCard?.airportCode || "",
      currency: editCard?.currency || "USD",
      storageCost: editCard?.storageCost || "",
      notes: editCard?.notes || "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: StorageCardFormData) => {
      const response = await apiRequest("POST", "/api/storage-cards", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/storage-cards"] });
      toast({ title: "Карта хранения создана" });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка создания",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: StorageCardFormData) => {
      const response = await apiRequest(
        "PATCH",
        `/api/storage-cards/${editCard?.id}`,
        data
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/storage-cards"] });
      toast({ title: "Карта хранения обновлена" });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка обновления",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: StorageCardFormData) => {
    if (editCard) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Название</FormLabel>
              <FormControl>
                <Input
                  placeholder="Карта хранения..."
                  data-testid="input-card-name"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="country"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Страна</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Германия"
                    data-testid="input-country"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="airport"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Аэропорт</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Франкфурт"
                    data-testid="input-airport"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="airportCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Код аэропорта</FormLabel>
                <FormControl>
                  <Input
                    placeholder="FRA"
                    data-testid="input-airport-code"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Валюта</FormLabel>
                <FormControl>
                  <Input
                    placeholder="USD"
                    data-testid="input-currency"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="storageCost"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Стоимость хранения</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  data-testid="input-storage-cost"
                  {...field}
                />
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
              <FormLabel>Примечания</FormLabel>
              <FormControl>
                <Input
                  placeholder="Примечания..."
                  data-testid="input-notes"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            data-testid="button-cancel"
          >
            Отмена
          </Button>
          <Button
            type="submit"
            disabled={createMutation.isPending || updateMutation.isPending}
            data-testid="button-submit"
          >
            {editCard ? "Сохранить" : "Создать"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default function StorageCardsPage() {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<StorageCard | null>(null);
  const [deleteCardId, setDeleteCardId] = useState<string | null>(null);

  const { data: storageCards, isLoading } = useQuery<StorageCard[]>({
    queryKey: ["/api/storage-cards"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/storage-cards/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/storage-cards"] });
      toast({ title: "Карта хранения удалена" });
      setDeleteCardId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка удаления",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredCards = storageCards?.filter((card) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      card.name.toLowerCase().includes(query) ||
      card.country.toLowerCase().includes(query) ||
      card.airport.toLowerCase().includes(query) ||
      card.airportCode?.toLowerCase().includes(query)
    );
  });

  const formatNumber = (value: string | null) => {
    if (!value) return "—";
    const num = parseFloat(value);
    return isNaN(num) ? "—" : num.toLocaleString("ru-RU", { minimumFractionDigits: 2 });
  };

  const handleEdit = (card: StorageCard) => {
    setEditingCard(card);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingCard(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Карты хранения</h1>
          <p className="text-muted-foreground">
            Управление картами хранения топлива на зарубежных аэропортах
          </p>
        </div>
        {hasPermission("storage-cards", "create") && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-card">
                <Plus className="h-4 w-4 mr-2" />
                Добавить карту
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editingCard ? "Редактировать карту" : "Новая карта хранения"}
                </DialogTitle>
              </DialogHeader>
              <StorageCardForm
                editCard={editingCard}
                onSuccess={handleDialogClose}
                onCancel={handleDialogClose}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Список карт хранения
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Поиск по названию, стране, аэропорту..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !filteredCards?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              Карты хранения не найдены
            </div>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Название</TableHead>
                    <TableHead>Страна</TableHead>
                    <TableHead>Аэропорт</TableHead>
                    <TableHead>Код</TableHead>
                    <TableHead className="text-right">Баланс</TableHead>
                    <TableHead className="text-right">Ср. стоимость</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCards.map((card) => (
                    <TableRow key={card.id} data-testid={`row-card-${card.id}`}>
                      <TableCell className="font-medium">{card.name}</TableCell>
                      <TableCell>{card.country}</TableCell>
                      <TableCell>{card.airport}</TableCell>
                      <TableCell>
                        {card.airportCode && (
                          <Badge variant="outline">{card.airportCode}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(card.currentBalance)} {card.currency}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(card.averageCost)} {card.averageCostCurrency}
                      </TableCell>
                      <TableCell>
                        <Badge variant={card.isActive ? "default" : "secondary"}>
                          {card.isActive ? "Активна" : "Неактивна"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {hasPermission("storage-cards", "edit") && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(card)}
                              data-testid={`button-edit-${card.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {hasPermission("storage-cards", "delete") && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteCardId(card.id)}
                              data-testid={`button-delete-${card.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <DeleteConfirmDialog
        open={!!deleteCardId}
        onOpenChange={(open) => !open && setDeleteCardId(null)}
        onConfirm={() => deleteCardId && deleteMutation.mutate(deleteCardId)}
        title="Удалить карту хранения?"
        description="Карта хранения будет удалена. Это действие нельзя отменить."
      />
    </div>
  );
}
