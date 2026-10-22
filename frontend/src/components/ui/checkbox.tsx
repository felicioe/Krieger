import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      // No celular e em telas de toque: caixa de 20 px e área de toque invisível de 44×44 (after:-inset-[13px]).
      // Quem coloca a caixa numa lista deve deixar ≥ 44 px entre uma caixa e outra (ex.: max-md:min-h-11).
      "relative grid place-content-center peer h-4 w-4 shrink-0 rounded-sm border border-primary shadow cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground max-md:size-5 pointer-coarse:size-5 max-md:after:absolute max-md:after:-inset-[13px] max-md:after:content-[''] pointer-coarse:after:absolute pointer-coarse:after:-inset-[13px] pointer-coarse:after:content-['']",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className={cn("grid place-content-center text-current")}>
      <Check className="size-3.5 max-md:size-4 pointer-coarse:size-4" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
