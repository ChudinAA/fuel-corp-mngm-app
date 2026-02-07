import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Maximize2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/use-auth";
import type { RefuelingAbroad } from "@shared/schema";
import { RefuelingAbroadTable } from "./components/refueling-abroad-table";
import { AddRefuelingAbroadDialog } from "./components/add-refueling-abroad-dialog";

export default function RefuelingAbroadPage() {
  const [editingRefueling, setEditingRefueling] = useState<RefuelingAbroad | null>(null);
  const [isCopy, setIsCopy] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const { hasPermission } = useAuth();

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

  const handleEdit = (item: RefuelingAbroad) => {
    setEditingRefueling(item);
    setIsCopy(false);
    setIsDialogOpen(true);
  };

  const handleCopy = (item: RefuelingAbroad) => {
    setEditingRefueling(item);
    setIsCopy(true);
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {hasPermission("refueling", "create") && (
          <Button onClick={handleOpenDialog} data-testid="button-add-refueling-abroad">
            <Plus className="mr-2 h-4 w-4" />
            Новая заправка
          </Button>
        )}
      </div>

      <AddRefuelingAbroadDialog
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        editRefueling={editingRefueling}
        isCopy={isCopy}
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <CardTitle>Список заправок за рубежом</CardTitle>
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
                <DialogTitle>Все заправки ВС Зарубеж</DialogTitle>
                <DialogDescription>
                  Полный список заправок с фильтрацией и поиском
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="flex-1">
                <RefuelingAbroadTable onEdit={handleEdit} onCopy={handleCopy} />
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <RefuelingAbroadTable onEdit={handleEdit} onCopy={handleCopy} />
        </CardContent>
      </Card>
    </div>
  );
}
