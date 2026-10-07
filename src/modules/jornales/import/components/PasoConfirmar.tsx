"use client";

import { ArrowLeft, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { fechaCorta, lunesDe } from "../../fechas";
import { jornalesManifest } from "../../manifest";
import { importarPlanilla, previsualizarImportacion, type Previsualizacion } from "../actions";
import type { ImportacionInput } from "../validation";
import { Advertencias } from "./Advertencias";

const MODOS = [
  { value: false, label: "Omitir existentes", ayuda: "Las celdas que ya tienen datos quedan como están." },
  { value: true, label: "Sobrescribir", ayuda: "Las celdas que ya tienen datos toman el valor de la planilla." },
] as const;

export function PasoConfirmar({ importacion, onVolver }: { importacion: ImportacionInput; onVolver: () => void }) {
  const router = useRouter();
  const [vista, setVista] = useState<Previsualizacion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sobrescribir, setSobrescribir] = useState(false);
  const [cargando, startCarga] = useTransition();
  const [importando, startImportacion] = useTransition();

  useEffect(() => {
    startCarga(async () => {
      const res = await previsualizarImportacion(importacion);
      if (res.ok) setVista(res.data);
      else setError(res.error);
    });
  }, [importacion]);

  function importar() {
    startImportacion(async () => {
      const res = await importarPlanilla(importacion, sobrescribir);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const { insertados, sobrescritos, omitidos, desde } = res.data;
      toast.success(
        `Importación lista: ${insertados} cargados` +
          (sobrescritos ? `, ${sobrescritos} sobrescritos` : "") +
          (omitidos ? `, ${omitidos} ya estaban` : "") +
          ".",
      );
      router.push(desde ? `${jornalesManifest.href}?semana=${lunesDe(desde)}` : jornalesManifest.href);
    });
  }

  if (error) {
    return (
      <div className="grid max-w-3xl gap-4">
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
        <div>
          <Button variant="outline" onClick={onVolver}>
            <ArrowLeft /> Volver
          </Button>
        </div>
      </div>
    );
  }

  if (cargando || !vista) return <p className="text-sm text-muted-foreground">Calculando qué se va a cargar…</p>;

  const aEscribir = vista.nuevos + (sobrescribir ? vista.conflictos : 0);

  return (
    <div className="grid max-w-4xl gap-6">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Dato titulo="Nuevos" valor={vista.nuevos} detalle="días sin datos todavía" />
        <Dato titulo="Con otro valor" valor={vista.conflictos} detalle="ya cargados distinto" resaltar={vista.conflictos > 0} />
        <Dato titulo="Iguales" valor={vista.iguales} detalle="ya cargados igual: no cambian" />
        <Dato titulo="Ignorados" valor={vista.ignorados} detalle="por tu elección en el paso 2" />
      </dl>

      {(vista.trabajadoresNuevos.length > 0 || vista.obrasNuevas.length > 0) && (
        <div className="grid gap-1 text-sm">
          {vista.trabajadoresNuevos.length > 0 && (
            <p>
              <span className="font-medium">Trabajadores nuevos:</span> {vista.trabajadoresNuevos.join(", ")}
            </p>
          )}
          {vista.obrasNuevas.length > 0 && (
            <p>
              <span className="font-medium">Obras nuevas:</span> {vista.obrasNuevas.join(", ")}
            </p>
          )}
        </div>
      )}

      {vista.advertencias.length > 0 && <Advertencias titulo="Registros repetidos" advertencias={vista.advertencias} />}

      {vista.conflictos > 0 && (
        <section aria-labelledby="conflictos" className="grid gap-3">
          <h2 id="conflictos" className="text-base font-medium">
            Días que ya tienen otro valor
          </h2>
          <div role="radiogroup" aria-label="Qué hacer con los días que ya tienen datos" className="grid gap-2 sm:grid-cols-2">
            {MODOS.map((m) => (
              <label
                key={m.label}
                className={cn(
                  "flex cursor-pointer gap-3 rounded-lg border p-3 text-sm",
                  sobrescribir === m.value && "border-foreground ring-1 ring-foreground",
                )}
              >
                <input
                  type="radio"
                  name="modo"
                  className="mt-0.5"
                  checked={sobrescribir === m.value}
                  onChange={() => setSobrescribir(m.value)}
                />
                <span>
                  <span className="font-medium">{m.label}</span>
                  <span className="block text-muted-foreground">{m.ayuda}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fila</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Trabajador</TableHead>
                  <TableHead>Cargado</TableHead>
                  <TableHead>En la planilla</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vista.muestraConflictos.map((c) => (
                  <TableRow key={`${c.fecha}|${c.trabajador}`}>
                    <TableCell className="tabular-nums">{c.fila}</TableCell>
                    <TableCell className="tabular-nums">{fechaCorta(c.fecha)}</TableCell>
                    <TableCell>{c.trabajador}</TableCell>
                    <TableCell className={cn(sobrescribir && "text-muted-foreground line-through")}>{c.actual}</TableCell>
                    <TableCell className={cn(!sobrescribir && "text-muted-foreground line-through")}>{c.nuevo}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {vista.conflictos > vista.muestraConflictos.length && (
            <p className="text-xs text-muted-foreground">
              Se muestran los primeros {vista.muestraConflictos.length} de {vista.conflictos}.
            </p>
          )}
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t pt-4">
        <Button variant="outline" onClick={onVolver} disabled={importando}>
          <ArrowLeft /> Volver
        </Button>
        <span className="ml-auto text-sm text-muted-foreground">
          Se van a escribir {aEscribir} {aEscribir === 1 ? "registro" : "registros"}. Todo o nada: si algo falla no se guarda
          nada.
        </span>
        <Button onClick={importar} disabled={importando}>
          <Upload /> {importando ? "Importando…" : "Importar"}
        </Button>
      </div>
    </div>
  );
}

function Dato({ titulo, valor, detalle, resaltar }: { titulo: string; valor: number; detalle: string; resaltar?: boolean }) {
  return (
    <div className={cn("rounded-lg border p-3", resaltar && "border-amber-400 bg-amber-50 dark:bg-amber-950/30")}>
      <dt className="text-xs text-muted-foreground">{titulo}</dt>
      <dd className="text-lg font-semibold tabular-nums">{valor}</dd>
      <dd className="text-xs text-muted-foreground">{detalle}</dd>
    </div>
  );
}
