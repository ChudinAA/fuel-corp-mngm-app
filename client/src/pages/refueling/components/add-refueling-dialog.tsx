
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RefuelingForm } from "./refueling-form";
import type { AddRefuelingDialogProps } from "../types";

export function AddRefuelingDialog({
  isOpen,
  onClose,
  editRefueling,
}: AddRefuelingDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[800px] h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editRefueling ? "Редактирование заправки" : "Новая заправка ВС"}</DialogTitle>
          <DialogDescription>
            {editRefueling ? "Измените данные существующей заправки" : "Заполните данные для создания новой заправки ВС"}
          </DialogDescription>
        </DialogHeader>
        <RefuelingForm 
          onSuccess={onClose} 
          editData={editRefueling}
        />
      </DialogContent>
    </Dialog>
  );
}
