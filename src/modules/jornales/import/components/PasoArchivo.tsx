"use client";

import { ArrowRight, FileSpreadsheet, TriangleAlert } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Campo } from "@/core/ui/Campo";
import { fechaCorta } from "../../fechas";
import { analizarPlanilla, type Analisis } from "../actions";
import { Advertencias } from "./Advertencias";

export function PasoArchivo({
  anioActual,
  analisis,
  onAnalizado,
  onContinuar,
}: {
  anioActual: number;
  analisis: Analisis | null;
  onAnalizado: (a: Analisis | null) => void;
  onContinuar: () => void;
}) {
  const [leyendo, startLectura] = useTransition();

  // onSubmit y no `action`: React vacía el formulario después de una action y se perdería el archivo elegido.
  function leer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startLectura(async () => {
      const res = await analizarPlanilla(formData);
      if (!res.ok) {
        toast.error(res.error);
        onAnalizado(null);
        return;
      }
      onAnalizado(res.data);
    });
  }

  const r = analisis?.resumen;

  return (
    <div className="grid max-w-3xl gap-6">
      <form onSubmit={leer} className="grid gap-4 rounded-lg border p-4 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
        <Campo id="archivo" label="Planilla (.xlsx)">
          <Input
            id="archivo"
            name="archivo"
            type="file"
            required
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={() => onAnalizado(null)}
          />
        </Campo>
        <Campo id="anio" label="Año de la primera semana">
          <Input
            id="anio"
            name="anio"
            type="number"
            required
            min={2000}
            max={2100}
            defaultValue={anioActual}
            onChange={() => onAnalizado(null)}
          />
        </Campo>
        <Button type="submit" disabled={leyendo}>
          <FileSpreadsheet /> {leyendo ? "Leyendo…" : "Leer archivo"}
        </Button>
        <p className="text-xs text-muted-foreground sm:col-span-3">
          Los títulos no tienen año: las semanas siguientes pasan al año siguiente cuando el archivo pasa de diciembre a
          enero.
        </p>
      </form>

      {analisis && r && (
        <section aria-labelledby="resumen" className="grid gap-4">
          <h2 id="resumen" className="text-base font-medium">
            Resumen
          </h2>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Dato titulo="Semanas" valor={r.semanas} />
            <Dato titulo="Período" valor={`${fechaCorta(r.desde)} – ${fechaCorta(r.hasta)}`} />
            <Dato titulo="Registros" valor={r.registros} detalle={r.sinDestino ? `${r.sinDestino} celdas sin destino no se cargan` : undefined} />
            <Dato titulo="Faltas (XXX)" valor={r.faltas} />
          </dl>

          {analisis.advertencias.length > 0 ? (
            <Advertencias titulo="Avisos al leer el archivo" advertencias={analisis.advertencias} />
          ) : (
            <p className="text-sm text-muted-foreground">El archivo se leyó sin avisos.</p>
          )}

          <div className="flex items-center gap-3">
            <Button onClick={onContinuar} disabled={r.registros === 0}>
              Continuar <ArrowRight />
            </Button>
            {r.registros === 0 && (
              <span className="flex items-center gap-1.5 text-sm text-destructive">
                <TriangleAlert className="size-4" /> No hay registros para importar.
              </span>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function Dato({ titulo, valor, detalle }: { titulo: string; valor: React.ReactNode; detalle?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <dt className="text-xs text-muted-foreground">{titulo}</dt>
      <dd className="text-lg font-semibold tabular-nums">{valor}</dd>
      {detalle && <dd className="text-xs text-muted-foreground">{detalle}</dd>}
    </div>
  );
}
