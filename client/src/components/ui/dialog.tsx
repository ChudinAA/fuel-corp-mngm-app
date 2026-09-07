"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, onPointerDownOutside, onInteractOutside, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
        className
      )}
      onPointerDownOutside={(e) => {
        e.preventDefault();
        onPointerDownOutside?.(e);
      }}
      onInteractOutside={(e) => {
        e.preventDefault();
        onInteractOutside?.(e);
      }}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

// ─── Minimizable dialog ────────────────────────────────────────────────────────

/**
 * Контекст для передачи open + isMinimized из MinimizableDialog в
 * MinimizableDialogContent без пропс-дриллинга.
 * Это необходимо, чтобы оверлей и scroll-lock знали оба значения,
 * а не только isMinimized (как раньше).
 */
const MinimizableDialogCtx = React.createContext<{
  open: boolean;
  isMinimized: boolean;
}>({ open: false, isMinimized: false });

/**
 * MinimizableDialog — обёртка над DialogPrimitive.Root.
 *
 * Всегда modal={false}: это единственный надёжный способ не дать Radix
 * перемонтировать Content при смене prop modal, что сбрасывало бы данные форм.
 * Scroll-lock и оверлей управляются вручную в MinimizableDialogContent.
 */
const MinimizableDialog = ({
  isMinimized = false,
  open,
  onOpenChange,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root> & {
  isMinimized?: boolean;
}) => {
  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      // Не закрываем диалог кликом снаружи пока он свёрнут —
      // пользователь должен явно закрыть через кнопку.
      if (!next && isMinimized) return;
      onOpenChange?.(next);
    },
    [isMinimized, onOpenChange],
  );

  return (
    <MinimizableDialogCtx.Provider value={{ open: open ?? false, isMinimized }}>
      <DialogPrimitive.Root
        modal={false}
        open={open}
        onOpenChange={handleOpenChange}
        {...props}
      >
        {children}
      </DialogPrimitive.Root>
    </MinimizableDialogCtx.Provider>
  );
};
MinimizableDialog.displayName = "MinimizableDialog";

/**
 * MinimizableDialogContent — замена DialogContent для диалогов с возможностью
 * сворачивания.
 *
 * Стратегия сохранения данных форм:
 * - Content всегда в DOM (display:none при сворачивании, а не unmount).
 * - modal={false} на Root — Radix не перемонтирует Content при смене состояния.
 * - Scroll-lock управляется через useEffect: активен только когда open && !isMinimized.
 * - Оверлей — отдельный plain div: рендерится только когда open && !isMinimized.
 *   Это ключевой момент: если проверять только !isMinimized без open,
 *   оверлей остаётся видимым когда диалог закрыт, блокируя весь UI.
 */
const MinimizableDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    isMinimized?: boolean;
  }
>(
  (
    {
      className,
      children,
      isMinimized: isMinimizedProp,
      onPointerDownOutside,
      onInteractOutside,
      ...props
    },
    ref,
  ) => {
    // Читаем open + isMinimized из контекста, prop isMinimized — для обратной совместимости
    const ctx = React.useContext(MinimizableDialogCtx);
    const open = ctx.open;
    const isMinimized = isMinimizedProp ?? ctx.isMinimized;

    // Scroll-lock: только когда диалог открыт и не свёрнут
    React.useEffect(() => {
      if (open && !isMinimized) {
        const scrollbarWidth =
          window.innerWidth - document.documentElement.clientWidth;
        document.body.style.overflow = "hidden";
        if (scrollbarWidth > 0) {
          document.body.style.paddingRight = `${scrollbarWidth}px`;
        }
        return () => {
          document.body.style.overflow = "";
          document.body.style.paddingRight = "";
        };
      }
    }, [open, isMinimized]);

    if (typeof document === "undefined") return null;

    return createPortal(
      <>
        {/* Оверлей: только когда диалог открыт и не свёрнут.
            Критично: без проверки open оверлей остаётся после закрытия диалога. */}
        {open && !isMinimized && (
          <div
            className="fixed inset-0 z-50 bg-black/80 animate-in fade-in-0"
            aria-hidden="true"
          />
        )}

        {/* Контент: всегда в DOM (display:none при сворачивании или закрытии).
            display:none сохраняет React-стейт (данные форм) без перемонтирования. */}
        <div style={!open || isMinimized ? { display: "none" } : undefined}>
          <DialogPrimitive.Content
            ref={ref}
            className={cn(
              "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
              className,
            )}
            onEscapeKeyDown={(e) => {
              if (isMinimized) e.preventDefault();
            }}
            onPointerDownOutside={(e) => {
              e.preventDefault();
              onPointerDownOutside?.(e);
            }}
            onInteractOutside={(e) => {
              e.preventDefault();
              onInteractOutside?.(e);
            }}
            {...props}
          >
            {children}
            <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </DialogPrimitive.Content>
        </div>
      </>,
      document.body,
    );
  },
);
MinimizableDialogContent.displayName = "MinimizableDialogContent";

export {
  Dialog,
  MinimizableDialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  MinimizableDialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
