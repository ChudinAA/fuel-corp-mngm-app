import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Maximize2 } from "lucide-react";
import type { Opt } from "@shared/schema";
import { AddOptDialog } from "./opt/components/add-opt-dialog";
import { OptTable } from "./opt/components/opt-table";

export default function OptPage() {
  const [editingOpt, setEditingOpt] = useState<Opt | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const queryClient = useQueryClient();

  const { data: optDeals } = useQuery<{ data: Opt[]; total: number }>({
    queryKey: ["/api/opt?page=1&pageSize=1000"],
  });

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingOpt(null);
  };

  const handleOpenDialog = () => {
    setEditingOpt(null);
    setIsDialogOpen(true);
  };

  const handleEditOpt = (opt: Opt) => {
    setEditingOpt(opt);
    setIsDialogOpen(true);
  };

  const handleOptDeleted = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/opt"] });
  };

  // Вычисление накопительной прибыли за текущий месяц
  const cumulativeProfit = optDeals?.data?.reduce((sum, deal) => {
    const dealDate = new Date(deal.createdAt);
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
          <h1 className="text-2xl font-semibold">Оптовые продажи (ОПТ)</h1>
          <p className="text-muted-foreground">
            Учет оптовых сделок с автоматическим расчетом цен
          </p>
          <p className="text-sm font-medium mt-2">
            Прибыль накопительно (текущий месяц): <span className="text-green-600">{cumulativeProfit.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽</span>
          </p>
        </div>
        <Button onClick={handleOpenDialog} data-testid="button-add-opt">
          <Plus className="mr-2 h-4 w-4" />
          Новая сделка
        </Button>
      </div>

      <AddOptDialog
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        editOpt={editingOpt}
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Список сделок</CardTitle>
            <CardDescription>
              Последние 10 записей
            </CardDescription>
          </div>
          <Dialog open={isFullScreen} onOpenChange={setIsFullScreen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon">
                <Maximize2 className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] h-[90vh]">
              <DialogHeader>
                <DialogTitle>Все оптовые сделки</DialogTitle>
                <DialogDescription>
                  Полный список сделок с фильтрацией и поиском
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="flex-1">
                <OptTable 
                  onEdit={handleEditOpt}
                  onDelete={handleOptDeleted}
                />
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <OptTable 
            onEdit={handleEditOpt}
            onDelete={handleOptDeleted}
          />
        </CardContent>
      </Card>
    </div>
  );
}