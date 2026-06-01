import { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { ChevronUp, Minus, X } from "lucide-react";

interface UseMinimizableDialogOptions {
  title: string;
  onClose: () => void;
}

export function useMinimizableDialog({ title, onClose }: UseMinimizableDialogOptions) {
  const [isMinimized, setIsMinimized] = useState(false);
  const isMinimizingRef = useRef(false);

  const handleMinimize = useCallback(() => {
    isMinimizingRef.current = true;
    setIsMinimized(true);
  }, []);

  const handleRestore = useCallback(() => {
    isMinimizingRef.current = false;
    setIsMinimized(false);
  }, []);

  const handleCloseFromBar = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMinimized(false);
    onClose();
  }, [onClose]);

  const MinimizedBar = isMinimized
    ? createPortal(
        <div
          className="fixed bottom-0 right-6 z-[9991] bg-background border border-border rounded-t-md shadow-xl flex items-center px-4 py-2.5 gap-2 min-w-[260px] select-none"
          style={{ cursor: "pointer", pointerEvents: "auto" }}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.nativeEvent.stopImmediatePropagation();
          }}
          onClick={(e) => {
            e.stopPropagation();
            handleRestore();
          }}
        >
          <span className="text-sm font-medium flex-1 truncate">{title}</span>
          <Button
            size="icon"
            variant="ghost"
            type="button"
            style={{ pointerEvents: "auto" }}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleRestore();
            }}
            title="Развернуть"
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            type="button"
            style={{ pointerEvents: "auto" }}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
            }}
            onClick={handleCloseFromBar}
            title="Закрыть"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>,
        document.body,
      )
    : null;

  const MinimizeButton = (
    <Button
      size="icon"
      variant="ghost"
      type="button"
      onClick={handleMinimize}
      title="Свернуть"
    >
      <Minus className="h-4 w-4" />
    </Button>
  );

  return {
    isMinimized,
    handleMinimize,
    handleRestore,
    MinimizedBar,
    MinimizeButton,
    isMinimizingRef,
  };
}
