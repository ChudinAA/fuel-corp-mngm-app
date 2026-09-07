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

/**
 * MinimizableDialog — замена Dialog для диалогов с возможностью сворачивания.
 *
 * Ключевое решение: modal={false} ВСЕГДА — это предотвращает внутреннее
 * перемонтирование Radix при переключении modal prop, что ранее сбрасывало
 * состояние форм. Блокировку скролла и оверлей обрабатываем вручную
 * в MinimizableDialogContent.
 */
const MinimizableDialog = ({
  isMinimized,
  onOpenChange,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root> & {
  isMinimized?: boolean;
}) => {
  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open && isMinimized) return; // block accidental close while minimized
      onOpenChange?.(open);
    },
    [isMinimized, onOpenChange],
  );

  return (
    <DialogPrimitive.Root
      modal={false}
      onOpenChange={handleOpenChange}
      {...props}
    >
      {children}
    </DialogPrimitive.Root>
  );
};
MinimizableDialog.displayName = "MinimizableDialog";

/**
 * MinimizableDialogContent — замена DialogContent для диалогов с возможностью
 * сворачивания.
 *
 * Стратегия сохранения данных:
 * - Контент ВСЕГДА в DOM (display:none при сворачивании, не unmount).
 * - modal={false} на Root не вызывает перемонтирование при смене состояния.
 * - Скролл страницы блокируется вручную через useEffect.
 * - Оверлей (чёрный фон) рендерится отдельно — только когда развёрнут.
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
      isMinimized,
      onPointerDownOutside,
      onInteractOutside,
      ...props
    },
    ref,
  ) => {
    // Ручная блокировка скролла страницы: только когда диалог развёрнут.
    // При сворачивании скролл восстанавливается, фон становится доступным.
    React.useEffect(() => {
      if (!isMinimized) {
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
    }, [isMinimized]);

    if (typeof document === "undefined") return null;
    return createPortal(
      <>
        {/* Оверлей: только когда развёрнут. Визуально блокирует фон. */}
        {!isMinimized && (
          <div
            className="fixed inset-0 z-50 bg-black/80 animate-in fade-in-0"
            aria-hidden="true"
          />
        )}
        {/* Обёртка контента: всегда в DOM, скрыта через display:none при сворачивании.
            Это сохраняет состояние React (данные форм) без перемонтирования. */}
        <div style={isMinimized ? { display: "none" } : undefined}>
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
