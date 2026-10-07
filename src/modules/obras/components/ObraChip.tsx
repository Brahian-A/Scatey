import { cn } from "@/lib/utils";

/** Chip con el color de la obra; pensado para reutilizarse en otras vistas. */
export function ObraChip({ nombre, color, className }: { nombre: string; color: string; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-medium", className)}
      style={{ borderColor: color, backgroundColor: `${color}1a` }}
    >
      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
      {nombre}
    </span>
  );
}
