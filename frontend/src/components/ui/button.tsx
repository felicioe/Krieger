import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // #82: abaixo de sm (celular, e também quando o texto do navegador está ampliado, pois os pontos de quebra
  // seguem o tamanho da letra) o rótulo pode quebrar dentro do botão em vez de empurrar a página para o lado.
  // Do sm para cima continua numa linha só, como antes.
  "inline-flex items-center justify-center gap-2 whitespace-nowrap max-sm:max-w-full max-sm:whitespace-normal max-sm:text-center rounded-md text-sm font-medium cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-9 px-4 py-1.5 max-md:min-h-11 pointer-coarse:min-h-11",
        sm: "min-h-8 rounded-md px-3 py-1 text-xs max-md:min-h-11 pointer-coarse:min-h-11",
        lg: "min-h-10 rounded-md px-8 py-2 max-md:min-h-11 pointer-coarse:min-h-11",
        icon: "h-9 w-9 max-md:size-11 pointer-coarse:size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
