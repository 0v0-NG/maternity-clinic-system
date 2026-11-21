import { forwardRef } from 'react';

// Buttons are 48px high (h-12) with 12px rounded corners (rounded-xl).
export default forwardRef(function Button({
  children,
  type = 'button',
  variant = 'primary',
  disabled = false,
  className = '',
  onClick,
  ...props
}, ref) {
  const base = 'flex items-center justify-center rounded-xl font-medium transition-colors h-12 disabled:opacity-60 disabled:cursor-not-allowed';

  const variants = {
    primary: 'bg-primary-500 text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
    secondary: 'bg-white text-clinic-dark border border-primary-500 hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-primary-500',
    outline: 'bg-transparent text-body border border-border hover:bg-clinic-tint focus:outline-none focus:ring-2 focus:ring-primary-500',
    danger: 'bg-status-emergency text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500',
    ghost: 'text-body-muted hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500',
  };

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
});
