
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarIcon, Download, TrendingUp, TrendingDown } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";

type PeriodPreset = "month" | "quarter" | "year" | "custom";
type GroupBy = "day" | "week" | "month";

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("month");
  const [groupBy, setGroupBy] = useState<GroupBy>("day");
  const [activeModule, setActiveModule] = useState("opt");

  const handlePresetChange = (preset: PeriodPreset) => {
    setPeriodPreset(preset);
    const now = new Date();
    
    switch (preset) {
      case "month":
        setDateRange({ from: startOfMonth(now), to: endOfMonth(now) });
        setGroupBy("day");
        break;
      case "quarter":
        setDateRange({ from: startOfQuarter(now), to: endOfQuarter(now) });
        setGroupBy("week");
        break;
      case "year":
        setDateRange({ from: startOfYear(now), to: endOfYear(now) });
        setGroupBy("month");
        break;
    }
  };

  const { data: summary, isLoading } = useQuery({
    queryKey: ["/api/analytics/summary", dateRange.from, dateRange.to, activeModule],
    queryFn: async () => {
      const response = await fetch(
        `/api/analytics/summary?startDate=${format(dateRange.from, "yyyy-MM-dd")}&endDate=${format(dateRange.to, "yyyy-MM-dd")}&module=${activeModule}`
      );
      if (!response.ok) throw new Error("Failed to fetch analytics summary");
      return response.json();
    },
  });

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Аналитические отчеты</h1>
        <p className="text-muted-foreground mt-2">
          Глубокая аналитика с визуализацией данных за месяц/квартал/год
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle>Период анализа</CardTitle>
            <div className="flex gap-2 flex-wrap">
              <Select value={periodPreset} onValueChange={handlePresetChange}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Месяц</SelectItem>
                  <SelectItem value="quarter">Квартал</SelectItem>
                  <SelectItem value="year">Год</SelectItem>
                  <SelectItem value="custom">Произвольный</SelectItem>
                </SelectContent>
              </Select>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[300px] justify-start text-left font-normal",
                      !dateRange && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.from && dateRange.to ? (
                      <>
                        {format(dateRange.from, "dd MMM yyyy", { locale: ru })} -{" "}
                        {format(dateRange.to, "dd MMM yyyy", { locale: ru })}
                      </>
                    ) : (
                      <span>Выберите период</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="range"
                    selected={{ from: dateRange.from, to: dateRange.to }}
                    onSelect={(range) => {
                      if (range?.from && range?.to) {
                        setDateRange({ from: range.from, to: range.to });
                        setPeriodPreset("custom");
                      }
                    }}
                    numberOfMonths={2}
                    locale={ru}
                  />
                </PopoverContent>
              </Popover>

              <Select value={groupBy} onValueChange={(value) => setGroupBy(value as GroupBy)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">По дням</SelectItem>
                  <SelectItem value="week">По неделям</SelectItem>
                  <SelectItem value="month">По месяцам</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline" size="icon">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs value={activeModule} onValueChange={setActiveModule}>
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="opt">ОПТ</TabsTrigger>
          <TabsTrigger value="refueling">ЗВС</TabsTrigger>
          <TabsTrigger value="movement">Перемещения</TabsTrigger>
          <TabsTrigger value="exchange">Обмен</TabsTrigger>
        </TabsList>

        <TabsContent value="opt" className="mt-6 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Общая выручка</CardDescription>
                <CardTitle className="text-2xl">
                  {isLoading ? "..." : `${(summary?.totalRevenue || 0).toLocaleString("ru-RU")} ₽`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-xs text-muted-foreground">
                  <TrendingUp className="h-4 w-4 mr-1 text-green-500" />
                  За выбранный период
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Общая прибыль</CardDescription>
                <CardTitle className="text-2xl">
                  {isLoading ? "..." : `${(summary?.totalProfit || 0).toLocaleString("ru-RU")} ₽`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-xs text-muted-foreground">
                  <TrendingUp className="h-4 w-4 mr-1 text-green-500" />
                  За выбранный период
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Общий объем</CardDescription>
                <CardTitle className="text-2xl">
                  {isLoading ? "..." : `${(summary?.totalVolume || 0).toLocaleString("ru-RU")} кг`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-xs text-muted-foreground">
                  За выбранный период
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Средняя маржа</CardDescription>
                <CardTitle className="text-2xl">
                  {isLoading ? "..." : `${(summary?.averageMargin || 0).toFixed(1)}%`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-xs text-muted-foreground">
                  Рентабельность
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Suppliers */}
          <Card>
            <CardHeader>
              <CardTitle>Топ поставщиков</CardTitle>
              <CardDescription>По выручке за выбранный период</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-4">Загрузка...</div>
              ) : summary?.topSuppliers && summary.topSuppliers.length > 0 ? (
                <div className="space-y-4">
                  {summary.topSuppliers.map((supplier: any, index: number) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium">{supplier.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {supplier.volume.toLocaleString("ru-RU")} кг
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">
                          {supplier.revenue.toLocaleString("ru-RU")} ₽
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Нет данных за выбранный период
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Buyers */}
          <Card>
            <CardHeader>
              <CardTitle>Топ покупателей</CardTitle>
              <CardDescription>По выручке за выбранный период</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-4">Загрузка...</div>
              ) : summary?.topBuyers && summary.topBuyers.length > 0 ? (
                <div className="space-y-4">
                  {summary.topBuyers.map((buyer: any, index: number) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium">{buyer.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {buyer.volume.toLocaleString("ru-RU")} кг
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">
                          {buyer.revenue.toLocaleString("ru-RU")} ₽
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Нет данных за выбранный период
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="refueling" className="mt-6 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Общая выручка</CardDescription>
                <CardTitle className="text-2xl">
                  {isLoading ? "..." : `${(summary?.totalRevenue || 0).toLocaleString("ru-RU")} ₽`}
                </CardTitle>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Общая прибыль</CardDescription>
                <CardTitle className="text-2xl">
                  {isLoading ? "..." : `${(summary?.totalProfit || 0).toLocaleString("ru-RU")} ₽`}
                </CardTitle>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Общий объем</CardDescription>
                <CardTitle className="text-2xl">
                  {isLoading ? "..." : `${(summary?.totalVolume || 0).toLocaleString("ru-RU")} кг`}
                </CardTitle>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Средняя маржа</CardDescription>
                <CardTitle className="text-2xl">
                  {isLoading ? "..." : `${(summary?.averageMargin || 0).toFixed(1)}%`}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* Product Type Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Распределение по типам продукции</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-4">Загрузка...</div>
              ) : summary?.productTypeDistribution && summary.productTypeDistribution.length > 0 ? (
                <div className="space-y-4">
                  {summary.productTypeDistribution.map((item: any, index: number) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{item.type}</span>
                        <span className="text-muted-foreground">
                          {item.volume.toLocaleString("ru-RU")} кг ({item.percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary" 
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Нет данных за выбранный период
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movement" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Аналитика перемещений</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                Аналитика перемещений будет доступна в следующей версии
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="exchange" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Аналитика обмена</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                Аналитика обмена будет доступна в следующей версии
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
