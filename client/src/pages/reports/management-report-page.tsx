
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
import { FileText, Download, TrendingUp, DollarSign, Package, FileCheck, Truck, Plus } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface ManagementReportData {
  salesMetrics: {
    optSales: {
      totalVolume: string;
      totalRevenue: string;
      totalProfit: string;
      marginality: string;
    };
    refuelingSales: {
      totalVolume: string;
      totalRevenue: string;
      totalProfit: string;
      marginality: string;
    };
    combined: {
      totalVolume: string;
      totalRevenue: string;
      totalProfit: string;
      marginality: string;
    };
  };
  warehouseMetrics: {
    totalBalance: string;
    totalValue: string;
    movementsCount: number;
    exchangesCount: number;
  };
  financialMetrics: {
    totalCashflow: string;
    totalExpenses: string;
    netProfit: string;
    paymentsCount: number;
  };
  govContractsMetrics: {
    activeContracts: number;
    totalContractValue: string;
    completedVolume: string;
    remainingVolume: string;
  };
  logisticsMetrics: {
    totalDeliveries: number;
    totalDeliveryCost: string;
    totalDistance: string;
  };
}

interface ManagementReport {
  id: string;
  reportName: string;
  description?: string;
  periodStart: string;
  periodEnd: string;
  reportData: ManagementReportData;
  visualizationConfig?: any;
  notes?: string;
  createdAt: string;
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

export default function ManagementReportPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [reportData, setReportData] = useState<ManagementReportData | null>(null);
  const [saveFormData, setSaveFormData] = useState({
    reportName: "",
    description: "",
    notes: "",
  });

  const { data: savedReports = [], isLoading } = useQuery<ManagementReport[]>({
    queryKey: ["/api/management-report"],
  });

