import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Pencil,
  Trash2,
  Warehouse as WarehouseIcon,
  Droplets,
  Fuel,
  Loader2,
  Plane,
  Globe2,
  Pin,
  ClipboardList,
  Gauge,
} from "lucide-react";
import {
  EntityActionsMenu,
  EntityAction,
} from "@/components/entity-actions-menu";
import { AuditPanel } from "@/components/audit-panel";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useErrorModal } from "@/hooks/use-error-modal";
import type { Warehouse, Base } from "@shared/schema";
import type { WarehouseTransaction } from "../types";
import { formatNumber, formatCurrency } from "../utils";
import { BASE_TYPE, PRODUCT_TYPE } from "@shared/constants";
import { useAuth } from "@/hooks/use-auth";
import { ProductTypeBadge } from "@/components/product-type-badge";
import { InventoryDialog } from "./inventory-dialog";
import { SetLimitDialog } from "./set-limit-dialog";

interface WarehouseCardProps {
  warehouse: Warehouse;
  onEdit: (warehouse: Warehouse) => void;
  onViewDetails: (warehouse: Warehouse) => void;
  isBase?: boolean;
}

function getServiceLabel(svc: { serviceName?: string | null; serviceType: string }): string {
  if (svc.serviceName && svc.serviceName.trim()) return svc.serviceName.trim();
  if (svc.serviceType === "royalty_per_ton") return "Роялти/т";
  if (svc.serviceType === "percent_of_amount") return "% от суммы";
  if (svc.serviceType === "fixed") return "Фиксированная";
  return svc.serviceType;
}

function formatServiceValue(serviceType: string, serviceValue: string): string {
  const value = parseFloat(serviceValue || "0");
  if (serviceType === "royalty_per_ton") return `${formatNumber(value)} ₽/т`;
  if (serviceType === "percent_of_amount") return `${formatNumber(value)}%`;
  if (serviceType === "fixed") return `${formatNumber(value)} ₽`;
  return serviceValue;
}

function isLimitActive(warehouse: Warehouse): boolean {
  if (!warehouse.limitVolume || !warehouse.limitExpiresAt) return false;
  const expires = new Date(warehouse.limitExpiresAt);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return expires > today;
}

