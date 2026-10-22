import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      // Desligada: trilho na cor de controle (3:1). No celular/toque: 24×44 px com área de toque de 44×44.
      "relative peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-control max-md:h-6 max-md:w-11 pointer-coarse:h-6 pointer-coarse:w-11 max-md:after:absolute max-md:after:-inset-y-3 max-md:after:-inset-x-0.5 max-md:after:content-[''] pointer-coarse:after:absolute pointer-coarse:after:-inset-y-3 pointer-coarse:after:-inset-x-0.5 pointer-coarse:after:content-['']",
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0 max-md:size-5 pointer-coarse:size-5 max-md:data-[state=checked]:translate-x-5 pointer-coarse:data-[state=checked]:translate-x-5",
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
