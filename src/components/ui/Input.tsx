import { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: React.ReactNode;
}

export function Input({ label, icon, className = "", ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm text-crypt-muted font-medium">{label}</label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-crypt-muted">
            {icon}
          </div>
        )}
        <input
          {...props}
          className={`
            w-full px-4 py-2.5 rounded-lg
            bg-crypt-card border border-crypt-border
            text-crypt-text placeholder-crypt-muted
            focus:outline-none focus:border-crypt-accent focus:ring-1 focus:ring-crypt-accent
            transition-colors
            ${icon ? "pl-10" : ""}
            ${className}
          `}
        />
      </div>
    </div>
  );
}
