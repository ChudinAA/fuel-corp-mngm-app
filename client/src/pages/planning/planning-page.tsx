import { useState } from "react";
import { addMonths, endOfMonth, format, startOfMonth } from "date-fns";
import { ru } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { VolumesTab } from "./components/volumes-tab";
import { WarehousesPlanFactTab } from "./components/warehouses-plan-fact-tab";

export type PlanningPeriod = {
  from: Date;
  to: Date;
};

function getDefaultPeriod(): PlanningPeriod {
  const nextMonth = addMonths(new Date(), 1);
  return {
    from: startOfMonth(nextMonth),
    to: endOfMonth(nextMonth),
  };
}

export default function PlanningPage() {
  const [period, setPeriod] = useState<PlanningPeriod>(getDefaultPeriod());
  const [activeTab, setActiveTab] = useState("volumes");

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">
            Планирование
          </h1>
          <p className="text-sm text-muted-foreground">
            Планирование объёмов и остатков складов
          </p>
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn("w-[280px] justify-start text-left font-normal")}
              data-testid="button-period-picker"
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(period.from, "dd MMM yyyy", { locale: ru })} —{" "}
              {format(period.to, "dd MMM yyyy", { locale: ru })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="range"
              selected={{ from: period.from, to: period.to }}
              onSelect={(range) => {
                if (range?.from && range?.to) {
                  setPeriod({ from: range.from, to: range.to });
                }
              }}
              numberOfMonths={2}
              locale={ru}
            />
          </PopoverContent>
        </Popover>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="volumes" data-testid="tab-volumes">
            Объёмы
          </TabsTrigger>
          <TabsTrigger value="warehouses" data-testid="tab-warehouses">
            Склады План/Факт
          </TabsTrigger>
        </TabsList>

        <TabsContent value="volumes" className="mt-4">
          <VolumesTab period={period} />
        </TabsContent>

        <TabsContent value="warehouses" className="mt-4">
          <WarehousesPlanFactTab period={period} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
