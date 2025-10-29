
import React from 'react';

export const Slider = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => {
  return (
    <input
      type="range"
      ref={ref}
      className={`h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-accent focus:outline-none focus:ring-2 focus:ring-accent/50 ${className}`}
      {...props}
    />
  );
});
Slider.displayName = 'Slider';
