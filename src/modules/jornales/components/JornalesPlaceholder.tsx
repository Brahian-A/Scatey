import { CalendarDays } from "lucide-react";
import { formatear, rangoSemana } from "@/core/lib/fecha";
import { PageHeader } from "@/core/ui/PageHeader";

export function JornalesPlaceholder() {
  const { inicio, fin } = rangoSemana();
  return (
    <>
      <PageHeader
        titulo="Jornales"
        descripcion={`Semana del ${formatear(inicio, "EEEE d 'de' MMMM")} al ${formatear(fin, "EEEE d 'de' MMMM")}`}
      />
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
        <CalendarDays className="size-10 text-muted-foreground" aria-hidden />
        <p className="font-medium">Próximamente</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Acá se va a armar la planilla semanal de jornales: qué trabajador va a qué obra cada día.
        </p>
      </div>
    </>
  );
}
