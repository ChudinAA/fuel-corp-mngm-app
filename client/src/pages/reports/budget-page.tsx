
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, Plus, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface BudgetEntry {
  id: string;
  budgetMonth: string;
  salesVolume?: string;
  salesRevenue?: string;
  marginality?: string;
  operatingExpenses?: string;
  personnelExpenses?: string;
  logisticsExpenses?: string;
  otherExpenses?: string;
  totalExpenses?: string;
  netProfit?: string;
  notes?: string;
  createdAt: string;
}

export default function BudgetPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<BudgetEntry | null>(null);
  const [formData, setFormData] = useState({
    budgetMonth: "",
    salesVolume: "",
    salesRevenue: "",
    marginality: "",
    operatingExpenses: "",
    personnelExpenses: "",
    logisticsExpenses: "",
    otherExpenses: "",
    totalExpenses: "",
    netProfit: "",
    notes: "",
  });

  const { data: entries = [], isLoading } = useQuery<BudgetEntry[]>({
    queryKey: ["/api/budget"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budget"] });
      toast({ title: "Запись БДР создана успешно" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Ошибка создания записи", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/budget/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budget"] });
      toast({ title: "Запись БДР обновлена успешно" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Ошибка обновления записи", variant: "destructive" });
    },
  });

  const updateFromSalesMutation = useMutation({
    mutationFn: async (budgetMonth: string) => {
      const res = await fetch("/api/budget/update-from-sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ budgetMonth }),
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budget"] });
      toast({ title: "Данные обновлены из продаж" });
    },
    onError: () => {
      toast({ title: "Ошибка обновления данных", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/budget/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budget"] });
      toast({ title: "Запись удалена успешно" });
    },
    onError: () => {
      toast({ title: "Ошибка удаления записи", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      budgetMonth: "",
      salesVolume: "",
      salesRevenue: "",
      marginality: "",
      operatingExpenses: "",
      personnelExpenses: "",
      logisticsExpenses: "",
      otherExpenses: "",
      totalExpenses: "",
      netProfit: "",
      notes: "",
    });
    setEditingEntry(null);
  };

  const calculateTotals = () => {
    const operating = parseFloat(formData.operatingExpenses || "0");
    const personnel = parseFloat(formData.personnelExpenses || "0");
    const logistics = parseFloat(formData.logisticsExpenses || "0");
    const other = parseFloat(formData.otherExpenses || "0");
    const totalExp = operating + personnel + logistics + other;

    const revenue = parseFloat(formData.salesRevenue || "0");
    const netProf = revenue - totalExp;

    setFormData({
      ...formData,
      totalExpenses: totalExp.toFixed(2),
      netProfit: netProf.toFixed(2),
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Рассчитываем итоги перед отправкой
    const operating = parseFloat(formData.operatingExpenses || "0");
    const personnel = parseFloat(formData.personnelExpenses || "0");
    const logistics = parseFloat(formData.logisticsExpenses || "0");
    const other = parseFloat(formData.otherExpenses || "0");
    const totalExp = operating + personnel + logistics + other;
    const revenue = parseFloat(formData.salesRevenue || "0");
    const netProf = revenue - totalExp;

    const dataToSubmit = {
      ...formData,
      totalExpenses: totalExp.toString(),
      netProfit: netProf.toString(),
    };

    if (editingEntry) {
      updateMutation.mutate({ id: editingEntry.id, data: dataToSubmit });
    } else {
      createMutation.mutate(dataToSubmit);
    }
  };

  const handleEdit = (entry: BudgetEntry) => {
    setEditingEntry(entry);
    setFormData({
      budgetMonth: entry.budgetMonth.substring(0, 7),
      salesVolume: entry.salesVolume || "",
      salesRevenue: entry.salesRevenue || "",
      marginality: entry.marginality || "",
      operatingExpenses: entry.operatingExpenses || "",
      personnelExpenses: entry.personnelExpenses || "",
      logisticsExpenses: entry.logisticsExpenses || "",
      otherExpenses: entry.otherExpenses || "",
      totalExpenses: entry.totalExpenses || "",
      netProfit: entry.netProfit || "",
      notes: entry.notes || "",
    });
    setIsDialogOpen(true);
  };

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">БДР - Бюджет доходов и расходов</h1>
          <p className="text-muted-foreground mt-2">
            Учет ежемесячных доходов, расходов и маржинальности с автоматической подгрузкой данных продаж
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Создать запись
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingEntry ? "Редактировать запись БДР" : "Создать новую запись БДР"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Месяц бюджета*</Label>
                <Input
                  type="month"
                  value={formData.budgetMonth}
                  onChange={(e) => setFormData({ ...formData, budgetMonth: e.target.value })}
                  required
                />
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Доходы (автоматически из продаж)</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Объем продаж (кг)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.salesVolume}
                      onChange={(e) => setFormData({ ...formData, salesVolume: e.target.value })}
                      readOnly
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Выручка от продаж (₽)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.salesRevenue}
                      onChange={(e) => setFormData({ ...formData, salesRevenue: e.target.value })}
                      readOnly
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Маржинальность (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.marginality}
                      onChange={(e) => setFormData({ ...formData, marginality: e.target.value })}
                      readOnly
                      className="bg-muted"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Расходы (заполняется вручную)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Операционные расходы (₽)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.operatingExpenses}
                      onChange={(e) => setFormData({ ...formData, operatingExpenses: e.target.value })}
                      onBlur={calculateTotals}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Расходы на персонал (₽)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.personnelExpenses}
                      onChange={(e) => setFormData({ ...formData, personnelExpenses: e.target.value })}
                      onBlur={calculateTotals}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Логистические расходы (₽)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.logisticsExpenses}
                      onChange={(e) => setFormData({ ...formData, logisticsExpenses: e.target.value })}
                      onBlur={calculateTotals}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Прочие расходы (₽)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.otherExpenses}
                      onChange={(e) => setFormData({ ...formData, otherExpenses: e.target.value })}
                      onBlur={calculateTotals}
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Итоги (автоматический расчет)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Общие расходы (₽)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.totalExpenses}
                      readOnly
                      className="bg-muted font-semibold"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Чистая прибыль (₽)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.netProfit}
                      readOnly
                      className="bg-muted font-semibold"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Примечания</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Отмена
                </Button>
                <Button type="submit">
                  {editingEntry ? "Сохранить" : "Создать"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Записи БДР по месяцам</CardTitle>
          <CardDescription>
            Бюджет доходов и расходов с автоматической подгрузкой данных продаж
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">Загрузка...</div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Нет созданных записей
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Месяц</TableHead>
                    <TableHead className="text-right">Объем продаж (кг)</TableHead>
                    <TableHead className="text-right">Выручка (₽)</TableHead>
                    <TableHead className="text-right">Маржа (%)</TableHead>
                    <TableHead className="text-right">Операц. расходы</TableHead>
                    <TableHead className="text-right">Персонал</TableHead>
                    <TableHead className="text-right">Логистика</TableHead>
                    <TableHead className="text-right">Прочие</TableHead>
                    <TableHead className="text-right">Всего расходов</TableHead>
                    <TableHead className="text-right">Чистая прибыль</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">
                        {format(new Date(entry.budgetMonth), "LLLL yyyy", { locale: ru })}
                      </TableCell>
                      <TableCell className="text-right">
                        {entry.salesVolume ? parseFloat(entry.salesVolume).toLocaleString() : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {entry.salesRevenue ? `${parseFloat(entry.salesRevenue).toLocaleString()} ₽` : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {entry.marginality ? `${parseFloat(entry.marginality).toFixed(2)}%` : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {entry.operatingExpenses ? `${parseFloat(entry.operatingExpenses).toLocaleString()} ₽` : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {entry.personnelExpenses ? `${parseFloat(entry.personnelExpenses).toLocaleString()} ₽` : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {entry.logisticsExpenses ? `${parseFloat(entry.logisticsExpenses).toLocaleString()} ₽` : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {entry.otherExpenses ? `${parseFloat(entry.otherExpenses).toLocaleString()} ₽` : "-"}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {entry.totalExpenses ? `${parseFloat(entry.totalExpenses).toLocaleString()} ₽` : "-"}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {entry.netProfit ? (
                          <span className={parseFloat(entry.netProfit) >= 0 ? "text-green-600" : "text-red-600"}>
                            {parseFloat(entry.netProfit).toLocaleString()} ₽
                          </span>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => updateFromSalesMutation.mutate(entry.budgetMonth)}
                            title="Обновить из продаж"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(entry)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm("Удалить эту запись?")) {
                                deleteMutation.mutate(entry.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
    </div>
  );
}
