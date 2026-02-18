
import { useState, useRef } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
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
import { OptForm, type OptFormHandle } from "./opt-form";
import type { AddOptDialogProps } from "../types";

export function AddOptDialog({
  isOpen,
  onClose,
  editOpt,
  isCopy,
}: AddOptDialogProps) {
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const formRef = useRef<OptFormHandle>(null);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      const formState = formRef.current?.getFormState();
      const isDirty = formRef.current?.isDirty();
      const isNewDeal = !editOpt && !isCopy;
      const isDraftEdit = !!editOpt && editOpt.isDraft;

      // Если это создание новой сделки и введен поставщик или покупатель
      // ИЛИ если это редактирование существующего черновика и были изменения
      if (
        (isNewDeal && formState && (formState.supplierId && formState.buyerId)) ||
        (isDraftEdit && isDirty)
      ) {
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
        <DialogContent className="sm:max-w-[950px] h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isCopy ? "Копирование сделки" : editOpt ? "Редактирование сделки" : "Новая сделка"}
            </DialogTitle>
            <DialogDescription>
              {isCopy 
                ? "Создание новой сделки на основе существующей" 
                : editOpt 
                  ? "Измените данные существующей оптовой сделки" 
                  : "Заполните данные для создания новой оптовой сделки"}
            </DialogDescription>
          </DialogHeader>
          <OptForm 
            ref={formRef}
            onSuccess={onClose} 
            editData={editOpt ? (isCopy ? { ...editOpt, id: undefined as any } : editOpt) : null}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={showExitConfirm} onOpenChange={setShowExitConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Сохранить черновик?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы начали вводить данные. Хотите сохранить эту сделку как черновик перед закрытием?
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
