import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useErrorModal } from "@/hooks/use-error-modal";
import { Combobox } from "@/components/ui/combobox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Plus, Pencil, Trash2, Loader2, Plane, Navigation } from "lucide-react";
import type { Base } from "@shared/schema";

interface Aircraft {
  id: string;
  name: string;
  isActive: boolean;
}

interface FlightNumber {
  id: string;
  number: string;
  basisId: string | null;
  isActive: boolean;
}

export function AviationTab() {
  const { toast } = useToast();
  const { showError, ErrorModalComponent } = useErrorModal();
  const { hasPermission } = useAuth();

  const canCreate = hasPermission("directories", "create");
  const canEdit = hasPermission("directories", "edit");
  const canDelete = hasPermission("directories", "delete");

  // Aircraft state
  const [aircraftDialogOpen, setAircraftDialogOpen] = useState(false);
  const [editingAircraft, setEditingAircraft] = useState<Aircraft | null>(null);
  const [aircraftName, setAircraftName] = useState("");
  const [deletingAircraftId, setDeletingAircraftId] = useState<string | null>(null);

  // Flight numbers state
  const [flightDialogOpen, setFlightDialogOpen] = useState(false);
  const [editingFlight, setEditingFlight] = useState<FlightNumber | null>(null);
  const [flightNumber, setFlightNumber] = useState("");
  const [flightBasisId, setFlightBasisId] = useState<string>("");
  const [deletingFlightId, setDeletingFlightId] = useState<string | null>(null);

  const { data: aircraftList = [], isLoading: aircraftLoading } = useQuery<Aircraft[]>({
    queryKey: ["/api/aircraft"],
  });

  const { data: flightNumbers = [], isLoading: flightsLoading } = useQuery<FlightNumber[]>({
    queryKey: ["/api/flight-numbers"],
  });

  const { data: allFlightBases = [] } = useQuery<Base[]>({
    queryKey: ["/api/bases"],
  });

  const abroadBases = allFlightBases.filter(
    (b) => b.baseType === "abroad" || b.baseType === "refueling"
  );

  // Aircraft mutations
  const createAircraftMutation = useMutation({
    mutationFn: async (name: string) => {
      if (editingAircraft) {
        return apiRequest("PATCH", `/api/aircraft/${editingAircraft.id}`, { name });
      }
      return apiRequest("POST", "/api/aircraft", { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/aircraft"] });
      toast({ title: editingAircraft ? "Борт обновлён" : "Борт добавлен" });
      resetAircraftForm();
    },
    onError: (error: Error) => showError(error.message),
  });

  const deleteAircraftMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/aircraft/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/aircraft"] });
      toast({ title: "Борт удалён" });
      setDeletingAircraftId(null);
    },
    onError: (error: Error) => showError(error.message),
  });

  // Flight number mutations
  const createFlightMutation = useMutation({
    mutationFn: async (data: { number: string; basisId: string | null }) => {
      if (editingFlight) {
        return apiRequest("PATCH", `/api/flight-numbers/${editingFlight.id}`, data);
      }
      return apiRequest("POST", "/api/flight-numbers", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flight-numbers"] });
      toast({ title: editingFlight ? "Номер рейса обновлён" : "Номер рейса добавлен" });
      resetFlightForm();
    },
    onError: (error: Error) => showError(error.message),
  });

  const deleteFlightMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/flight-numbers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flight-numbers"] });
      toast({ title: "Номер рейса удалён" });
      setDeletingFlightId(null);
    },
    onError: (error: Error) => showError(error.message),
  });

  function resetAircraftForm() {
    setAircraftName("");
    setEditingAircraft(null);
    setAircraftDialogOpen(false);
  }

  function resetFlightForm() {
    setFlightNumber("");
    setFlightBasisId("");
    setEditingFlight(null);
    setFlightDialogOpen(false);
  }

  function openEditAircraft(item: Aircraft) {
    setEditingAircraft(item);
    setAircraftName(item.name);
    setAircraftDialogOpen(true);
  }

  function openEditFlight(item: FlightNumber) {
    setEditingFlight(item);
    setFlightNumber(item.number);
    setFlightBasisId(item.basisId || "");
    setFlightDialogOpen(true);
  }

  function handleAircraftSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!aircraftName.trim()) {
      showError("Укажите бортовой номер");
      return;
    }
    createAircraftMutation.mutate(aircraftName.trim());
  }

  function handleFlightSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!flightNumber.trim()) {
      showError("Укажите номер рейса");
      return;
    }
    createFlightMutation.mutate({
      number: flightNumber.trim(),
      basisId: flightBasisId || null,
    });
  }

  const basisOptions = abroadBases.map((b) => ({ value: b.id, label: b.name }));

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Aircraft list */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Plane className="h-5 w-5" />
                Борта
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Список воздушных судов
              </p>
            </div>
            {canCreate && (
              <Button
                size="sm"
                onClick={() => { resetAircraftForm(); setAircraftDialogOpen(true); }}
                data-testid="button-add-aircraft"
              >
                <Plus className="h-4 w-4 mr-1" />
                Добавить
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {aircraftLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : aircraftList.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Нет бортов. Добавьте первый.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Бортовой номер</TableHead>
                    {(canEdit || canDelete) && (
                      <TableHead className="w-24 text-right">Действия</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aircraftList.map((item) => (
                    <TableRow key={item.id} data-testid={`row-aircraft-${item.id}`}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      {(canEdit || canDelete) && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {canEdit && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => openEditAircraft(item)}
                                data-testid={`button-edit-aircraft-${item.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setDeletingAircraftId(item.id)}
                                data-testid={`button-delete-aircraft-${item.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Flight numbers list */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Navigation className="h-5 w-5" />
                Номера рейсов
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Список рейсов, привязанных к базисам
              </p>
            </div>
            {canCreate && (
              <Button
                size="sm"
                onClick={() => { resetFlightForm(); setFlightDialogOpen(true); }}
                data-testid="button-add-flight"
              >
                <Plus className="h-4 w-4 mr-1" />
                Добавить
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {flightsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : flightNumbers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Нет номеров рейсов. Добавьте первый.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Номер рейса</TableHead>
                    <TableHead>Базис</TableHead>
                    {(canEdit || canDelete) && (
                      <TableHead className="w-24 text-right">Действия</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {flightNumbers.map((item) => {
                    const basis = abroadBases.find((b) => b.id === item.basisId);
                    return (
                      <TableRow key={item.id} data-testid={`row-flight-${item.id}`}>
                        <TableCell className="font-medium">{item.number}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {basis ? basis.name : <span className="text-muted-foreground/50">—</span>}
                        </TableCell>
                        {(canEdit || canDelete) && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {canEdit && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => openEditFlight(item)}
                                  data-testid={`button-edit-flight-${item.id}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                              {canDelete && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => setDeletingFlightId(item.id)}
                                  data-testid={`button-delete-flight-${item.id}`}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Aircraft dialog */}
      <Dialog open={aircraftDialogOpen} onOpenChange={(open) => { if (!open) resetAircraftForm(); else setAircraftDialogOpen(true); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingAircraft ? "Редактировать борт" : "Добавить борт"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAircraftSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Бортовой номер</Label>
              <Input
                placeholder="Например: RA-12345"
                value={aircraftName}
                onChange={(e) => setAircraftName(e.target.value)}
                data-testid="input-aircraft-name"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={resetAircraftForm}>
                Отмена
              </Button>
              <Button type="submit" disabled={createAircraftMutation.isPending}>
                {createAircraftMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : editingAircraft ? "Сохранить" : "Создать"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Flight number dialog */}
      <Dialog open={flightDialogOpen} onOpenChange={(open) => { if (!open) resetFlightForm(); else setFlightDialogOpen(true); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingFlight ? "Редактировать рейс" : "Добавить номер рейса"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleFlightSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Номер рейса</Label>
              <Input
                placeholder="Например: SU-1234"
                value={flightNumber}
                onChange={(e) => setFlightNumber(e.target.value)}
                data-testid="input-flight-number-value"
              />
            </div>
            <div className="space-y-2">
              <Label>Базис (зарубеж)</Label>
              <Combobox
                options={[{ value: "", label: "Без базиса" }, ...basisOptions]}
                value={flightBasisId}
                onValueChange={setFlightBasisId}
                placeholder="Выберите базис"
                dataTestId="select-flight-basis"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={resetFlightForm}>
                Отмена
              </Button>
              <Button type="submit" disabled={createFlightMutation.isPending}>
                {createFlightMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : editingFlight ? "Сохранить" : "Создать"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete aircraft confirmation */}
      <AlertDialog open={!!deletingAircraftId} onOpenChange={(open) => { if (!open) setDeletingAircraftId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить борт?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingAircraftId && deleteAircraftMutation.mutate(deletingAircraftId)}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete flight confirmation */}
      <AlertDialog open={!!deletingFlightId} onOpenChange={(open) => { if (!open) setDeletingFlightId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить номер рейса?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingFlightId && deleteFlightMutation.mutate(deletingFlightId)}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ErrorModalComponent />
    </>
  );
}
