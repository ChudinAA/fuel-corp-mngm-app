import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { RefuelingAbroadForm, type RefuelingAbroadFormHandle } from "./refueling-abroad-form";
import type { AddRefuelingAbroadDialogProps } from "../types";
import { ScrollArea } from "@/components/ui/scroll-area";

export function AddRefuelingAbroadDialog({
  isOpen,
  onClose,
  editRefueling,
  isCopy = false,
}: AddRefuelingAbroadDialogProps) {
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const formRef = useRef<RefuelingAbroadFormHandle>(null);

  const title = editRefueling
    ? isCopy
      ? "Копировать заправку"
      : "Редактировать заправку"
    : "Новая заправка за рубежом";

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      const formState = formRef.current?.getFormState();
      // Если это создание новой заправки и введен поставщик или покупатель
      if (!editRefueling && !isCopy && formState && (formState.supplierId || formState.buyerId)) {
        setShowExitConfirm(true);
      } else {
        onClose();
      }
    }
  };

  const handleSaveDraft = async () => {
    if (formRef.current) {
      await formRef.current.saveAsDraft();
      setShowExitConfirm(false);
      onClose();
    }
  };

  const handleDiscard = () => {
    setShowExitConfirm(false);
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[calc(90vh-80px)] pr-4">
            <RefuelingAbroadForm
              ref={formRef}
              onSuccess={onClose}
              editData={isCopy ? { ...editRefueling!, id: "", originalId: editRefueling?.id } : editRefueling}
            />
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showExitConfirm} onOpenChange={setShowExitConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Сохранить черновик?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы начали вводить данные. Хотите сохранить эту заправку за рубежом как черновик перед закрытием?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDiscard}>Нет, удалить</AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveDraft}>Да, сохранить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
