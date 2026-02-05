import { cva, type VariantProps } from "class-variance-authority";
import { Slot as SlotPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-mono text-sm font-semibold uppercase tracking-wider ring-offset-background transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border-2 border-foreground bg-primary text-primary-foreground shadow-[3px_3px_0px_var(--brutalist-accent)] hover:shadow-[4px_4px_0px_var(--brutalist-accent)] hover:translate-x-[-1px] hover:translate-y-[-1px] active:shadow-none active:translate-x-[3px] active:translate-y-[3px]",
        destructive:
          "border-2 border-foreground bg-destructive text-destructive-foreground shadow-[3px_3px_0px_var(--brutalist-accent)] hover:shadow-[4px_4px_0px_var(--brutalist-accent)] hover:translate-x-[-1px] hover:translate-y-[-1px] active:shadow-none active:translate-x-[3px] active:translate-y-[3px]",
        outline:
          "border-2 border-foreground bg-background text-foreground shadow-[3px_3px_0px_var(--brutalist-accent)] hover:bg-accent hover:shadow-[4px_4px_0px_var(--brutalist-accent)] hover:translate-x-[-1px] hover:translate-y-[-1px] active:shadow-none active:translate-x-[3px] active:translate-y-[3px]",
        secondary:
          "border-2 border-foreground bg-secondary text-secondary-foreground shadow-[3px_3px_0px_var(--brutalist-accent)] hover:shadow-[4px_4px_0px_var(--brutalist-accent)] hover:translate-x-[-1px] hover:translate-y-[-1px] active:shadow-none active:translate-x-[3px] active:translate-y-[3px]",
        ghost:
          "border-2 border-transparent hover:border-foreground hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline border-0",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
        icon: "h-10 w-10",
        "icon-sm": "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? SlotPrimitive.Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
