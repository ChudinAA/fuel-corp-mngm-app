import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import type { MovementDialogProps } from "../types";
import { MovementForm, type MovementFormHandle } from "./movement-form";

export function MovementDialog({
  warehouses,
  suppliers,
  carriers,
  vehicles,
  trailers,
  drivers,
  deliveryCosts,
  editMovement,
  isCopy,
  open,
  onOpenChange,
}: MovementDialogProps) {
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const formRef = useRef<MovementFormHandle>(null);
  const isEditing = !!editMovement && !isCopy;

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      const formState = formRef.current?.getFormState();
      const isDirty = formRef.current?.isDirty();
      const isNewRecord = !isEditing;
      const isDraftEdit = isEditing && editMovement?.isDraft;

      if (
        (isNewRecord && formState && (formState.supplierId || formState.fromWarehouseId || formState.toWarehouseId)) ||
        (isDraftEdit && isDirty)
      ) {
        setShowExitConfirm(true);
      } else {
        onOpenChange(false);
      }
    } else {
      onOpenChange(true);
    }
  };

  const handleSaveDraft = async () => {
    if (formRef.current) {
      await formRef.current.saveAsDraft();
      setShowExitConfirm(false);
      onOpenChange(false);
    }
  };

  const handleDiscard = () => {
    setShowExitConfirm(false);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[950px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isCopy
                ? "Копирование перемещения"
                : isEditing
                  ? editMovement?.isDraft
                    ? "Редактирование черновика"
                    : "Редактирование перемещения"
                  : "Новое перемещение"}
            </DialogTitle>
            <DialogDescription>
              {isCopy
                ? "Создание нового перемещения на основе существующего"
                : isEditing
                  ? "Изменение существующей записи"
                  : "Создание записи о поставке или внутреннем перемещении"}
            </DialogDescription>
          </DialogHeader>
          
          <MovementForm
            ref={formRef}
            warehouses={warehouses}
            suppliers={suppliers}
            carriers={carriers}
            vehicles={vehicles}
            trailers={trailers}
            drivers={drivers}
            deliveryCosts={deliveryCosts}
            editMovement={editMovement}
            isCopy={isCopy}
            onSuccess={() => onOpenChange(false)}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={showExitConfirm} onOpenChange={setShowExitConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Сохранить черновик?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы начали вводить данные. Хотите сохранить изменения как черновик перед закрытием?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDiscard}>Нет</AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveDraft}>Да, сохранить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
