import React from 'react';

export default function InputField({
  label,
  id,
  type = 'text',
  value,
  onChange,
  placeholder,
  error,
  helperText,
  icon,
  rightElement,
  disabled = false,
  required = false,
  className = '',
}) {
  return (
    <div className={`flex flex-col gap-1.5 w-full ${className}`}>
      {label && (
        <label htmlFor={id} className="text-label-md font-semibold text-on-surface flex items-center justify-between">
          <span>{label} {required && <span className="text-error">*</span>}</span>
        </label>
      )}
      <div className="relative flex items-center">
        {icon && (
          <span className="material-symbols-outlined text-[20px] text-on-surface-variant absolute left-3.5 pointer-events-none">
            {icon}
          </span>
        )}
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          className={`
            w-full rounded-xl bg-surface-container-lowest border border-outline-variant
            text-on-surface text-body-md placeholder:text-outline
            focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
            transition-all min-h-[48px] px-3.5
            ${icon ? 'pl-11' : ''}
            ${rightElement ? 'pr-11' : ''}
            ${error ? 'border-error focus:ring-error' : ''}
            ${disabled ? 'opacity-50 cursor-not-allowed bg-surface-container' : ''}
          `}
        />
        {rightElement && (
          <div className="absolute right-3.5 flex items-center">
            {rightElement}
          </div>
        )}
      </div>
      {error && <span className="text-label-sm text-error font-medium">{error}</span>}
      {helperText && !error && <span className="text-body-sm text-on-surface-variant">{helperText}</span>}
    </div>
  );
}
