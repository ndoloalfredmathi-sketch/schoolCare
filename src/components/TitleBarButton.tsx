import clsx from "clsx";
import type { ReactNode } from "react";

type TitleBarButtonProps = {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  variant?: "default" | "danger";
  className?: string;
};

const baseClass = clsx(
  "flex items-center justify-center text-slate-300",
  "transition-colors"
);

const variantClass = {
  default: clsx("w-12", "hover:bg-white/10"),
  danger: clsx("w-12", "hover:bg-red-600", "hover:text-white"),
};

function TitleBarButton({
  label,
  icon,
  onClick,
  variant = "default",
  className,
}: TitleBarButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      tabIndex={-1}
      onClick={onClick}
      className={clsx(baseClass, variantClass[variant], className)}
    >
      {icon}
    </button>
  );
}

export { TitleBarButton };
