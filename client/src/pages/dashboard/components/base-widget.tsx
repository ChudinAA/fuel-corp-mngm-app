
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

interface BaseWidgetProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  onRemove?: () => void;
  isEditMode?: boolean;
  className?: string;
  icon?: React.ElementType;
}

export function BaseWidget({
  title,
  description,
  children,
  onRemove,
  isEditMode = false,
  className,
  icon: Icon,
}: BaseWidgetProps) {
  return (
    <Card 
      className={cn(
        "h-full flex flex-col transition-shadow",
        isEditMode && "hover:shadow-lg",
        className
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2 flex-1">
          {isEditMode && (
            <GripVertical className="h-4 w-4 text-muted-foreground cursor-move flex-shrink-0" />
          )}
          {Icon && <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm font-medium truncate">{title}</CardTitle>
            {description && (
              <CardDescription className="text-xs mt-1 truncate">{description}</CardDescription>
            )}
          </div>
        </div>
        {isEditMode && onRemove && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 flex-shrink-0 hover:bg-destructive hover:text-destructive-foreground"
            onClick={onRemove}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex-1 overflow-auto">
        {children}
      </CardContent>
    </Card>
  );
}
