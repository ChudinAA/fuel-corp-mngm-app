import { useState } from "react";
import { TransportationTable } from "./components/transportation-table";
import { TransportationDialog } from "./components/transportation-dialog";

export default function TransportationPage() {
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [isCopy, setIsCopy] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleClose = () => {
    setIsDialogOpen(false);
    setEditingItem(null);
    setIsCopy(false);
  };

  const handleAdd = () => {
    setEditingItem(null);
    setIsCopy(false);
    setIsDialogOpen(true);
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setIsCopy(false);
    setIsDialogOpen(true);
  };

  const handleCopy = (item: any) => {
    setEditingItem(item);
    setIsCopy(true);
    setIsDialogOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Перевозка</h1>
        <p className="text-muted-foreground">Учёт сделок по перевозке топлива</p>
      </div>

      <TransportationTable onEdit={handleEdit} onCopy={handleCopy} onCreate={handleAdd} />

      <TransportationDialog
        isOpen={isDialogOpen}
        onClose={handleClose}
        editItem={editingItem}
        isCopy={isCopy}
      />
    </div>
  );
}
