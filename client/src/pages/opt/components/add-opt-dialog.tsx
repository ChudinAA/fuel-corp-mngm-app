
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OptForm } from "./opt-form";
import type { AddOptDialogProps } from "../types";

export function AddOptDialog({
  isOpen,
  onClose,
  editOpt,
}: AddOptDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[800px] h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editOpt ? "Редактирование сделки" : "Новая сделка"}</DialogTitle>
          <DialogDescription>
            {editOpt ? "Измените данные существующей оптовой сделки" : "Заполните данные для создания новой оптовой сделки"}
          </DialogDescription>
        </DialogHeader>
        <OptForm 
          onSuccess={onClose} 
          editData={editOpt}
        />
      </DialogContent>
    </Dialog>
  );
}
