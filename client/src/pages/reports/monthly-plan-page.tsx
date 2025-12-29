
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, Plus } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface Base {
  id: string;
  name: string;
}

interface MonthlyPlan {
  id: string;
  planMonth: string;
  planType: string;
  baseId?: string;
  base?: Base;
  productType?: string;
  plannedVolume?: string;
  plannedRevenue?: string;
  notes?: string;
  createdAt: string;
}

export default function MonthlyPlanPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MonthlyPlan | null>(null);
  const [formData, setFormData] = useState({
    planMonth: "",
    planType: "sales",
    baseId: "",
    productType: "",
    plannedVolume: "",
    plannedRevenue: "",
    notes: "",
  });

  const { data: plans = [], isLoading } = useQuery<MonthlyPlan[]>({
    queryKey: ["/api/monthly-plan"],
  });

  const { data: bases = [] } = useQuery<Base[]>({
    queryKey: ["/api/bases"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/monthly-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/monthly-plan"] });
      toast({ title: "План создан успешно" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Ошибка создания плана", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/monthly-plan/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/monthly-plan"] });
      toast({ title: "План обновлен успешно" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Ошибка обновления плана", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/monthly-plan/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/monthly-plan"] });
      toast({ title: "План удален успешно" });
    },
    onError: () => {
      toast({ title: "Ошибка удаления плана", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      planMonth: "",
      planType: "sales",
      baseId: "",
      productType: "",
      plannedVolume: "",
      plannedRevenue: "",
      notes: "",
    });
    setEditingPlan(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPlan) {
      updateMutation.mutate({ id: editingPlan.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (plan: MonthlyPlan) => {
    setEditingPlan(plan);
    setFormData({
      planMonth: plan.planMonth,
      planType: plan.planType,
      baseId: plan.baseId || "",
      productType: plan.productType || "",
      plannedVolume: plan.plannedVolume || "",
      plannedRevenue: plan.plannedRevenue || "",
      notes: plan.notes || "",
    });
    setIsDialogOpen(true);
  };

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Ежемесячный план</h1>
          <p className="text-muted-foreground mt-2">
            Планирование продаж и объемов складов
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Создать план
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingPlan ? "Редактировать план" : "Создать новый план"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Месяц планирования</Label>
                  <Input
                    type="month"
                    value={formData.planMonth.substring(0, 7)}
                    onChange={(e) => setFormData({ ...formData, planMonth: e.target.value + "-01T00:00:00" })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Тип плана</Label>
                  <Select
                    value={formData.planType}
                    onValueChange={(value) => setFormData({ ...formData, planType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sales">Продажи</SelectItem>
                      <SelectItem value="warehouse_volume">Объем склада</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>База/Склад</Label>
                <Select
                  value={formData.baseId}
                  onValueChange={(value) => setFormData({ ...formData, baseId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите базу" />
                  </SelectTrigger>
                  <SelectContent>
                    {bases.map((base) => (
                      <SelectItem key={base.id} value={base.id}>
                        {base.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Тип продукта</Label>
                  <Select
                    value={formData.productType}
                    onValueChange={(value) => setFormData({ ...formData, productType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите тип" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RT">РТ</SelectItem>
                      <SelectItem value="PVKJ">ПВКЖ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Плановый объем (кг)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.plannedVolume}
                    onChange={(e) => setFormData({ ...formData, plannedVolume: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Плановая выручка (₽)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.plannedRevenue}
                  onChange={(e) => setFormData({ ...formData, plannedRevenue: e.target.value })}
                />
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
                  {editingPlan ? "Сохранить" : "Создать"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Планы</CardTitle>
          <CardDescription>
            Список всех ежемесячных планов
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">Загрузка...</div>
          ) : plans.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Нет созданных планов
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Месяц</TableHead>
                  <TableHead>Тип плана</TableHead>
                  <TableHead>База</TableHead>
                  <TableHead>Продукт</TableHead>
                  <TableHead>Плановый объем</TableHead>
                  <TableHead>Плановая выручка</TableHead>
                  <TableHead>Примечания</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell>
                      {format(new Date(plan.planMonth), "LLLL yyyy", { locale: ru })}
                    </TableCell>
                    <TableCell>
                      {plan.planType === "sales" ? "Продажи" : "Объем склада"}
                    </TableCell>
                    <TableCell>{plan.base?.name || "-"}</TableCell>
                    <TableCell>{plan.productType || "-"}</TableCell>
                    <TableCell>
                      {plan.plannedVolume ? `${parseFloat(plan.plannedVolume).toLocaleString()} кг` : "-"}
                    </TableCell>
                    <TableCell>
                      {plan.plannedRevenue ? `${parseFloat(plan.plannedRevenue).toLocaleString()} ₽` : "-"}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{plan.notes || "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(plan)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm("Удалить этот план?")) {
                              deleteMutation.mutate(plan.id);
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
