import * as React from "react";
import { cn } from "@/lib/utils";

/** Surface blanche arrondie : le conteneur de base de toute l'interface. */
export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-2xl border border-line bg-surface shadow-card", className)}
      {...props}
    />
  );
}
