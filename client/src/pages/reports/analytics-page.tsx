
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [activeModule, setActiveModule] = useState("opt");

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
          <div className="flex items-center justify-between">
            <CardTitle>Период анализа</CardTitle>
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
                    }
                  }}
                  numberOfMonths={2}
                  locale={ru}
                />
              </PopoverContent>
            </Popover>
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

        <TabsContent value="opt" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Аналитика ОПТ</CardTitle>
              <CardDescription>
                Графики, сравнительный анализ, тренды
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                Реализация визуализации в разработке
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="refueling" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Аналитика ЗВС</CardTitle>
              <CardDescription>
                Графики, сравнительный анализ, тренды
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                Реализация визуализации в разработке
              </div>
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
                В разработке
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
                В разработке
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
