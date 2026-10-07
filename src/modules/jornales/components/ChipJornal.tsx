import { cn } from "@/lib/utils";
import type { ObraResumen } from "../queries";
import { ETIQUETA_MOTIVO } from "../schema";
import type { Jornal } from "../validation";

const MEDIO = "½";

/** Contenido de una celda de la grilla: obra con su color, o el motivo de ausencia. */
export function ChipJornal({
  jornal,
  obra,
}: {
  jornal: Pick<Jornal, "estado" | "motivoAusencia" | "fraccion">;
  obra: Pick<ObraResumen, "nombre" | "color"> | undefined;
}) {
  const medio = jornal.fraccion === 0.5 && <span className="shrink-0 font-semibold">{MEDIO}</span>;
  const base = "inline-flex h-6 max-w-full min-w-0 items-center gap-1.5 rounded-full border px-2 text-xs font-medium";

  if (jornal.estado === "trabajo") {
    const color = obra?.color ?? "#94a3b8";
    return (
      <span className={base} style={{ borderColor: color, backgroundColor: `${color}1a` }}>
        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
        <span className="truncate">{obra?.nombre ?? "Obra desconocida"}</span>
        {medio}
      </span>
    );
  }

  const falta = jornal.motivoAusencia === "falta";
  return (
    <span
      className={cn(
        base,
        falta ? "border-red-300 bg-red-50 text-red-700" : "border-transparent bg-muted text-muted-foreground",
      )}
    >
      <span className="truncate">{jornal.motivoAusencia ? ETIQUETA_MOTIVO[jornal.motivoAusencia] : "Ausente"}</span>
      {medio}
    </span>
  );
}
