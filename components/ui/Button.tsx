
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const baseClasses =
      'inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] active:opacity-90';

    const variantClasses = {
      primary: 'bg-accent text-text-inverse hover:bg-accent/90',
      secondary: 'bg-surface-dark text-text-inverse hover:bg-surface-dark/90',
      ghost: 'hover:bg-accent/10 hover:text-accent',
    };

    const sizeClasses = {
      sm: 'h-9 px-3',
      md: 'h-10 px-4 py-2',
      lg: 'h-11 rounded-md px-8',
      icon: 'h-10 w-10',
    };

    const combinedClasses = [baseClasses, variantClasses[variant], sizeClasses[size], className].filter(Boolean).join(' ');

    return <button className={combinedClasses} ref={ref} {...props} />;
  }
);
Button.displayName = 'Button';
