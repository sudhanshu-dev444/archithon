import React from 'react';

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  icon,
  disabled = false,
  onClick,
  className = '',
  type = 'button',
}) {
  const baseStyles = 'inline-flex items-center justify-center font-semibold rounded-xl transition-all select-none active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none min-h-[48px]';

  const variants = {
    primary: 'bg-primary text-on-primary hover:bg-primary-container shadow-sm',
    primaryContainer: 'bg-primary-container text-on-primary hover:bg-primary shadow-sm',
    secondary: 'bg-secondary text-on-secondary hover:bg-secondary-container shadow-sm',
    secondaryContainer: 'bg-secondary-container text-on-secondary-fixed hover:bg-secondary/20',
    tertiary: 'bg-tertiary text-on-tertiary hover:opacity-90 shadow-sm',
    error: 'bg-error text-on-error hover:opacity-90 shadow-sm',
    errorContainer: 'bg-error-container text-on-error-container hover:bg-error-container/80',
    outline: 'border border-outline text-on-surface bg-transparent hover:bg-surface-container',
    ghost: 'text-on-surface-variant hover:text-primary hover:bg-surface-container/50',
    surface: 'bg-surface-container-high text-primary hover:bg-surface-variant',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-label-sm min-h-[40px]',
    md: 'px-4 py-2.5 text-label-md min-h-[48px]',
    lg: 'px-5 py-3 text-label-lg min-h-[52px]',
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`
        ${baseStyles}
        ${variants[variant] || variants.primary}
        ${sizes[size] || sizes.md}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
    >
      {icon && <span className="material-symbols-outlined text-[20px] mr-1.5">{icon}</span>}
      {children}
    </button>
  );
}
