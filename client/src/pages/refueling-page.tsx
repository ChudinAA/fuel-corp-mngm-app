
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Maximize2 } from "lucide-react";
import type { AircraftRefueling } from "@shared/schema";
import { AddRefuelingDialog } from "./refueling/components/add-refueling-dialog";
import { RefuelingTable } from "./refueling/components/refueling-table";
import { useAuth } from "@/hooks/use-auth";

export default function RefuelingPage() {
  const [editingRefueling, setEditingRefueling] = useState<AircraftRefueling | null>(null);
  const [isCopy, setIsCopy] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [productTypeFilter] = useState<string>("all");
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();

  const { data: refuelingDeals } = useQuery<{ data: AircraftRefueling[]; total: number }>({
    queryKey: ["/api/refueling?page=1&pageSize=1000"],
  });

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingRefueling(null);
    setIsCopy(false);
  };

  const handleOpenDialog = () => {
    setEditingRefueling(null);
    setIsCopy(false);
    setIsDialogOpen(true);
  };

  const handleEditRefueling = (refueling: AircraftRefueling) => {
    setEditingRefueling(refueling);
    setIsCopy(false);
    setIsDialogOpen(true);
  };

  const handleCopyRefueling = (refueling: AircraftRefueling) => {
    setEditingRefueling(refueling);
    setIsCopy(true);
    setIsDialogOpen(true);
  };

  const handleRefuelingDeleted = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/refueling"] });
  };

  // Вычисление накопительной прибыли за текущий месяц
  const cumulativeProfit = refuelingDeals?.data?.reduce((sum, deal) => {
    const dealDate = new Date(deal.refuelingDate);
    const now = new Date();
    if (dealDate.getMonth() === now.getMonth() && dealDate.getFullYear() === now.getFullYear()) {
      return sum + parseFloat(deal.profit || "0");
    }
    return sum;
  }, 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Заправка ВС</h1>
          <p className="text-muted-foreground">
            Учет заправок воздушных судов с автоматическим расчетом цен
          </p>
          <p className="text-sm font-medium mt-2">
            Прибыль накопительно (текущий месяц): <span className="text-green-600">{cumulativeProfit.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽</span>
          </p>
        </div>
        {hasPermission("refueling", "create") && (
          <Button onClick={handleOpenDialog} data-testid="button-add-refueling">
            <Plus className="mr-2 h-4 w-4" />
            Новая заправка
          </Button>
        )}
      </div>

      <AddRefuelingDialog
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        editRefueling={editingRefueling}
        isCopy={isCopy}
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Список заправок</CardTitle>
            <CardDescription>
              Последние 10 записей
            </CardDescription>
          </div>
          <Dialog open={isFullScreen} onOpenChange={setIsFullScreen}>
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => setIsFullScreen(true)}
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
            <DialogContent className="max-w-[95vw] h-[90vh]">
              <DialogHeader>
                <DialogTitle>Все заправки ВС</DialogTitle>
                <DialogDescription>
                  Полный список заправок с фильтрацией и поиском
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="flex-1">
                <RefuelingTable 
                  onEdit={handleEditRefueling}
                  onCopy={handleCopyRefueling}
                  onDelete={handleRefuelingDeleted}
                />
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <RefuelingTable 
            onEdit={handleEditRefueling}
            onCopy={handleCopyRefueling}
            onDelete={handleRefuelingDeleted}
          />
        </CardContent>
      </Card>
    </div>
  );
}
