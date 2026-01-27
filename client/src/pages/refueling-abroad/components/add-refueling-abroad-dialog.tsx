import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RefuelingAbroadForm } from "./refueling-abroad-form";
import type { AddRefuelingAbroadDialogProps } from "../types";
import { ScrollArea } from "@/components/ui/scroll-area";

export function AddRefuelingAbroadDialog({
  isOpen,
  onClose,
  editRefueling,
  isCopy = false,
}: AddRefuelingAbroadDialogProps) {
  const title = editRefueling
    ? isCopy
      ? "Копировать заправку"
      : "Редактировать заправку"
    : "Новая заправка за рубежом";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-80px)] pr-4">
          <RefuelingAbroadForm
            onSuccess={onClose}
            editData={isCopy ? { ...editRefueling!, id: "" } : editRefueling}
          />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
