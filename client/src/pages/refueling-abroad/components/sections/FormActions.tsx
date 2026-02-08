import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FormActionsProps {
  isEditing: boolean;
  isPending: boolean;
  isDraft: boolean;
  onCancel?: () => void;
  onDraftSubmit: () => void;
}

export function FormActions({
  isEditing,
  isPending,
  isDraft,
  onCancel,
  onDraftSubmit,
}: FormActionsProps) {
  return (
    <div className="flex justify-end gap-3 pt-4 border-t">
      {onCancel && (
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isPending}
        >
          Отмена
        </Button>
      )}
      {!isEditing && (
        <Button
          type="button"
          variant="secondary"
          onClick={onDraftSubmit}
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : null}
          Сохранить как черновик
        </Button>
      )}
      <Button type="submit" disabled={isPending}>
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : null}
        {isEditing ? "Обновить запись" : isDraft ? "Опубликовать" : "Создать запись"}
      </Button>
    </div>
  );
}
