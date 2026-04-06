import { ReactNode } from "react";

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
}

export function Button({ 
  children, 
  onClick, 
  variant = "primary", 
  size = "md", 
  disabled = false,
  className = "",
  type = "button"
}: ButtonProps) {
  const baseClasses = "font-semibold transition-all duration-200 rounded-lg flex items-center justify-center gap-2";
  
  const variantClasses = {
    primary: "bg-crypt-accent text-black hover:bg-crypt-gold disabled:bg-crypt-muted disabled:text-crypt-bg",
    secondary: "bg-crypt-card border border-crypt-border text-crypt-text hover:bg-crypt-surface hover:border-crypt-accent",
    ghost: "bg-transparent text-crypt-muted hover:text-crypt-text hover:bg-crypt-card",
    danger: "bg-red-600 text-white hover:bg-red-500 disabled:bg-red-900",
  };

  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {children}
    </button>
  );
}
