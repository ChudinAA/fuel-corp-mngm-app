
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ru } from "date-fns/locale";
import { Calendar as CalendarIcon, Download } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { DailyOptReport } from "./daily-opt-report";
import { DailyRefuelingReport } from "./daily-refueling-report";

export function CustomPeriodReport() {
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [activeModule, setActiveModule] = useState("opt");

  const handleExport = () => {
    console.log("Exporting report for period", dateRange);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Отчет за период</CardTitle>
              <CardDescription>
                Просмотр операций за выбранный период (до месяца)
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
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
              <Button variant="outline" size="icon" onClick={handleExport}>
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeModule} onValueChange={setActiveModule}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="opt">ОПТ</TabsTrigger>
              <TabsTrigger value="refueling">ЗВС</TabsTrigger>
              <TabsTrigger value="movement">Перемещения</TabsTrigger>
              <TabsTrigger value="exchange">Обмен</TabsTrigger>
            </TabsList>

            <TabsContent value="opt" className="mt-6">
              <div className="text-center py-8 text-muted-foreground">
                Период: {format(dateRange.from, "dd.MM.yyyy")} - {format(dateRange.to, "dd.MM.yyyy")}
                <br />
                Реализация в разработке
              </div>
            </TabsContent>

            <TabsContent value="refueling" className="mt-6">
              <div className="text-center py-8 text-muted-foreground">
                Период: {format(dateRange.from, "dd.MM.yyyy")} - {format(dateRange.to, "dd.MM.yyyy")}
                <br />
                Реализация в разработке
              </div>
            </TabsContent>

            <TabsContent value="movement" className="mt-6">
              <div className="text-center py-8 text-muted-foreground">
                В разработке
              </div>
            </TabsContent>

            <TabsContent value="exchange" className="mt-6">
              <div className="text-center py-8 text-muted-foreground">
                В разработке
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
