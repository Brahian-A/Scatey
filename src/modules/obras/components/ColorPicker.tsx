"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { PALETA_OBRAS } from "../constants";

export function ColorPicker({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  return (
    <div id={id} role="radiogroup" aria-label="Color" className="grid grid-cols-5 gap-2">
      {PALETA_OBRAS.map((c) => {
        const seleccionado = c.hex === value;
        return (
          <button
            key={c.hex}
            type="button"
            role="radio"
            aria-checked={seleccionado}
            aria-label={c.nombre}
            title={c.nombre}
            onClick={() => onChange(c.hex)}
            className={cn(
              "flex size-9 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              seleccionado && "ring-2 ring-foreground",
            )}
            style={{ backgroundColor: c.hex }}
          >
            {seleccionado && <Check className="size-4 text-white" aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}
