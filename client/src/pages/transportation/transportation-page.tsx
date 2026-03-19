import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { TransportationTable } from "./components/transportation-table";
import { TransportationDialog } from "./components/transportation-dialog";

export default function TransportationPage() {
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [isCopy, setIsCopy] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { hasPermission } = useAuth();

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
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Перевозка</h1>
          <p className="text-muted-foreground">Учёт сделок по перевозке топлива</p>
        </div>
        {hasPermission("opt", "create") && (
          <Button onClick={handleAdd} data-testid="button-add-transportation">
            <Plus className="mr-2 h-4 w-4" />
            Новая перевозка
          </Button>
        )}
      </div>

      <TransportationTable onEdit={handleEdit} onCopy={handleCopy} />

      <TransportationDialog
        isOpen={isDialogOpen}
        onClose={handleClose}
        editItem={editingItem}
        isCopy={isCopy}
      />
    </div>
  );
}
