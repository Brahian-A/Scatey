"use client";

import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fechaCorta, nombreDia } from "../../fechas";
import type { FilaDetalle, FiltrosDetalle, OpcionesDetalle } from "../../queries";
import { MOTIVOS_AUSENCIA } from "../../schema";
import { ChipJornal } from "../ChipJornal";

const TODOS = "todos";

function valorFiltro(filtro: FiltrosDetalle["filtro"]): string {
  if (!filtro) return TODOS;
  return filtro.tipo === "obra" ? `obra:${filtro.id}` : `motivo:${filtro.motivo}`;
}

export function TablaDetalle({
  filas,
  total,
  filtros,
  opciones,
  onFiltro,
}: {
  filas: FilaDetalle[];
  /** Registros que cumplen los filtros (puede ser más que `filas` si se cortó). */
  total: number;
  filtros: FiltrosDetalle;
  opciones: OpcionesDetalle;
  onFiltro: (clave: "trabajador" | "filtro", valor: string | null) => void;
}) {
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filtros.trabajador ?? TODOS} onValueChange={(v) => onFiltro("trabajador", v === TODOS ? null : v)}>
          <SelectTrigger className="w-56" aria-label="Filtrar por trabajador">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos los trabajadores</SelectItem>
            {opciones.trabajadores.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={valorFiltro(filtros.filtro)} onValueChange={(v) => onFiltro("filtro", v === TODOS ? null : v)}>
          <SelectTrigger className="w-56" aria-label="Filtrar por obra o motivo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todas las obras y motivos</SelectItem>
            {opciones.obras.length > 0 && (
              <SelectGroup>
                <SelectLabel>Obras</SelectLabel>
                {opciones.obras.map((o) => (
                  <SelectItem key={o.id} value={`obra:${o.id}`}>
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: o.color }} aria-hidden />
                    {o.nombre}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>Ausencias</SelectLabel>
              {MOTIVOS_AUSENCIA.map((m) => (
                <SelectItem key={m.value} value={`motivo:${m.value}`}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {total === 1 ? "1 registro" : `${total} registros`}
        </span>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-36">Fecha</TableHead>
              <TableHead>Trabajador</TableHead>
              <TableHead>Obra / motivo</TableHead>
              <TableHead className="w-20 text-right">Fracción</TableHead>
              <TableHead>Nota</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  No hay registros para mostrar.
                </TableCell>
              </TableRow>
            )}
            {filas.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="tabular-nums">
                  <span className="inline-block w-8 text-muted-foreground">{nombreDia(f.fecha)}</span>
                  {fechaCorta(f.fecha)}
                </TableCell>
                <TableCell className="font-medium">{f.trabajador}</TableCell>
                <TableCell className="max-w-64">
                  <ChipJornal jornal={f} obra={f.obra ?? undefined} />
                </TableCell>
                <TableCell className="text-right tabular-nums">{f.fraccion === 0.5 ? "½" : "1"}</TableCell>
                <TableCell className="max-w-80 truncate whitespace-normal text-muted-foreground">{f.nota}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {total > filas.length && (
        <p className="text-sm text-muted-foreground">
          Se muestran los primeros {filas.length} de {total} registros. Filtrá o exportá a Excel para ver todos.
        </p>
      )}
    </div>
  );
}
