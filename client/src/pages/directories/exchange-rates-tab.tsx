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
import { Plus, Pencil, Trash2, CalendarIcon, DollarSign, Loader2, ArrowRight } from "lucide-react";

interface ExchangeRate {
  id: string;
  currency: string;
  targetCurrency: string;
  rate: string;
  rateDate: string;
  source: string | null;
  isActive: boolean;
  createdAt: string;
}

interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string | null;
  isActive: boolean;
}

export function ExchangeRatesTab() {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [addCurrencyDialogOpen, setAddCurrencyDialogOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<ExchangeRate | null>(null);
  const [editingCurrency, setEditingCurrency] = useState<Currency | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingCurrencyId, setDeletingCurrencyId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    currency: "USD",
    targetCurrency: "RUB",
    currencyId: "",
    targetCurrencyId: "",
    rate: "",
    rateDate: new Date(),
    source: "",
  });

  const [newCurrency, setNewCurrency] = useState({
    code: "",
    name: "",
    symbol: "",
  });

  const { data: rates = [], isLoading } = useQuery<ExchangeRate[]>({
    queryKey: ["/api/exchange-rates"],
  });

  const { data: currencies = [] } = useQuery<Currency[]>({
    queryKey: ["/api/currencies"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        currency: data.currency,
        targetCurrency: data.targetCurrency,
        currencyId: data.currencyId || currencies.find(c => c.code === data.currency)?.id,
        targetCurrencyId: data.targetCurrencyId || currencies.find(c => c.code === data.targetCurrency)?.id,
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

  const createCurrencyMutation = useMutation({
    mutationFn: async (data: typeof newCurrency) => {
      if (editingCurrency) {
        return apiRequest("PATCH", `/api/currencies/${editingCurrency.id}`, data);
      }
      return apiRequest("POST", "/api/currencies", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/currencies"] });
      toast({ title: editingCurrency ? "Валюта обновлена" : "Валюта добавлена" });
      resetCurrencyForm();
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const deleteCurrencyMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/currencies/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/currencies"] });
      toast({ title: "Валюта удалена" });
      setDeletingCurrencyId(null);
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка удаления", description: error.message, variant: "destructive" });
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
    setFormData({ 
      currency: "USD", 
      targetCurrency: "RUB", 
      currencyId: "",
      targetCurrencyId: "",
      rate: "", 
      rateDate: new Date(), 
      source: "" 
    });
    setEditingRate(null);
    setDialogOpen(false);
  };

  const resetCurrencyForm = () => {
    setNewCurrency({ code: "", name: "", symbol: "" });
    setEditingCurrency(null);
    setAddCurrencyDialogOpen(false);
  };

  const handleEdit = (rate: any) => {
    setEditingRate(rate);
    setFormData({
      currency: rate.currency,
      targetCurrency: rate.targetCurrency || "RUB",
      currencyId: rate.currencyId || "",
      targetCurrencyId: rate.targetCurrencyId || "",
      rate: rate.rate,
      rateDate: new Date(rate.rateDate),
      source: rate.source || "",
    });
    setDialogOpen(true);
  };

  const handleEditCurrency = (currency: Currency) => {
    setEditingCurrency(currency);
    setNewCurrency({
      code: currency.code,
      name: currency.name,
      symbol: currency.symbol || "",
    });
    setAddCurrencyDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteCurrency = (id: string) => {
    setDeletingCurrencyId(id);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.rate || parseFloat(formData.rate) <= 0) {
      toast({ title: "Ошибка", description: "Укажите корректный курс", variant: "destructive" });
      return;
    }
    if (formData.currency === formData.targetCurrency) {
      toast({ title: "Ошибка", description: "Валюты должны отличаться", variant: "destructive" });
      return;
    }
    createMutation.mutate(formData);
  };

  const handleAddCurrency = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCurrency.code || !newCurrency.name) {
      toast({ title: "Ошибка", description: "Заполните код и название валюты", variant: "destructive" });
      return;
    }
    createCurrencyMutation.mutate(newCurrency);
  };

  const sortedRates = [...rates].sort((a, b) => {
    const dateCompare = new Date(b.rateDate).getTime() - new Date(a.rateDate).getTime();
    if (dateCompare !== 0) return dateCompare;
    return a.currency.localeCompare(b.currency);
  });

  const getCurrencyLabel = (code: string) => {
    const currency = currencies.find(c => c.code === code);
    if (currency) {
      return currency.symbol ? `${currency.name} (${currency.symbol})` : currency.name;
    }
    return code;
  };

  const canCreate = hasPermission("directories", "create");
  const canEdit = hasPermission("directories", "edit");
  const canDelete = hasPermission("directories", "delete");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Курсы валют
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Управление курсами валют
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
                  <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end">
                    <div className="space-y-2">
                      <Label>Из валюты</Label>
                      <Select
                        value={formData.currency}
                        onValueChange={(val) => {
                          const curr = currencies.find(c => c.code === val);
                          setFormData({ ...formData, currency: val, currencyId: curr?.id || "" });
                        }}
                      >
                        <SelectTrigger data-testid="select-base-currency">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {currencies.map((c) => (
                            <SelectItem key={c.id} value={c.code}>
                              {c.code} - {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="pb-2">
                      <ArrowRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="space-y-2">
                      <Label>В валюту</Label>
                      <Select
                        value={formData.targetCurrency}
                        onValueChange={(val) => {
                          const curr = currencies.find(c => c.code === val);
                          setFormData({ ...formData, targetCurrency: val, targetCurrencyId: curr?.id || "" });
                        }}
                      >
                        <SelectTrigger data-testid="select-target-currency">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {currencies.map((c) => (
                            <SelectItem key={c.id} value={c.code}>
                              {c.code} - {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Курс (сколько {formData.targetCurrency} за 1 {formData.currency})</Label>
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
                  <TableHead>Валютная пара</TableHead>
                  <TableHead>Курс</TableHead>
                  <TableHead>Дата</TableHead>
                  <TableHead className="w-[80px]">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRates.map((rate) => (
                  <TableRow key={rate.id} data-testid={`row-exchange-rate-${rate.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline">{rate.currency}</Badge>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <Badge variant="outline">{rate.targetCurrency || "RUB"}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{parseFloat(rate.rate).toFixed(4)}</TableCell>
                    <TableCell>{format(new Date(rate.rateDate), "dd.MM.yyyy", { locale: ru })}</TableCell>
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
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Валюты
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Список используемых валют
            </p>
          </div>
          {canCreate && (
            <Dialog open={addCurrencyDialogOpen} onOpenChange={(open) => { if (!open) resetCurrencyForm(); else setAddCurrencyDialogOpen(true); }}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" data-testid="button-add-currency">
                  <Plus className="h-4 w-4 mr-1" />
                  Новая валюта
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingCurrency ? "Редактировать валюту" : "Добавить валюту"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddCurrency} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Код валюты</Label>
                    <Input
                      value={newCurrency.code}
                      onChange={(e) => setNewCurrency({ ...newCurrency, code: e.target.value.toUpperCase() })}
                      placeholder="Например: KZT"
                      maxLength={10}
                      data-testid="input-currency-code"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Название</Label>
                    <Input
                      value={newCurrency.name}
                      onChange={(e) => setNewCurrency({ ...newCurrency, name: e.target.value })}
                      placeholder="Например: Казахстанский тенге"
                      data-testid="input-currency-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Символ (опционально)</Label>
                    <Input
                      value={newCurrency.symbol}
                      onChange={(e) => setNewCurrency({ ...newCurrency, symbol: e.target.value })}
                      placeholder="Например: ₸"
                      maxLength={5}
                      data-testid="input-currency-symbol"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={resetCurrencyForm}>
                      Отмена
                    </Button>
                    <Button type="submit" disabled={createCurrencyMutation.isPending} data-testid="button-save-currency">
                      {createCurrencyMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                      {editingCurrency ? "Сохранить" : "Добавить"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Код</TableHead>
                <TableHead>Название</TableHead>
                <TableHead className="w-[80px]">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currencies.map((currency) => (
                <TableRow key={currency.id} data-testid={`row-currency-${currency.id}`}>
                  <TableCell>
                    <Badge variant="secondary">{currency.code}</Badge>
                  </TableCell>
                  <TableCell>
                    {currency.name} {currency.symbol && `(${currency.symbol})`}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditCurrency(currency)}
                          data-testid={`button-edit-currency-${currency.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteCurrency(currency.id)}
                          data-testid={`button-delete-currency-${currency.id}`}
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
        </CardContent>
      </Card>

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

      <AlertDialog open={!!deletingCurrencyId} onOpenChange={(open) => !open && setDeletingCurrencyId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить валюту?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Убедитесь, что нет курсов, привязанных к этой валюте.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingCurrencyId && deleteCurrencyMutation.mutate(deletingCurrencyId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteCurrencyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
