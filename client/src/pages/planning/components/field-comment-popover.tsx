import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { MessageSquare, AlertTriangle, Send, Pencil, Check, X, Flag } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

interface PlanningComment {
  id: string;
  entityType: string;
  entityId: string;
  fieldKey: string;
  userId: string;
  text: string;
  isHighPriority: boolean | null;
  createdAt: string | null;
  userName: string;
}

interface FieldCommentPopoverProps {
  entityType: string;
  entityId: string;
  fieldKey: string;
}

export function FieldCommentPopover({ entityType, entityId, fieldKey }: FieldCommentPopoverProps) {
  const { user } = useAuth();

  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [isHighPriority, setIsHighPriority] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const queryKey = ["/api/planning/comments", entityType, entityId, fieldKey];

  const { data: comments = [] } = useQuery<PlanningComment[]>({
    queryKey,
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/planning/comments?entityType=${entityType}&entityId=${entityId}&fieldKey=${fieldKey}`,
      );
      return res.json();
    },
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/planning/comments", {
        entityType,
        entityId,
        fieldKey,
        text,
        isHighPriority,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setText("");
      setIsHighPriority(false);
    },
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, text: newText }: { id: string; text: string }) => {
      await apiRequest("PATCH", `/api/planning/comments/${id}`, { text: newText });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setEditingId(null);
      setEditText("");
    },
  });

  const togglePriorityMutation = useMutation({
    mutationFn: async ({ id, isHighPriority: val }: { id: string; isHighPriority: boolean }) => {
      await apiRequest("PATCH", `/api/planning/comments/${id}`, { isHighPriority: val });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const hasHighPriority = comments.some((c) => c.isHighPriority);
  const hasComments = comments.length > 0;

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
  };

  const startEdit = (c: PlanningComment) => {
    setEditingId(c.id);
    setEditText(c.text);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  const saveEdit = (id: string) => {
    if (!editText.trim()) return;
    editMutation.mutate({ id, text: editText });
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "relative inline-flex items-center justify-center h-5 w-5 rounded-sm text-muted-foreground hover:text-foreground transition-colors flex-shrink-0",
            hasHighPriority && "text-destructive",
            hasComments && !hasHighPriority && "text-blue-500",
          )}
          title="Комментарии"
          data-testid={`button-comment-${entityId}-${fieldKey}`}
        >
          <MessageSquare
            className={cn(
              "h-3.5 w-3.5",
              hasHighPriority && "animate-comment-pulse-red",
              hasComments && !hasHighPriority && "animate-comment-pulse-blue",
            )}
          />
          {hasComments && (
            <span
              className={cn(
                "absolute -top-1 -right-1 min-w-[14px] h-[14px] rounded-full text-[9px] font-bold flex items-center justify-center px-0.5 leading-none",
                hasHighPriority
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-blue-500 text-white",
              )}
            >
              {comments.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start" side="bottom">
        <div className="p-3 border-b">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">Комментарии</span>
            {hasComments && (
              <Badge variant="secondary" className="text-xs ml-auto">
                {comments.length}
              </Badge>
            )}
          </div>
        </div>

        <div className="max-h-56 overflow-y-auto">
          {comments.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Комментариев нет
            </div>
          ) : (
            <div className="divide-y">
              {comments.map((c) => {
                const isOwn = user?.id === c.userId;
                const isEditing = editingId === c.id;
                return (
                  <div key={c.id} className="p-3 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium">{c.userName}</span>
                      {c.isHighPriority && (
                        <AlertTriangle className="h-3 w-3 text-destructive flex-shrink-0" />
                      )}
                      <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">
                        {c.createdAt
                          ? format(new Date(c.createdAt), "dd.MM HH:mm", { locale: ru })
                          : ""}
                      </span>
                      {isOwn && !isEditing && (
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          <button
                            onClick={() => startEdit(c)}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            title="Редактировать"
                            data-testid={`button-edit-comment-${c.id}`}
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() =>
                              togglePriorityMutation.mutate({
                                id: c.id,
                                isHighPriority: !c.isHighPriority,
                              })
                            }
                            className={cn(
                              "transition-colors",
                              c.isHighPriority
                                ? "text-destructive hover:text-destructive/70"
                                : "text-muted-foreground hover:text-destructive",
                            )}
                            title={c.isHighPriority ? "Снять важность" : "Отметить важным"}
                            data-testid={`button-toggle-priority-${c.id}`}
                          >
                            <Flag className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="space-y-1.5">
                        <Textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="text-sm resize-none"
                          rows={2}
                          autoFocus
                          data-testid={`textarea-edit-comment-${c.id}`}
                        />
                        <div className="flex items-center gap-1.5 justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={cancelEdit}
                            className="h-7 px-2 text-xs"
                          >
                            <X className="h-3 w-3 mr-1" />
                            Отмена
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => saveEdit(c.id)}
                            disabled={!editText.trim() || editMutation.isPending}
                            className="h-7 px-2 text-xs"
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Сохранить
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p
                        className={cn(
                          "text-sm",
                          c.isHighPriority && "text-destructive font-medium",
                        )}
                      >
                        {c.text}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-3 border-t space-y-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Написать комментарий..."
            className="text-sm resize-none"
            rows={2}
            data-testid={`textarea-comment-${entityId}-${fieldKey}`}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsHighPriority(!isHighPriority)}
              className={cn(
                "flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border font-medium transition-all",
                isHighPriority
                  ? "bg-destructive border-destructive text-destructive-foreground shadow-sm"
                  : "border-border text-muted-foreground hover:border-destructive hover:text-destructive",
              )}
              data-testid={`button-high-priority-${entityId}-${fieldKey}`}
            >
              <AlertTriangle className="h-3 w-3" />
              Важно
            </button>
            <Button
              size="sm"
              className="ml-auto"
              disabled={!text.trim() || mutation.isPending}
              onClick={() => mutation.mutate()}
              data-testid={`button-send-comment-${entityId}-${fieldKey}`}
            >
              <Send className="h-3 w-3 mr-1" />
              {mutation.isPending ? "..." : "Отправить"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
