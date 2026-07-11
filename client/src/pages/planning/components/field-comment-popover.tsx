import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { MessageSquare, AlertTriangle, Send } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [isHighPriority, setIsHighPriority] = useState(false);

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
    enabled: open,
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

  const hasHighPriority = comments.some((c) => c.isHighPriority);
  const hasComments = comments.length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center justify-center h-5 w-5 rounded-sm text-muted-foreground hover:text-foreground transition-colors flex-shrink-0",
            hasHighPriority && "text-destructive animate-pulse",
            hasComments && !hasHighPriority && "text-blue-500",
          )}
          title="Комментарии"
          data-testid={`button-comment-${entityId}-${fieldKey}`}
        >
          <MessageSquare className="h-3.5 w-3.5" />
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

        <div className="max-h-48 overflow-y-auto">
          {comments.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Комментариев нет
            </div>
          ) : (
            <div className="divide-y">
              {comments.map((c) => (
                <div key={c.id} className="p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">{c.userName}</span>
                    {c.isHighPriority && (
                      <AlertTriangle className="h-3 w-3 text-destructive flex-shrink-0" />
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">
                      {c.createdAt
                        ? format(new Date(c.createdAt), "dd.MM HH:mm", { locale: ru })
                        : ""}
                    </span>
                  </div>
                  <p
                    className={cn(
                      "text-sm",
                      c.isHighPriority && "text-destructive font-medium",
                    )}
                  >
                    {c.text}
                  </p>
                </div>
              ))}
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
                "flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors",
                isHighPriority
                  ? "bg-destructive/10 border-destructive/30 text-destructive"
                  : "border-border text-muted-foreground hover:text-foreground",
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
