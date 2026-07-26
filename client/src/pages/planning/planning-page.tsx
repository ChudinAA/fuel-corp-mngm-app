import { useState } from "react";
import { addMonths, endOfMonth, format, startOfMonth } from "date-fns";
import { ru } from "date-fns/locale";
import { History, Truck, CheckCircle2, Clock } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AuditPanel } from "@/components/audit-panel";
import { VolumesTab } from "./components/volumes-tab";
import { WarehousesPlanFactTab } from "./components/warehouses-plan-fact-tab";
import { ScenarioSelector } from "./components/scenario-selector";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

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
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const quickMonths = getQuickMonths();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const periodFrom = toInputDate(period.from);
  const periodTo = toInputDate(period.to);

  // Check if this month+scenario is already synced
  const syncStatusKey = ["/api/logistics-plan/sync/status", periodFrom, periodTo, scenarioId];
  const { data: syncStatus } = useQuery<{ isActive: boolean; sync: any | null }>({
    queryKey: syncStatusKey,
    queryFn: () => {
      const params = new URLSearchParams({ periodFrom, periodTo });
      if (scenarioId) params.set("scenarioId", scenarioId);
      return apiRequest("GET", `/api/logistics-plan/sync/status?${params}`).then((r) => r.json());
    },
  });

  const isAlreadySynced = syncStatus?.isActive === true;
  const syncedAt = syncStatus?.sync?.updatedAt || syncStatus?.sync?.createdAt;

  const syncMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/logistics-plan/sync", {
        periodFrom,
        periodTo,
        scenarioId: scenarioId || null,
      }).then((r) => r.json()),
    onSuccess: () => {
      toast({ title: "План синхронизирован с логистикой" });
      qc.invalidateQueries({ queryKey: ["/api/logistics-plan/sync/status"] });
      navigate("/logistics-plan");
    },
    onError: (e: any) => toast({ title: e?.message || "Ошибка синхронизации", variant: "destructive" }),
  });

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

        <div className="flex flex-col items-end gap-2">
          {/* Top row: action buttons */}
          <div className="flex items-start gap-2">
            {/* Sync button block */}
            <div className="flex flex-col items-end gap-0.5">
              <Button
                className={
                  isAlreadySynced
                    ? "bg-orange-500/60 text-white cursor-not-allowed opacity-70 hover:bg-orange-500/60"
                    : "bg-orange-500 hover:bg-orange-600 text-white shadow-sm"
                }
                size="sm"
                onClick={() => !isAlreadySynced && syncMutation.mutate()}
                disabled={syncMutation.isPending || isAlreadySynced}
                data-testid="button-sync-logistics"
              >
                {isAlreadySynced ? (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                ) : (
                  <Truck className="h-4 w-4 mr-2" />
                )}
                {syncMutation.isPending
                  ? "Синхронизация..."
                  : isAlreadySynced
                  ? "Запущен в логистику"
                  : "Запустить в план логистики"}
              </Button>
              {/* Sync status hint */}
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                {isAlreadySynced ? (
                  <>
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    Синхронизирован
                    {syncedAt ? (
                      <>
                        {" "}·{" "}
                        {format(new Date(syncedAt), "dd.MM.yyyy HH:mm", { locale: ru })}
                      </>
                    ) : null}
                  </>
                ) : (
                  <>
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    Не запущен
                  </>
                )}
              </span>
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

          {/* Bottom row: scenario selector */}
          <ScenarioSelector
            selectedScenarioId={scenarioId}
            onScenarioChange={setScenarioId}
          />
        </div>
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
          <VolumesTab period={period} scenarioId={scenarioId} />
        </TabsContent>

        <TabsContent value="warehouses" className="mt-4">
          <WarehousesPlanFactTab period={period} scenarioId={scenarioId} />
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
