import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RefuelingAbroad } from "@shared/schema";
import { RefuelingAbroadTable } from "./components/refueling-abroad-table";
import { AddRefuelingAbroadDialog } from "./components/add-refueling-abroad-dialog";

export default function RefuelingAbroadPage() {
  const [editingRefueling, setEditingRefueling] = useState<RefuelingAbroad | null>(null);
  const [isCopy, setIsCopy] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

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

      <AddRefuelingAbroadDialog
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        editRefueling={editingRefueling}
        isCopy={isCopy}
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <CardTitle>Список сделок Заправок ВС Зарубеж</CardTitle>
        </CardHeader>
        <CardContent>
          <RefuelingAbroadTable onEdit={handleEdit} onCopy={handleCopy} onAdd={handleOpenDialog} />
        </CardContent>
      </Card>
    </div>
  );
}
