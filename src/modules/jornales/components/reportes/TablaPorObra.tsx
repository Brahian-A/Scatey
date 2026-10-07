"use client";

import { ChevronRight } from "lucide-react";
import { Fragment, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { fechaCorta } from "../../fechas";
import { formatearJornales } from "../../formato";
import type { FilaPorObra } from "../../queries";

export function TablaPorObra({ filas }: { filas: FilaPorObra[] }) {
  const [abiertas, setAbiertas] = useState<ReadonlySet<string>>(new Set());

  function alternar(id: string) {
    setAbiertas((prev) => {
      const sig = new Set(prev);
      if (!sig.delete(id)) sig.add(id);
      return sig;
    });
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Obra</TableHead>
            <TableHead className="text-right">Jornales</TableHead>
            <TableHead className="text-right">Trabajadores</TableHead>
            <TableHead>Primer día</TableHead>
            <TableHead>Último día</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filas.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                No hay jornales trabajados en este período.
              </TableCell>
            </TableRow>
          )}
          {filas.map((o) => {
            const abierta = abiertas.has(o.id);
            return (
              <Fragment key={o.id}>
                <TableRow className="cursor-pointer" onClick={() => alternar(o.id)}>
                  <TableCell>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 font-medium outline-none focus-visible:underline"
                      aria-expanded={abierta}
                      aria-label={`${abierta ? "Ocultar" : "Ver"} trabajadores de ${o.nombre}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        alternar(o.id);
                      }}
                    >
                      <ChevronRight
                        className={cn("size-4 text-muted-foreground transition-transform", abierta && "rotate-90")}
                      />
                      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: o.color }} aria-hidden />
                      {o.nombre}
                      {o.estado === "terminada" && (
                        <span className="text-xs font-normal text-muted-foreground">(terminada)</span>
                      )}
                    </button>
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{formatearJornales(o.jornales)}</TableCell>
                  <TableCell className="text-right tabular-nums">{o.trabajadores}</TableCell>
                  <TableCell className="tabular-nums">{fechaCorta(o.primerDia)}</TableCell>
                  <TableCell className="tabular-nums">{fechaCorta(o.ultimoDia)}</TableCell>
                </TableRow>
                {abierta &&
                  o.porTrabajador.map((t) => (
                    <TableRow key={t.id} className="bg-muted/30 hover:bg-muted/40">
                      <TableCell className="pl-14 text-muted-foreground">{t.nombre}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatearJornales(t.jornales)}</TableCell>
                      <TableCell colSpan={3} />
                    </TableRow>
                  ))}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
