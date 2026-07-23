import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, ChevronDown, Layers, Copy, FilePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

interface PlanningScenario {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  createdAt?: string | null;
}

interface ScenarioSelectorProps {
  selectedScenarioId: string | null;
  onScenarioChange: (scenarioId: string | null) => void;
}

const DEFAULT_LABEL = "Основной";

export function ScenarioSelector({ selectedScenarioId, onScenarioChange }: ScenarioSelectorProps) {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const canManage = hasPermission("planning", "allocate");

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [cloneMode, setCloneMode] = useState<"empty" | "current">("current");

  const { data: scenarios = [] } = useQuery<PlanningScenario[]>({
    queryKey: ["/api/planning/scenarios"],
    queryFn: async () => (await apiRequest("GET", "/api/planning/scenarios")).json(),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const body: any = { name };
      if (cloneMode === "current") {
        body.cloneFrom = selectedScenarioId;
      }
      return (await apiRequest("POST", "/api/planning/scenarios", body)).json();
    },
    onSuccess: (created: PlanningScenario) => {
      queryClient.invalidateQueries({ queryKey: ["/api/planning/scenarios"] });
      toast({ title: "Сценарий создан", description: created.name });
      onScenarioChange(created.id);
      setCreateOpen(false);
      setName("");
    },
    onError: (err: any) => {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/planning/scenarios/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/planning/scenarios"] });
      toast({ title: "Сценарий удалён" });
      if (deleteId === selectedScenarioId) {
        onScenarioChange(null);
      }
      setDeleteId(null);
    },
    onError: (err: any) => {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    },
  });

  const selectedName = selectedScenarioId
    ? scenarios.find((s) => s.id === selectedScenarioId)?.name || "..."
    : DEFAULT_LABEL;

  const isAltScenario = !!selectedScenarioId;

  return (
    <>
      {/* Highlighted scenario frame */}
      <div
        className={
          isAltScenario
            ? "flex items-center gap-2 px-3 py-1.5 rounded-md border-2 border-amber-400 dark:border-amber-500 bg-amber-50 dark:bg-amber-950/30 scenario-pulse"
            : "flex items-center gap-2"
        }
      >
        {isAltScenario && (
          <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap">
            Сценарий:
          </span>
        )}

        {/* Scenario picker */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={isAltScenario ? "ghost" : "outline"}
              size="sm"
              className={`gap-1.5 max-w-[220px] ${isAltScenario ? "text-amber-700 dark:text-amber-300 font-semibold hover:bg-amber-100 dark:hover:bg-amber-900/40" : ""}`}
              data-testid="button-scenario-selector"
            >
              <Layers className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{selectedName}</span>
              <ChevronDown className="h-3.5 w-3.5 ml-auto flex-shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem
              onClick={() => onScenarioChange(null)}
              className="flex items-center justify-between"
              data-testid="scenario-option-default"
            >
              <span>{DEFAULT_LABEL}</span>
              {!selectedScenarioId && (
                <Badge variant="default" className="text-xs">активный</Badge>
              )}
            </DropdownMenuItem>
            {scenarios.length > 0 && <DropdownMenuSeparator />}
            {scenarios.map((s) => (
              <DropdownMenuItem
                key={s.id}
                className="flex items-center justify-between gap-2 pr-1"
                data-testid={`scenario-option-${s.id}`}
              >
                <span
                  className="flex-1 truncate cursor-pointer"
                  onClick={() => onScenarioChange(s.id)}
                >
                  {s.name}
                </span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {s.id === selectedScenarioId && (
                    <Badge variant="default" className="text-xs">выбран</Badge>
                  )}
                  {canManage && (
                    <button
                      className="text-muted-foreground hover:text-destructive transition-colors p-0.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteId(s.id);
                      }}
                      title="Удалить сценарий"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Add scenario button */}
        {canManage && (
          <Button
            size="sm"
            variant={isAltScenario ? "ghost" : "outline"}
            className={isAltScenario ? "text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40" : ""}
            onClick={() => {
              setName("");
              setCloneMode("current");
              setCreateOpen(true);
            }}
            data-testid="button-add-scenario"
          >
            <Plus className="h-4 w-4 mr-1" />
            Добавить сценарий
          </Button>
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Создать сценарий планирования</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="scenario-name">Название сценария</Label>
              <Input
                id="scenario-name"
                placeholder="Например: Оптимистичный, Консервативный..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                data-testid="input-scenario-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Способ создания</Label>
              <RadioGroup
                value={cloneMode}
                onValueChange={(v) => setCloneMode(v as "empty" | "current")}
                className="space-y-2"
              >
                <div className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover-elevate"
                  onClick={() => setCloneMode("current")}>
                  <RadioGroupItem value="current" id="clone-current" className="mt-0.5" />
                  <div>
                    <label htmlFor="clone-current" className="font-medium text-sm cursor-pointer flex items-center gap-1.5">
                      <Copy className="h-3.5 w-3.5" />
                      На основе текущего
                    </label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Скопирует все плановые записи из сценария «{selectedName}»
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover-elevate"
                  onClick={() => setCloneMode("empty")}>
                  <RadioGroupItem value="empty" id="clone-empty" className="mt-0.5" />
                  <div>
                    <label htmlFor="clone-empty" className="font-medium text-sm cursor-pointer flex items-center gap-1.5">
                      <FilePlus className="h-3.5 w-3.5" />
                      С нуля
                    </label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Пустой сценарий без плановых данных
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!name.trim() || createMutation.isPending}
              data-testid="button-confirm-create-scenario"
            >
              {createMutation.isPending ? "Создание..." : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить сценарий?</AlertDialogTitle>
            <AlertDialogDescription>
              Все плановые записи этого сценария будут удалены. Действие необратимо.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
