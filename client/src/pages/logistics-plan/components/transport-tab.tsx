import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Plus, Truck, User, History, Pencil, Trash2, Calendar, Wrench } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AuditPanel } from "@/components/audit-panel";
import { TransportUnitDialog } from "./transport-unit-dialog";
import { DriverScheduleDialog } from "./driver-schedule-dialog";
import { VehicleAvailabilityDialog } from "./vehicle-availability-dialog";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface TransportTabProps {
  periodFrom: string;
  periodTo: string;
}

export function TransportTab({ periodFrom, periodTo }: TransportTabProps) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [auditOpen, setAuditOpen] = useState(false);
  const [auditEntityId, setAuditEntityId] = useState<string | null>(null);
  const [unitDialogOpen, setUnitDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<any | null>(null);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduleDriverId, setScheduleDriverId] = useState<string | null>(null);
  const [scheduleDriverName, setScheduleDriverName] = useState<string>("");
  const [availabilityDialogOpen, setAvailabilityDialogOpen] = useState(false);
  const [availabilityVehicleId, setAvailabilityVehicleId] = useState<string | null>(null);
  const [availabilityVehicleReg, setAvailabilityVehicleReg] = useState<string>("");

  const { data: units = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/logistics-plan/transport-units", periodFrom, periodTo],
    queryFn: () =>
      apiRequest(`/api/logistics-plan/transport-units?periodFrom=${periodFrom}&periodTo=${periodTo}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/logistics-plan/transport-units/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/logistics-plan/transport-units"] });
      toast({ title: "Транспортная единица удалена" });
    },
    onError: () => toast({ title: "Ошибка удаления", variant: "destructive" }),
  });

  const openAudit = (id: string) => {
    setAuditEntityId(id);
    setAuditOpen(true);
  };

  const openEdit = (unit: any) => {
    setEditingUnit(unit);
    setUnitDialogOpen(true);
  };

  const openSchedule = (unit: any) => {
    setScheduleDriverId(unit.driverId);
    setScheduleDriverName(unit.driver?.fullName || "");
    setScheduleDialogOpen(true);
  };

  const openVehicleAvailability = (unit: any) => {
    setAvailabilityVehicleId(unit.vehicleId);
    setAvailabilityVehicleReg(unit.vehicle?.regNumber || "");
    setAvailabilityDialogOpen(true);
  };

  const formatPeriod = (dateFrom: string, dateTo: string) => {
    try {
      return `${format(new Date(dateFrom), "dd.MM", { locale: ru })} – ${format(new Date(dateTo), "dd.MM.yy", { locale: ru })}`;
    } catch {
      return `${dateFrom} – ${dateTo}`;
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Транспортные единицы (связки перевозчик + тягач + прицеп + водитель) на период
        </p>
        <Button
          onClick={() => { setEditingUnit(null); setUnitDialogOpen(true); }}
          data-testid="button-add-transport-unit"
        >
          <Plus className="h-4 w-4 mr-2" />
          Добавить
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Перевозчик</TableHead>
              <TableHead>Тягач (рег. номер)</TableHead>
              <TableHead>Полуприцеп</TableHead>
              <TableHead>Объём, м³</TableHead>
              <TableHead>Водитель</TableHead>
              <TableHead>Доступность водителя</TableHead>
              <TableHead>Доступность ТС</TableHead>
              <TableHead>Местонахождение</TableHead>
              <TableHead className="sticky right-0 bg-background z-10">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  Загрузка...
                </TableCell>
              </TableRow>
            ) : units.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  Нет транспортных единиц. Добавьте первую.
                </TableCell>
              </TableRow>
            ) : (
              units.map((unit: any) => (
                <TableRow key={unit.id} data-testid={`row-transport-unit-${unit.id}`}>
                  <TableCell className="font-medium">
                    {unit.carrier?.name || <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    {unit.vehicle?.regNumber ? (
                      <div className="flex items-center gap-1">
                        <Truck className="h-3 w-3 text-muted-foreground" />
                        <span>{unit.vehicle.regNumber}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {unit.trailer?.regNumber || <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    {unit.trailerCapacityM3 ? (
                      <span>{parseFloat(unit.trailerCapacityM3).toFixed(1)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {unit.driver?.fullName ? (
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span>{unit.driver.fullName}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {unit.driverId ? (
                      unit.driverUnavailable ? (
                        <Badge variant="destructive" className="text-xs">Недоступен</Badge>
                      ) : unit.driverScheduleForPeriod?.length > 0 ? (
                        <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-300">
                          Есть ограничения
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-green-600 border-green-300">Доступен</Badge>
                      )
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {unit.vehicleId ? (
                      unit.vehicleUnavailable ? (
                        <div className="flex flex-col gap-0.5">
                          <Badge variant="destructive" className="text-xs">Недоступен</Badge>
                          {unit.vehicleAvailabilityForPeriod?.map((a: any) => (
                            <span key={a.id} className="text-xs text-muted-foreground">
                              {a.type === "maintenance" ? "ТО" : a.type === "repair" ? "Ремонт" : a.reason || a.type}
                              {" "}до {a.dateTo ? format(new Date(a.dateTo), "dd.MM", { locale: ru }) : "—"}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-xs text-green-600 border-green-300">Доступен</Badge>
                      )
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {unit.currentLocationName ? (
                      <span className="text-sm">{unit.currentLocationName}</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">Не указано</span>
                    )}
                  </TableCell>
                  <TableCell className="sticky right-0 bg-background z-10">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`menu-transport-${unit.id}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(unit)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Редактировать
                        </DropdownMenuItem>
                        {unit.driverId && (
                          <DropdownMenuItem onClick={() => openSchedule(unit)}>
                            <Calendar className="h-4 w-4 mr-2" />
                            Табель водителя
                          </DropdownMenuItem>
                        )}
                        {unit.vehicleId && (
                          <DropdownMenuItem onClick={() => openVehicleAvailability(unit)}>
                            <Wrench className="h-4 w-4 mr-2" />
                            Доступность ТС
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => openAudit(unit.id)}>
                          <History className="h-4 w-4 mr-2" />
                          История изменений
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => deleteMutation.mutate(unit.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Удалить
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <TransportUnitDialog
        open={unitDialogOpen}
        onOpenChange={setUnitDialogOpen}
        editingUnit={editingUnit}
        periodFrom={periodFrom}
        periodTo={periodTo}
      />

      {scheduleDriverId && (
        <DriverScheduleDialog
          open={scheduleDialogOpen}
          onOpenChange={setScheduleDialogOpen}
          driverId={scheduleDriverId}
          driverName={scheduleDriverName}
          periodFrom={periodFrom}
          periodTo={periodTo}
        />
      )}

      {availabilityVehicleId && (
        <VehicleAvailabilityDialog
          open={availabilityDialogOpen}
          onOpenChange={setAvailabilityDialogOpen}
          vehicleId={availabilityVehicleId}
          vehicleRegNumber={availabilityVehicleReg}
          periodFrom={periodFrom}
          periodTo={periodTo}
        />
      )}

      {auditEntityId && (
        <AuditPanel
          open={auditOpen}
          onOpenChange={setAuditOpen}
          entityType="logistics_transport_units"
          entityId={auditEntityId}
        />
      )}
    </div>
  );
}
