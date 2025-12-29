
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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, Plus, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface Customer {
  id: string;
  name: string;
}

interface GovernmentContract {
  id: string;
  contractNumber: string;
  contractName: string;
  customerId?: string;
  customer?: Customer;
  contractDate: string;
  startDate: string;
  endDate: string;
  totalAmount?: string;
  currentAmount?: string;
  remainingAmount?: string;
  productType?: string;
  plannedVolume?: string;
  actualVolume?: string;
  status: string;
  notes?: string;
  createdAt: string;
}

export default function GovContractsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<GovernmentContract | null>(null);
  const [formData, setFormData] = useState({
    contractNumber: "",
    contractName: "",
    customerId: "",
    contractDate: "",
    startDate: "",
    endDate: "",
    totalAmount: "",
    productType: "",
    plannedVolume: "",
    status: "active",
    notes: "",
  });

  const { data: contracts = [], isLoading } = useQuery<GovernmentContract[]>({
    queryKey: ["/api/gov-contracts"],
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/gov-contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gov-contracts"] });
      toast({ title: "Контракт создан успешно" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Ошибка создания контракта", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/gov-contracts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gov-contracts"] });
      toast({ title: "Контракт обновлен успешно" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Ошибка обновления контракта", variant: "destructive" });
    },
  });

  const updateFromSalesMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/gov-contracts/${id}/update-from-sales`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gov-contracts"] });
      toast({ title: "Данные обновлены из продаж" });
    },
    onError: () => {
      toast({ title: "Ошибка обновления данных", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/gov-contracts/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gov-contracts"] });
      toast({ title: "Контракт удален успешно" });
    },
    onError: () => {
      toast({ title: "Ошибка удаления контракта", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      contractNumber: "",
      contractName: "",
      customerId: "",
      contractDate: "",
      startDate: "",
      endDate: "",
      totalAmount: "",
      productType: "",
      plannedVolume: "",
      status: "active",
      notes: "",
    });
    setEditingContract(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingContract) {
      updateMutation.mutate({ id: editingContract.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (contract: GovernmentContract) => {
    setEditingContract(contract);
    setFormData({
      contractNumber: contract.contractNumber,
      contractName: contract.contractName,
      customerId: contract.customerId || "",
      contractDate: contract.contractDate.substring(0, 10),
      startDate: contract.startDate.substring(0, 10),
      endDate: contract.endDate.substring(0, 10),
      totalAmount: contract.totalAmount || "",
      productType: contract.productType || "",
      plannedVolume: contract.plannedVolume || "",
      status: contract.status,
      notes: contract.notes || "",
    });
    setIsDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      active: "default",
      completed: "secondary",
      suspended: "destructive",
    };
    const labels: Record<string, string> = {
      active: "Активен",
      completed: "Завершен",
      suspended: "Приостановлен",
    };
    return <Badge variant={variants[status] || "default"}>{labels[status] || status}</Badge>;
  };

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Госконтракты</h1>
          <p className="text-muted-foreground mt-2">
            Учет государственных контрактов с автоматической подгрузкой данных из продаж
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Создать контракт
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingContract ? "Редактировать контракт" : "Создать новый контракт"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Номер контракта*</Label>
                  <Input
                    value={formData.contractNumber}
                    onChange={(e) => setFormData({ ...formData, contractNumber: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Статус</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Активен</SelectItem>
                      <SelectItem value="completed">Завершен</SelectItem>
                      <SelectItem value="suspended">Приостановлен</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Название контракта*</Label>
                <Input
                  value={formData.contractName}
                  onChange={(e) => setFormData({ ...formData, contractName: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Заказчик</Label>
                <Select
                  value={formData.customerId}
                  onValueChange={(value) => setFormData({ ...formData, customerId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите заказчика" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Дата контракта*</Label>
                  <Input
                    type="date"
                    value={formData.contractDate}
                    onChange={(e) => setFormData({ ...formData, contractDate: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Дата начала*</Label>
                  <Input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Дата окончания*</Label>
                  <Input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Общая сумма (₽)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.totalAmount}
                    onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
                  />
                </div>
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
                  {editingContract ? "Сохранить" : "Создать"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Государственные контракты</CardTitle>
          <CardDescription>
            Список всех госконтрактов с накопительными данными по продажам
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">Загрузка...</div>
          ) : contracts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Нет созданных контрактов
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Номер</TableHead>
                    <TableHead>Название</TableHead>
                    <TableHead>Заказчик</TableHead>
                    <TableHead>Период</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="text-right">Сумма контракта</TableHead>
                    <TableHead className="text-right">Текущая сумма</TableHead>
                    <TableHead className="text-right">Остаток</TableHead>
                    <TableHead className="text-right">Плановый объем</TableHead>
                    <TableHead className="text-right">Факт. объем</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contracts.map((contract) => (
                    <TableRow key={contract.id}>
                      <TableCell className="font-medium">{contract.contractNumber}</TableCell>
                      <TableCell className="max-w-xs truncate">{contract.contractName}</TableCell>
                      <TableCell>{contract.customer?.name || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(contract.startDate), "dd.MM.yyyy")} - {format(new Date(contract.endDate), "dd.MM.yyyy")}
                      </TableCell>
                      <TableCell>{getStatusBadge(contract.status)}</TableCell>
                      <TableCell className="text-right">
                        {contract.totalAmount ? `${parseFloat(contract.totalAmount).toLocaleString()} ₽` : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {contract.currentAmount ? `${parseFloat(contract.currentAmount).toLocaleString()} ₽` : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {contract.remainingAmount ? `${parseFloat(contract.remainingAmount).toLocaleString()} ₽` : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {contract.plannedVolume ? `${parseFloat(contract.plannedVolume).toLocaleString()} кг` : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {contract.actualVolume ? `${parseFloat(contract.actualVolume).toLocaleString()} кг` : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => updateFromSalesMutation.mutate(contract.id)}
                            title="Обновить из продаж"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(contract)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm("Удалить этот контракт?")) {
                                deleteMutation.mutate(contract.id);
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
