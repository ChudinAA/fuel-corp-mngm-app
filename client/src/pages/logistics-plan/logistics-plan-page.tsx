import { useState } from "react";
import { addMonths, endOfMonth, format, startOfMonth } from "date-fns";
import { ru } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TransportTab } from "./components/transport-tab";
import { RoutesTab } from "./components/routes-tab";
import { PlanningTab } from "./components/planning-tab";

export type LogisticsPeriod = {
  from: Date;
  to: Date;
};

function getDefaultPeriod(): LogisticsPeriod {
  const nextMonth = addMonths(new Date(), 1);
  return {
    from: startOfMonth(nextMonth),
    to: endOfMonth(nextMonth),
  };
}

function getQuickMonths() {
  const months = [];
  const now = new Date();
  for (let i = -2; i <= 6; i++) {
    const d = addMonths(now, i);
    months.push({
      label: format(d, "LLL yy", { locale: ru }),
      from: startOfMonth(d),
      to: endOfMonth(d),
    });
  }
  return months;
}

function toInputDate(d: Date) {
  return format(d, "yyyy-MM-dd");
}

function isActiveMonth(m: { from: Date; to: Date }, period: LogisticsPeriod) {
  return (
    toInputDate(m.from) === toInputDate(period.from) &&
    toInputDate(m.to) === toInputDate(period.to)
  );
}

export default function LogisticsPlanPage() {
  const [period, setPeriod] = useState<LogisticsPeriod>(getDefaultPeriod());
  const [activeTab, setActiveTab] = useState("transport");
  const quickMonths = getQuickMonths();

  const handleFromChange = (value: string) => {
    if (!value) return;
    setPeriod((prev) => ({ ...prev, from: new Date(value) }));
  };

  const handleToChange = (value: string) => {
    if (!value) return;
    setPeriod((prev) => ({ ...prev, to: new Date(value) }));
  };

  const periodFrom = toInputDate(period.from);
  const periodTo = toInputDate(period.to);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">План Логистики</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Планирование транспорта, маршрутов и логистики
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 border rounded-md p-4 bg-muted/20">
        <div className="flex items-end gap-4 flex-wrap">
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">С</Label>
            <Input
              type="date"
              value={periodFrom}
              onChange={(e) => handleFromChange(e.target.value)}
              className="w-40"
              data-testid="input-period-from"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">По</Label>
            <Input
              type="date"
              value={periodTo}
              onChange={(e) => handleToChange(e.target.value)}
              className="w-40"
              data-testid="input-period-to"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {quickMonths.map((m) => (
            <Button
              key={m.label}
              variant={isActiveMonth(m, period) ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriod({ from: m.from, to: m.to })}
              data-testid={`button-month-${m.label}`}
            >
              {m.label}
            </Button>
          ))}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
        <TabsList>
          <TabsTrigger value="transport" data-testid="tab-transport">
            Транспорт
          </TabsTrigger>
          <TabsTrigger value="routes" data-testid="tab-routes">
            Маршруты
          </TabsTrigger>
          <TabsTrigger value="planning" data-testid="tab-planning">
            Планирование
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transport" className="mt-4">
          <TransportTab periodFrom={periodFrom} periodTo={periodTo} />
        </TabsContent>

        <TabsContent value="routes" className="mt-4">
          <RoutesTab periodFrom={periodFrom} periodTo={periodTo} />
        </TabsContent>

        <TabsContent value="planning" className="mt-4">
          <PlanningTab periodFrom={periodFrom} periodTo={periodTo} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
