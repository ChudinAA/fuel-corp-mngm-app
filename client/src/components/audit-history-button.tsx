
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { History } from "lucide-react";
import { AuditPanel } from "./audit-panel";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AuditHistoryButtonProps {
  entityType: string;
  entityId: string;
  entityName?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  showLabel?: boolean;
}

export function AuditHistoryButton({
  entityType,
  entityId,
  entityName,
  variant = "outline",
  size = "sm",
  showLabel = false,
}: AuditHistoryButtonProps) {
  const [open, setOpen] = useState(false);

  const buttonContent = (
    <>
      <History className={showLabel ? "mr-2 h-4 w-4" : "h-4 w-4"} />
      {showLabel && "История"}
    </>
  );

  return (
    <>
      {showLabel ? (
        <Button
          variant={variant}
          size={size}
          onClick={() => setOpen(true)}
          data-testid={`button-audit-history-${entityId}`}
        >
          {buttonContent}
        </Button>
      ) : (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={variant}
                size={size}
                onClick={() => setOpen(true)}
                data-testid={`button-audit-history-${entityId}`}
              >
                {buttonContent}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>История изменений</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      <AuditPanel
        open={open}
        onOpenChange={setOpen}
        entityType={entityType}
        entityId={entityId}
        entityName={entityName}
      />
    </>
  );
}
