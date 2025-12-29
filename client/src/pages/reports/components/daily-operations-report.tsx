
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Calendar as CalendarIcon, Download, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { DailyOptReport } from "./daily-opt-report";
import { DailyRefuelingReport } from "./daily-refueling-report";
import { DailyMovementReport } from "./daily-movement-report";
import { DailyExchangeReport } from "./daily-exchange-report";

export function DailyOperationsReport() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [activeModule, setActiveModule] = useState("opt");

  const formattedDate = format(selectedDate, "yyyy-MM-dd");

  const handleExport = () => {
    // TODO: Implement export functionality
    console.log("Exporting report for", formattedDate);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Отчет за день</CardTitle>
              <CardDescription>
                Просмотр операций за выбранную дату
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[280px] justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? (
                      format(selectedDate, "PPP", { locale: ru })
                    ) : (
                      <span>Выберите дату</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    initialFocus
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
              <DailyOptReport date={formattedDate} />
            </TabsContent>

            <TabsContent value="refueling" className="mt-6">
              <DailyRefuelingReport date={formattedDate} />
            </TabsContent>

            <TabsContent value="movement" className="mt-6">
              <DailyMovementReport date={formattedDate} />
            </TabsContent>

            <TabsContent value="exchange" className="mt-6">
              <DailyExchangeReport date={formattedDate} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
