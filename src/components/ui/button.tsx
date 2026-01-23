import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          // Variants
          variant === "default" &&
            "bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500",
          variant === "secondary" &&
            "bg-gray-100 text-gray-900 hover:bg-gray-200 focus-visible:ring-gray-500",
          variant === "outline" &&
            "border border-gray-300 bg-transparent hover:bg-gray-100 focus-visible:ring-gray-500",
          variant === "ghost" &&
            "hover:bg-gray-100 focus-visible:ring-gray-500",
          variant === "destructive" &&
            "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500",
          // Sizes
          size === "default" && "h-10 px-4 py-2 text-sm",
          size === "sm" && "h-8 px-3 text-xs",
          size === "lg" && "h-12 px-6 text-base",
          size === "icon" && "h-10 w-10",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

export { Button };