export function WarehouseCard({
  warehouse,
  onEdit,
  onViewDetails,
  isBase = false,
}: WarehouseCardProps) {
  const { toast } = useToast();
  const { showError, ErrorModalComponent } = useErrorModal();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [limitOpen, setLimitOpen] = useState(false);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const balance = parseFloat(warehouse.currentBalance || "0");
  const cost = parseFloat(warehouse.averageCost || "0");
  const pvkjBalance = parseFloat(warehouse.pvkjBalance || "0");
  const pvkjCost = parseFloat(warehouse.pvkjAverageCost || "0");
  const isInactive = !warehouse.isActive;
  const { hasPermission } = useAuth();

  const storageCostValue = warehouse.storageCost
    ? parseFloat(warehouse.storageCost)
    : 0;
  const hasStorageCost = storageCostValue > 0;
  const services = warehouse.services || [];
  const hasServices = services.length > 0;

  const limitActive = isLimitActive(warehouse);
  const limitVolume = parseFloat(warehouse.limitVolume || "0");
  const limitProductType = warehouse.limitProductType || PRODUCT_TYPE.KEROSENE;

  const { data: allBases } = useQuery<Base[]>({
    queryKey: ["/api/bases"],
  });

  const {
    data: monthStats = { income: 0, expense: 0, pvkjIncome: 0, pvkjExpense: 0 },
  } = useQuery<{
    income: number;
    expense: number;
    pvkjIncome: number;
    pvkjExpense: number;
  }>({
    queryKey: [`/api/warehouses/${warehouse.id}/monthly-stats`],
  });

  // Compute limit used from monthly stats
  const limitUsed = limitActive
    ? limitProductType === PRODUCT_TYPE.PVKJ
      ? monthStats.pvkjIncome
      : monthStats.income
    : 0;
  const limitRemaining = limitVolume - limitUsed;
  const limitExceeded = limitRemaining < 0;

  const getBaseIcon = (baseType: string) => {
    if (baseType === BASE_TYPE.REFUELING) {
      return { icon: Fuel, color: "text-green-400", label: "Заправка" };
    }
    return { icon: Droplets, color: "text-orange-400", label: "ОПТ" };
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/warehouses/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      toast({ title: "Склад удален", description: "Запись успешно удалена" });
    },
    onError: () => {
      showError("Не удалось удалить склад");
    },
  });

  const pinMutation = useMutation({
    mutationFn: async (isPinned: boolean) => {
      const res = await apiRequest("PATCH", `/api/warehouses/${warehouse.id}/pin`, { isPinned });
      if (!res.ok) throw new Error("Ошибка закрепления");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
    },
    onError: () => {
      showError("Не удалось изменить закрепление склада");
    },
  });

  const handlePinClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPinDialogOpen(true);
  };

  return (
    <>
      <Card
        className={`cursor-pointer hover:shadow-md transition-shadow ${
          isInactive ? "opacity-60" : ""
        }`}
        onClick={() => onViewDetails(warehouse)}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg flex items-center gap-2 flex-wrap">
                <WarehouseIcon className="h-4 w-4 text-sky-400 shrink-0" />
                {isBase && <Plane className="h-4 w-4 text-green-400 shrink-0" />}
                <span className="truncate">{warehouse.name}</span>
                {warehouse.isRecalculating && (
                  <Badge
                    variant="outline"
                    className="animate-pulse flex items-center gap-1 bg-primary/5 text-primary border-primary/20"
                  >
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Расчет...
                  </Badge>
                )}
                {isInactive && <Badge variant="destructive">Неактивен</Badge>}
                {warehouse.isExport && (
                  <>
                    <Badge
                      variant="outline"
                      className="flex items-center gap-1 text-blue-600 border-blue-300 bg-blue-50 dark:bg-blue-950 dark:border-blue-700 dark:text-blue-300"
                      data-testid={`badge-no-vat-${warehouse.id}`}
                    >
                      <Globe2 className="h-3 w-3" />
                      Без НДС
                    </Badge>
                    <Badge
                      variant="outline"
                      className="flex items-center gap-1 text-blue-600 border-blue-300 bg-blue-50 dark:bg-blue-950 dark:border-blue-700 dark:text-blue-300"
                      data-testid={`badge-export-${warehouse.id}`}
                    >
                      Экспорт
                    </Badge>
                  </>
                )}
                {/* Limit badge */}
                {limitActive && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          variant="outline"
                          className={`flex items-center gap-1 cursor-default ${
                            limitExceeded
                              ? "text-red-600 border-red-300 bg-red-50 dark:bg-red-950 dark:border-red-700 dark:text-red-300"
                              : "text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-700 dark:text-amber-300"
                          }`}
                          data-testid={`badge-limit-${warehouse.id}`}
                        >
                          <Gauge className="h-3 w-3" />
                          {limitExceeded ? (
                            <span>Превышен на {formatNumber(Math.abs(limitRemaining))} кг</span>
                          ) : (
                            <span>Лимит: {formatNumber(limitRemaining)} кг</span>
                          )}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          {limitProductType === PRODUCT_TYPE.PVKJ ? "ПВКЖ" : "Керосин"}: лимит {formatNumber(limitVolume)} кг · использовано {formatNumber(limitUsed)} кг
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </CardTitle>
              {warehouse.baseIds && warehouse.baseIds.length > 0 && allBases && (
                <CardDescription className="flex items-center gap-2 mt-1 flex-wrap">
                  {warehouse.baseIds.map((baseId) => {
                    const base = allBases.find((b: any) => b.id === baseId);
                    if (!base) return null;
                    const baseIcon = getBaseIcon(base.baseType);
                    const BaseIcon = baseIcon.icon;
                    return (
                      <TooltipProvider key={baseId}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge
                              variant="outline"
                              className="flex items-center gap-1"
                            >
                              <BaseIcon className={`h-3 w-3 ${baseIcon.color}`} />
                              {base.name}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{baseIcon.label}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })}
                </CardDescription>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {/* Pin button */}
              <div onClick={(e) => e.stopPropagation()}>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handlePinClick}
                        disabled={pinMutation.isPending}
                        data-testid={`button-pin-${warehouse.id}`}
                        className={warehouse.isPinned ? "text-primary" : "text-muted-foreground"}
                      >
                        {pinMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Pin className={`h-4 w-4 ${warehouse.isPinned ? "fill-primary" : ""}`} />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{warehouse.isPinned ? "Открепить склад" : "Закрепить сверху"}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div onClick={(e) => e.stopPropagation()}>
                <EntityActionsMenu
                  actions={[
                    {
                      id: "edit",
                      label: "Редактировать",
                      icon: Pencil,
                      onClick: () => {
                        onEdit(warehouse);
                      },
                      permission: { module: "warehouses", action: "edit" },
                    },
                    {
                      id: "inventory",
                      label: "Инвентаризация",
                      icon: ClipboardList,
                      onClick: () => setInventoryOpen(true),
                      permission: { module: "warehouses", action: "edit" },
                    },
                    {
                      id: "set-limit",
                      label: "Установить лимит",
                      icon: Gauge,
                      onClick: () => setLimitOpen(true),
                      permission: { module: "warehouses", action: "edit" },
                    },
                    {
                      id: "delete",
                      label: "Удалить",
                      icon: Trash2,
                      onClick: () => {
                        if (warehouse.supplierId && warehouse.isActive) {
                          setConfirmMessage(
                            "Данный склад привязан к поставщику. После удаления у поставщика не будет склада. Продолжить?",
                          );
                        } else {
                          setConfirmMessage(
                            "Вы уверены, что хотите удалить этот склад? Это действие нельзя отменить.",
                          );
                        }
                        setDeleteDialogOpen(true);
                      },
                      variant: "destructive" as const,
                      permission: { module: "warehouses", action: "delete" },
                      separatorAfter: true,
                    },
                  ]}
                  audit={{
                    entityType: "warehouses",
                    entityId: warehouse.id,
                    entityName: warehouse.name,
                  }}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-semibold">
                {formatNumber(balance)} кг
              </span>
              <ProductTypeBadge type={PRODUCT_TYPE.KEROSENE} />
            </div>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Себестоимость:{" "}
                <span className="font-medium">{formatCurrency(cost)}/кг</span>
              </span>
              <div className="flex flex-col items-end text-xs gap-0.5">
                <span className="text-muted-foreground text-[12px]">
                  В этом месяце (кг):
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-green-600">
                    +
                    {monthStats.income > 1000
                      ? `${formatNumber(monthStats.income / 1000)}к`
                      : `${formatNumber(monthStats.income)}`}
                  </span>
                  <span className="text-red-600">
                    -
                    {monthStats.expense > 1000
                      ? `${formatNumber(monthStats.expense / 1000)}к`
                      : `${formatNumber(monthStats.expense)}`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {pvkjBalance > 0 && (
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-semibold text-muted-foreground">
                  {formatNumber(pvkjBalance)} кг
                </span>
                <ProductTypeBadge type={PRODUCT_TYPE.PVKJ} />
              </div>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  Себестоимость:{" "}
                  <span className="font-medium">
                    {formatCurrency(pvkjCost)}/кг
                  </span>
                </span>
                <div className="flex flex-col items-end text-xs gap-0.5">
                  <span className="text-muted-foreground text-[12px]">
                    В этом месяце (кг):
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-green-600">
                      +
                      {monthStats.pvkjIncome > 1000
                        ? `${formatNumber(monthStats.pvkjIncome / 1000)}к`
                        : `${formatNumber(monthStats.pvkjIncome)}`}
                    </span>
                    <span className="text-red-600">
                      -
                      {monthStats.pvkjExpense > 1000
                        ? `${formatNumber(monthStats.pvkjExpense / 1000)}к`
                        : `${formatNumber(monthStats.pvkjExpense)}`}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {(hasStorageCost || hasServices) && (
            <div className="pt-2 border-t space-y-1.5">
              {hasStorageCost && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Хранение:</span>
                  <span className="font-medium">
                    {formatNumber(storageCostValue)} ₽/т
                  </span>
                </div>
              )}
              {hasServices && (
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Услуги склада:</span>
                  <div className="flex flex-col gap-1">
                    {services.map((svc, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0 h-4 font-normal"
                        >
                          {getServiceLabel(svc)}
                        </Badge>
                        <span className="font-medium text-foreground">
                          {formatServiceValue(svc.serviceType, svc.serviceValue)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>

        <DeleteConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={(e) => {
            e?.stopPropagation();
            deleteMutation.mutate(warehouse.id);
            setDeleteDialogOpen(false);
          }}
          title="Удалить склад?"
          description={confirmMessage}
          itemName={warehouse.name}
        />
        <ErrorModalComponent />
      </Card>

      {/* Pin confirm dialog */}
      <AlertDialog open={pinDialogOpen} onOpenChange={setPinDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {warehouse.isPinned ? "Открепить склад?" : "Закрепить склад сверху?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {warehouse.isPinned
                ? `Склад «${warehouse.name}» будет убран из закреплённых и перемещён в обычный список.`
                : `Склад «${warehouse.name}» будет закреплён и будет всегда отображаться в верхней части страницы.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                pinMutation.mutate(!warehouse.isPinned);
                setPinDialogOpen(false);
              }}
            >
              {warehouse.isPinned ? "Открепить" : "Закрепить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialogs outside the Card to avoid nesting issues */}
      <InventoryDialog
        warehouse={warehouse}
        open={inventoryOpen}
        onOpenChange={setInventoryOpen}
      />
      <SetLimitDialog
        warehouse={warehouse}
        open={limitOpen}
        onOpenChange={setLimitOpen}
      />
    </>
  );
}
