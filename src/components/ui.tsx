import { cva, type VariantProps } from "class-variance-authority";
import { ChevronDown, Star, X } from "lucide-react";
import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/utils";

/* ---------------------------------- Button --------------------------------- */

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0 select-none",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-transparent hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        success: "bg-success text-success-foreground hover:bg-success/90",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        xs: "h-7 rounded px-2 text-xs [&_svg]:size-3.5",
        lg: "h-11 rounded-md px-6 text-base",
        icon: "h-9 w-9",
        iconSm: "h-8 w-8",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";

/* ---------------------------------- Inputs --------------------------------- */

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-[72px] w-full resize-y rounded-md border border-input bg-background/50 px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          "h-9 w-full appearance-none rounded-md border border-input bg-background/50 pl-3 pr-8 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  ),
);
Select.displayName = "Select";

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground", className)}
      {...props}
    />
  );
}

/* ---------------------------------- Badge ---------------------------------- */

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary/15 text-primary",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-border text-muted-foreground",
        success: "border-transparent bg-emerald-500/15 text-emerald-500",
        warning: "border-transparent bg-amber-500/15 text-amber-500",
        destructive: "border-transparent bg-red-500/15 text-red-400",
        blue: "border-transparent bg-sky-500/15 text-sky-400",
        violet: "border-transparent bg-violet-500/15 text-violet-400",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

/* ---------------------------------- Card ----------------------------------- */

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg border bg-card text-card-foreground shadow-card", className)} {...props} />;
}

/* ---------------------------------- Kbd ------------------------------------ */

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1 font-mono text-[10px] font-medium text-muted-foreground",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

/* --------------------------------- Switch ---------------------------------- */

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  label,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50",
        checked ? "bg-primary" : "bg-input",
      )}
    >
      <span
        className={cn(
          "pointer-events-none block h-4 w-4 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-[18px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

/* -------------------------------- Collapsible ------------------------------ */

export function Collapsible({
  title,
  children,
  defaultOpen = false,
  className,
  badge,
  icon,
}: {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  badge?: ReactNode;
  icon?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={cn("rounded-md border border-border/70", className)}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <span className="flex items-center gap-2">
          {icon}
          {title}
          {badge}
        </span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="border-t border-border/70 px-3 py-3 text-sm">{children}</div>}
    </div>
  );
}

/* --------------------------------- Dialog ---------------------------------- */

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useRef(`dialog-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = setTimeout(() => {
      const focusable =
        panelRef.current?.querySelector<HTMLElement>("[data-dialog-autofocus]") ??
        panelRef.current?.querySelector<HTMLElement>(
          "input:not([disabled]), select:not([disabled]), textarea:not([disabled])",
        ) ??
        panelRef.current?.querySelector<HTMLElement>("button:not([disabled]), a[href]");
      focusable?.focus();
    }, 30);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      clearTimeout(timer);
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = {
    sm: "max-w-sm",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  return createPortal(
    <div
      className="dialog-overlay fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId.current}
        className={cn(
          "dialog-content flex max-h-[92vh] w-full flex-col overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-2xl",
          widths[size],
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId.current} className="text-base font-semibold">
              {title}
            </h2>
            {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
          </div>
          <Button variant="ghost" size="iconSm" onClick={onClose} aria-label="Close dialog">
            <X />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t bg-muted/30 px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/* -------------------------------- Rating ----------------------------------- */

export function RatingStars({ value, className }: { value: number | null; className?: string }) {
  const rating = value ?? 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => {
        const fill = Math.max(0, Math.min(1, rating - star + 1));
        return (
          <span key={star} className="relative inline-block h-3.5 w-3.5">
            <Star className="absolute inset-0 h-3.5 w-3.5 text-muted-foreground/30" />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            </span>
          </span>
        );
      })}
    </span>
  );
}

/* -------------------------------- Toaster ---------------------------------- */

interface ToastItem {
  id: string;
  title: string;
  tone: "info" | "success" | "error";
}

const ToastContext = createContext<{ push: (title: string, tone?: ToastItem["tone"]) => void }>({
  push: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = (title: string, tone: ToastItem["tone"] = "info") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev.slice(-2), { id, title, tone }]);
    setTimeout(() => setToasts((prev) => prev.filter((toast) => toast.id !== id)), 3500);
  };

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto rounded-md border bg-popover px-3.5 py-2.5 text-sm shadow-lg",
              toast.tone === "success" && "border-emerald-500/40",
              toast.tone === "error" && "border-red-500/40",
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  toast.tone === "success" ? "bg-emerald-500" : toast.tone === "error" ? "bg-red-500" : "bg-sky-400",
                )}
              />
              {toast.title}
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
