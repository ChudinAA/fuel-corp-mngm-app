import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, CalendarIcon, DollarSign, Loader2 } from "lucide-react";

interface ExchangeRate {
  id: string;
  currency: string;
  rate: string;
  rateDate: string;
  source: string | null;
  isActive: boolean;
  createdAt: string;
}

const CURRENCIES = [
  { value: "USD", label: "Доллар США ($)" },
  { value: "EUR", label: "Евро" },
  { value: "CNY", label: "Юань" },
  { value: "AED", label: "Дирхам ОАЭ" },
  { value: "TRY", label: "Турецкая лира" },
];

export function ExchangeRatesTab() {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<ExchangeRate | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    currency: "USD",
    rate: "",
    rateDate: new Date(),
    source: "",
  });

  const { data: rates = [], isLoading } = useQuery<ExchangeRate[]>({
    queryKey: ["/api/exchange-rates"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        currency: data.currency,
        rate: parseFloat(data.rate),
        rateDate: format(data.rateDate, "yyyy-MM-dd"),
        source: data.source || null,
      };
      
      if (editingRate) {
        return apiRequest("PATCH", `/api/exchange-rates/${editingRate.id}`, payload);
      }
      return apiRequest("POST", "/api/exchange-rates", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exchange-rates"] });
      toast({ title: editingRate ? "Курс обновлен" : "Курс добавлен" });
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/exchange-rates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exchange-rates"] });
      toast({ title: "Курс удален" });
      setDeleteDialogOpen(false);
      setDeletingId(null);
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка удаления", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({ currency: "USD", rate: "", rateDate: new Date(), source: "" });
    setEditingRate(null);
    setDialogOpen(false);
  };

  const handleEdit = (rate: ExchangeRate) => {
    setEditingRate(rate);
    setFormData({
      currency: rate.currency,
      rate: rate.rate,
      rateDate: new Date(rate.rateDate),
      source: rate.source || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.rate || parseFloat(formData.rate) <= 0) {
      toast({ title: "Ошибка", description: "Укажите корректный курс", variant: "destructive" });
      return;
    }
    createMutation.mutate(formData);
  };

  const sortedRates = [...rates].sort((a, b) => {
    const dateCompare = new Date(b.rateDate).getTime() - new Date(a.rateDate).getTime();
    if (dateCompare !== 0) return dateCompare;
    return a.currency.localeCompare(b.currency);
  });

  const canCreate = hasPermission("directories", "create");
  const canEdit = hasPermission("directories", "edit");
  const canDelete = hasPermission("directories", "delete");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Курсы валют
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Управление курсами валют для расчетов
          </p>
        </div>
        {canCreate && (
          <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); else setDialogOpen(true); }}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-add-exchange-rate">
                <Plus className="h-4 w-4 mr-1" />
                Добавить курс
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingRate ? "Редактировать курс" : "Добавить курс"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Валюта</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(val) => setFormData({ ...formData, currency: val })}
                  >
                    <SelectTrigger data-testid="select-currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Курс к RUB</Label>
                  <Input
                    type="number"
                    step="0.000001"
                    value={formData.rate}
                    onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                    placeholder="Например: 92.50"
                    data-testid="input-rate"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Дата курса</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                        data-testid="input-rate-date"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(formData.rateDate, "dd.MM.yyyy", { locale: ru })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.rateDate}
                        onSelect={(date) => date && setFormData({ ...formData, rateDate: date })}
                        locale={ru}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Источник (опционально)</Label>
                  <Input
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    placeholder="ЦБ РФ, Банк и т.д."
                    data-testid="input-source"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Отмена
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-rate">
                    {createMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                    {editingRate ? "Сохранить" : "Добавить"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : rates.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Курсы валют пока не добавлены
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Валюта</TableHead>
                <TableHead>Курс к RUB</TableHead>
                <TableHead>Дата</TableHead>
                <TableHead>Источник</TableHead>
                <TableHead className="w-[100px]">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRates.map((rate) => (
                <TableRow key={rate.id} data-testid={`row-exchange-rate-${rate.id}`}>
                  <TableCell>
                    <Badge variant="outline">{rate.currency}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{parseFloat(rate.rate).toFixed(4)}</TableCell>
                  <TableCell>{format(new Date(rate.rateDate), "dd.MM.yyyy", { locale: ru })}</TableCell>
                  <TableCell className="text-muted-foreground">{rate.source || "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(rate)}
                          data-testid={`button-edit-rate-${rate.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(rate.id)}
                          data-testid={`button-delete-rate-${rate.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить курс?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Курс будет удален из системы.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
