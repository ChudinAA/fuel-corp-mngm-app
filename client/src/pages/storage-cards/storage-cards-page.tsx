import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Plus, Search, CreditCard, History, Wallet } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { StorageCardItem } from "./components/storage-card-item";
import { AuditPanel } from "@/components/audit-panel";
import { ExportButton } from "@/components/export/export-button";

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

const depositFormSchema = z.object({
  amount: z.string().min(1, "Сумма обязательна"),
  notes: z.string().optional(),
});

type DepositFormData = z.infer<typeof depositFormSchema>;

function DepositForm({
  card,
  onSuccess,
  onCancel,
}: {
  card: any;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const form = useForm<DepositFormData>({
    resolver: zodResolver(depositFormSchema),
    defaultValues: {
      amount: "",
      notes: "",
    },
  });

  const depositMutation = useMutation({
    mutationFn: async (data: DepositFormData) => {
      const response = await apiRequest(
        "POST",
        `/api/storage-cards/${card.id}/transactions`,
        {
          transactionType: "income",
          quantity: parseFloat(data.amount),
          price: 0,
          sum: parseFloat(data.amount),
          notes: data.notes || "Пополнение аванса",
          transactionDate: new Date().toISOString(),
        }
      );
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Аванс успешно внесен" });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => depositMutation.mutate(data))} className="space-y-4">
        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Сумма ($)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  data-testid="input-deposit-amount"
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
              <FormLabel>Комментарий</FormLabel>
              <FormControl>
                <Input
                  placeholder="Комментарий к платежу..."
                  data-testid="input-deposit-notes"
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
            data-testid="button-cancel-deposit"
          >
            Отмена
          </Button>
          <Button
            type="submit"
            disabled={depositMutation.isPending}
            data-testid="button-confirm-deposit"
          >
            Внести
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default function StorageCardsPage({ hideHeader = false }: { hideHeader?: boolean }) {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<any | null>(null);
  const [viewingCard, setViewingCard] = useState<any | null>(null);
  const [depositCard, setDepositCard] = useState<any | null>(null);
  const [auditPanelOpen, setAuditPanelOpen] = useState(false);

  const { data: storageCards, isLoading } = useQuery<any[]>({
    queryKey: ["/api/storage-cards/advances"],
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

  const formatNumber = (value: number) =>
    new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value);

  const handleEdit = (card: any) => {
    setEditingCard(card);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingCard(null);
  };

  return (
    <div className="space-y-6">
      {!hideHeader && (
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">Авансы поставщикам</h1>
            <p className="text-muted-foreground">
              Управление авансами на зарубежных аэропортах
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
      )}

      {hideHeader && hasPermission("storage-cards", "create") && (
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-medium">Карты хранения</h2>
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
        </div>
      )}

      <div className="flex items-center gap-2">
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
        <Button
          variant="outline"
          onClick={() => setAuditPanelOpen(true)}
          title="Аудит всех складов"
        >
          <History className="h-4 w-4 mr-2" />
          История изменений
        </Button>
        <ExportButton moduleName="storage-cards" />
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !filteredCards?.length ? (
        <Card>
          <CardContent className="text-center py-8 text-muted-foreground">
            Карты хранения не найдены
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredCards.map((card) => (
            <Card key={card.id} className="hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-1">
                <CardTitle className="text-base font-bold">{card.name}</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Остаток авансов</p>
                    <p className="text-2xl font-bold">
                      {formatNumber(parseFloat(card.currentBalance || "0"))} $
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Цена за кг</p>
                      <p className={card.latestPrice?.isExpired ? "text-orange-600 font-bold" : "font-medium"}>
                        {card.latestPrice ? `${card.latestPrice.price} $` : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Актуальна до</p>
                      <p className={card.latestPrice?.isExpired ? "text-orange-600 font-bold" : "font-medium"}>
                        {card.latestPrice ? new Date(card.latestPrice.dateTo).toLocaleDateString("ru-RU") : "—"}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">Рассчитано кг</p>
                    <p className="text-lg font-semibold text-primary">
                      {formatNumber(card.kgAmount)} кг
                    </p>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => setDepositCard(card)}
                      data-testid={`button-deposit-${card.id}`}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Внести аванс
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(card)}
                      data-testid={`button-edit-${card.id}`}
                    >
                      Изм.
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!viewingCard} onOpenChange={(open) => !open && setViewingCard(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              {viewingCard?.name}
            </DialogTitle>
          </DialogHeader>
          {viewingCard && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Страна</p>
                  <p className="font-medium">{viewingCard.country}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Аэропорт</p>
                  <p className="font-medium">
                    {viewingCard.airport}
                    {viewingCard.airportCode && ` (${viewingCard.airportCode})`}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Баланс</p>
                  <p className="font-medium text-lg">
                    {formatNumber(parseFloat(viewingCard.currentBalance || "0"))} $
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Себестоимость</p>
                  <p className="font-medium">
                    {parseFloat(viewingCard.averageCost || "0").toFixed(4)} {viewingCard.averageCostCurrency || viewingCard.currency || "USD"}/кг
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Валюта</p>
                  <p className="font-medium">{viewingCard.currency || "USD"}</p>
                </div>
                {viewingCard.storageCost && (
                  <div>
                    <p className="text-sm text-muted-foreground">Стоимость хранения</p>
                    <p className="font-medium">{viewingCard.storageCost}</p>
                  </div>
                )}
              </div>
              {viewingCard.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Примечания</p>
                  <p>{viewingCard.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!depositCard} onOpenChange={(open) => !open && setDepositCard(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Внесение аванса: {depositCard?.name}
            </DialogTitle>
          </DialogHeader>
          {depositCard && (
            <DepositForm 
              card={depositCard} 
              onSuccess={() => {
                setDepositCard(null);
                queryClient.invalidateQueries({ queryKey: ["/api/storage-cards/advances"] });
              }}
              onCancel={() => setDepositCard(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <AuditPanel
        open={auditPanelOpen}
        onOpenChange={setAuditPanelOpen}
        entityType="storage_cards"
        entityId=""
        entityName="Все Карты хранения (включая удаленные)"
      />
    </div>
  );
}
