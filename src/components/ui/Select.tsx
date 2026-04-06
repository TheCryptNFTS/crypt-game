import { SelectHTMLAttributes } from "react";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
}

export function Select({ label, options, className = "", ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm text-crypt-muted font-medium">{label}</label>
      )}
      <select
        {...props}
        className={`
          w-full px-4 py-2.5 rounded-lg
          bg-crypt-card border border-crypt-border
          text-crypt-text
          focus:outline-none focus:border-crypt-accent focus:ring-1 focus:ring-crypt-accent
          transition-colors cursor-pointer
          appearance-none
          bg-[url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%238b8b9e'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")]
          bg-no-repeat bg-[right_0.75rem_center] bg-[length:1.25rem]
          ${className}
        `}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
