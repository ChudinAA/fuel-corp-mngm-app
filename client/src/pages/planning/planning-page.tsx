import { useState } from "react";
import { addMonths, endOfMonth, format, startOfMonth } from "date-fns";
import { ru } from "date-fns/locale";
import { History } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuditPanel } from "@/components/audit-panel";
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

export default function PlanningPage() {
  const [period, setPeriod] = useState<PlanningPeriod>(getDefaultPeriod());
  const [activeTab, setActiveTab] = useState("volumes");
  const [auditOpen, setAuditOpen] = useState(false);
  const quickMonths = getQuickMonths();

  const handleFromChange = (val: string) => {
    if (!val) return;
    const d = new Date(val + "T00:00:00");
    setPeriod((p) => ({ ...p, from: d }));
  };

  const handleToChange = (val: string) => {
    if (!val) return;
    const d = new Date(val + "T00:00:00");
    setPeriod((p) => ({ ...p, to: d }));
  };

  const isActiveMonth = (m: { from: Date; to: Date }) =>
    toInputDate(m.from) === toInputDate(period.from) &&
    toInputDate(m.to) === toInputDate(period.to);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">
            Планирование
          </h1>
          <p className="text-sm text-muted-foreground">
            Планирование объёмов и остатков складов
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setAuditOpen(true)}
          data-testid="button-audit-history"
        >
          <History className="h-4 w-4 mr-2" />
          История
        </Button>
      </div>

      <div className="flex flex-col gap-3 border rounded-md p-4 bg-muted/20">
        <div className="flex items-end gap-4 flex-wrap">
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">От</Label>
            <Input
              type="date"
              value={toInputDate(period.from)}
              onChange={(e) => handleFromChange(e.target.value)}
              className="w-40"
              data-testid="input-period-from"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">До</Label>
            <Input
              type="date"
              value={toInputDate(period.to)}
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
              variant={isActiveMonth(m) ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriod({ from: m.from, to: m.to })}
              data-testid={`button-month-${m.label}`}
            >
              {m.label}
            </Button>
          ))}
        </div>
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

      <AuditPanel
        open={auditOpen}
        onOpenChange={setAuditOpen}
        entityType="plan_entries"
        entityName="Планирование"
      />
    </div>
  );
}
