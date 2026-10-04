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
  "flex items-center justify-center text-base-content/80",
  "transition-colors"
);

const variantClass = {
  default: clsx("w-12", "hover:bg-base-content/10"),
  danger: clsx("w-12", "hover:bg-error", "hover:text-error-content"),
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