  const generateMutation = useMutation({
    mutationFn: async (data: { periodStart: string; periodEnd: string }) => {
      const res = await fetch("/api/management-report/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      setReportData(data);
      toast({ title: "Отчет успешно сгенерирован" });
    },
    onError: () => {
      toast({ title: "Ошибка генерации отчета", variant: "destructive" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/management-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/management-report"] });
      toast({ title: "Отчет сохранен успешно" });
      setIsSaveDialogOpen(false);
      setSaveFormData({ reportName: "", description: "", notes: "" });
    },
    onError: () => {
      toast({ title: "Ошибка сохранения отчета", variant: "destructive" });
    },
  });

  const handleGenerate = () => {
    if (!periodStart || !periodEnd) {
      toast({ title: "Укажите период отчета", variant: "destructive" });
      return;
    }
    generateMutation.mutate({ periodStart, periodEnd });
  };

  const handleSaveReport = () => {
    if (!reportData || !saveFormData.reportName) {
      toast({ title: "Заполните название отчета", variant: "destructive" });
      return;
    }
    saveMutation.mutate({
      ...saveFormData,
      periodStart,
      periodEnd,
      reportData,
    });
  };

  const handleLoadReport = (report: ManagementReport) => {
    setPeriodStart(report.periodStart);
    setPeriodEnd(report.periodEnd);
    setReportData(report.reportData);
  };

  const salesChartData = reportData ? [
    {
      name: "ОПТ",
      volume: parseFloat(reportData.salesMetrics.optSales.totalVolume),
      revenue: parseFloat(reportData.salesMetrics.optSales.totalRevenue),
      profit: parseFloat(reportData.salesMetrics.optSales.totalProfit),
    },
    {
      name: "ЗВС",
      volume: parseFloat(reportData.salesMetrics.refuelingSales.totalVolume),
      revenue: parseFloat(reportData.salesMetrics.refuelingSales.totalRevenue),
      profit: parseFloat(reportData.salesMetrics.refuelingSales.totalProfit),
    },
  ] : [];

  const financialPieData = reportData ? [
    { name: "Доходы", value: parseFloat(reportData.financialMetrics.totalCashflow) },
    { name: "Расходы", value: parseFloat(reportData.financialMetrics.totalExpenses) },
  ] : [];

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Управленческий отчет</h1>
          <p className="text-muted-foreground mt-2">
            Результирующие таблицы по основным показателям всех бизнес-процессов
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <FileText className="mr-2 h-4 w-4" />
              Загрузить сохраненный отчет
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Сохраненные отчеты</DialogTitle>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto">
              {isLoading ? (
                <div className="text-center py-12">Загрузка...</div>
              ) : savedReports.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  Нет сохраненных отчетов
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Название</TableHead>
                      <TableHead>Период</TableHead>
                      <TableHead>Дата создания</TableHead>
                      <TableHead>Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {savedReports.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell className="font-medium">{report.reportName}</TableCell>
                        <TableCell>
                          {format(new Date(report.periodStart), "dd.MM.yyyy", { locale: ru })} -{" "}
                          {format(new Date(report.periodEnd), "dd.MM.yyyy", { locale: ru })}
                        </TableCell>
                        <TableCell>
                          {format(new Date(report.createdAt), "dd.MM.yyyy HH:mm", { locale: ru })}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => {
                              handleLoadReport(report);
                              setIsDialogOpen(false);
                            }}
                          >
                            Загрузить
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Параметры отчета</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Период с*</Label>
              <Input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Период по*</Label>
              <Input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={handleGenerate} className="flex-1">
                Сгенерировать отчет
              </Button>
              {reportData && (
                <Button onClick={() => setIsSaveDialogOpen(true)} variant="outline">
                  Сохранить
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {reportData && (
        <>
          {/* KPI Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Общая выручка</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {parseFloat(reportData.salesMetrics.combined.totalRevenue).toLocaleString()} ₽
                </div>
                <p className="text-xs text-muted-foreground">
                  Маржинальность: {reportData.salesMetrics.combined.marginality}%
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Чистая прибыль</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {parseFloat(reportData.financialMetrics.netProfit).toLocaleString()} ₽
                </div>
                <p className="text-xs text-muted-foreground">
                  Платежей: {reportData.financialMetrics.paymentsCount}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Склады</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {parseFloat(reportData.warehouseMetrics.totalBalance).toLocaleString()} кг
                </div>
                <p className="text-xs text-muted-foreground">
                  Стоимость: {parseFloat(reportData.warehouseMetrics.totalValue).toLocaleString()} ₽
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Госконтракты</CardTitle>
                <FileCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {reportData.govContractsMetrics.activeContracts}
                </div>
                <p className="text-xs text-muted-foreground">
                  Активных контрактов
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid gap-4 md:grid-cols-2 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Продажи по каналам</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={salesChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="revenue" fill="#0088FE" name="Выручка" />
                    <Bar dataKey="profit" fill="#00C49F" name="Прибыль" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Структура финансов</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={financialPieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name}: ${entry.value.toLocaleString()} ₽`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {financialPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Tables */}
          <div className="grid gap-4 md:grid-cols-2 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Продажи - детализация</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Канал</TableHead>
                      <TableHead className="text-right">Объем (кг)</TableHead>
                      <TableHead className="text-right">Выручка (₽)</TableHead>
                      <TableHead className="text-right">Прибыль (₽)</TableHead>
                      <TableHead className="text-right">Маржа (%)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">ОПТ</TableCell>
                      <TableCell className="text-right">
                        {parseFloat(reportData.salesMetrics.optSales.totalVolume).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {parseFloat(reportData.salesMetrics.optSales.totalRevenue).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {parseFloat(reportData.salesMetrics.optSales.totalProfit).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {reportData.salesMetrics.optSales.marginality}%
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">ЗВС</TableCell>
                      <TableCell className="text-right">
                        {parseFloat(reportData.salesMetrics.refuelingSales.totalVolume).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {parseFloat(reportData.salesMetrics.refuelingSales.totalRevenue).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {parseFloat(reportData.salesMetrics.refuelingSales.totalProfit).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {reportData.salesMetrics.refuelingSales.marginality}%
                      </TableCell>
                    </TableRow>
                    <TableRow className="font-semibold">
                      <TableCell>Итого</TableCell>
                      <TableCell className="text-right">
                        {parseFloat(reportData.salesMetrics.combined.totalVolume).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {parseFloat(reportData.salesMetrics.combined.totalRevenue).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {parseFloat(reportData.salesMetrics.combined.totalProfit).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {reportData.salesMetrics.combined.marginality}%
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Складские операции</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Показатель</TableHead>
                      <TableHead className="text-right">Значение</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Общий остаток</TableCell>
                      <TableCell className="text-right">
                        {parseFloat(reportData.warehouseMetrics.totalBalance).toLocaleString()} кг
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Стоимость остатков</TableCell>
                      <TableCell className="text-right">
                        {parseFloat(reportData.warehouseMetrics.totalValue).toLocaleString()} ₽
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Перемещений</TableCell>
                      <TableCell className="text-right">
                        {reportData.warehouseMetrics.movementsCount}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Биржевых сделок</TableCell>
                      <TableCell className="text-right">
                        {reportData.warehouseMetrics.exchangesCount}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Логистика</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Показатель</TableHead>
                      <TableHead className="text-right">Значение</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Всего поставок</TableCell>
                      <TableCell className="text-right">
                        {reportData.logisticsMetrics.totalDeliveries}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Общая стоимость</TableCell>
                      <TableCell className="text-right">
                        {parseFloat(reportData.logisticsMetrics.totalDeliveryCost).toLocaleString()} ₽
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Общее расстояние</TableCell>
                      <TableCell className="text-right">
                        {parseFloat(reportData.logisticsMetrics.totalDistance).toLocaleString()} км
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Государственные контракты</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Показатель</TableHead>
                      <TableHead className="text-right">Значение</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Активных контрактов</TableCell>
                      <TableCell className="text-right">
                        {reportData.govContractsMetrics.activeContracts}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Общая стоимость</TableCell>
                      <TableCell className="text-right">
                        {parseFloat(reportData.govContractsMetrics.totalContractValue).toLocaleString()} ₽
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Выполнено</TableCell>
                      <TableCell className="text-right">
                        {parseFloat(reportData.govContractsMetrics.completedVolume).toLocaleString()} ₽
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Остаток</TableCell>
                      <TableCell className="text-right">
                        {parseFloat(reportData.govContractsMetrics.remainingVolume).toLocaleString()} ₽
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Save Report Dialog */}
      <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Сохранить отчет</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Название отчета*</Label>
              <Input
                value={saveFormData.reportName}
                onChange={(e) => setSaveFormData({ ...saveFormData, reportName: e.target.value })}
                placeholder="Управленческий отчет за Q1 2024"
              />
            </div>
            <div className="space-y-2">
              <Label>Описание</Label>
              <Textarea
                value={saveFormData.description}
                onChange={(e) => setSaveFormData({ ...saveFormData, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Примечания</Label>
              <Textarea
                value={saveFormData.notes}
                onChange={(e) => setSaveFormData({ ...saveFormData, notes: e.target.value })}
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>
                Отмена
              </Button>
              <Button onClick={handleSaveReport}>Сохранить</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
