"use client";

import { ChevronLeft, ChevronRight, Copy } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { ResultadoAccion } from "@/core/lib/acciones";
import { PageHeader } from "@/core/ui/PageHeader";
import { copiarDiaAnterior, copiarSemanaAnterior, type ResultadoCopia } from "../actions";
import { diaMes, lunesDe, nombreDia, sumarDias } from "../fechas";
import { jornalesManifest } from "../manifest";
import type { GrillaSemana } from "../queries";
import { GrillaSemanal } from "./GrillaSemanal";
import { useMostrarSabado } from "./useMostrarSabado";

type AccionCopia = (sobrescribir?: boolean) => Promise<ResultadoAccion<ResultadoCopia>>;

const hrefSemana = (semana: string) => `${jornalesManifest.href}?semana=${semana}`;

export function JornalesView({ grilla, hoy }: { grilla: GrillaSemana; hoy: string }) {
  const { semana } = grilla;
  const [preferenciaSabado, setPreferenciaSabado] = useMostrarSabado();
  // Si ya hay jornales cargados el sábado, la columna se muestra siempre.
  const sabadoConDatos = grilla.registros.some((r) => r.fecha === sumarDias(semana, 5));
  const mostrarSabado = preferenciaSabado || sabadoConDatos;
  const dias = Array.from({ length: mostrarSabado ? 6 : 5 }, (_, i) => sumarDias(semana, i));
  const esSemanaActual = semana === lunesDe(hoy);

  const [confirmacion, setConfirmacion] = useState<{ conflictos: number; accion: AccionCopia } | null>(null);
  const [copiando, startCopia] = useTransition();

  function copiar(accion: AccionCopia, sobrescribir?: boolean) {
    setConfirmacion(null);
    startCopia(async () => {
      const res = await accion(sobrescribir);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const r = res.data;
      if (r.estado === "confirmar") {
        setConfirmacion({ conflictos: r.conflictos, accion });
        return;
      }
      const desde = r.desde ? ` del ${nombreDia(r.desde).toLowerCase()} ${diaMes(r.desde)}` : "";
      if (r.copiados === 0) toast.info(`No había nada nuevo para copiar${desde}.`);
      else toast.success(`Se ${r.copiados === 1 ? "copió 1 registro" : `copiaron ${r.copiados} registros`}${desde}.`);
    });
  }

  return (
    <>
      <PageHeader
        titulo="Jornales"
        acciones={
          <>
            <div className="flex items-center gap-2">
              <Switch
                id="mostrar-sabado"
                checked={mostrarSabado}
                disabled={sabadoConDatos}
                onCheckedChange={setPreferenciaSabado}
              />
              <Label htmlFor="mostrar-sabado" title={sabadoConDatos ? "Esta semana tiene jornales el sábado." : undefined}>
                Mostrar sábado
              </Label>
            </div>
            <Button
              variant="outline"
              disabled={copiando}
              onClick={() => copiar((sobrescribir) => copiarSemanaAnterior(semana, sobrescribir))}
            >
              <Copy /> Copiar semana anterior
            </Button>
          </>
        }
      />

      <nav aria-label="Semanas" className="mb-3 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" asChild>
          <Link href={hrefSemana(sumarDias(semana, -7))} aria-label="Semana anterior">
            <ChevronLeft />
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href={jornalesManifest.href} aria-current={esSemanaActual ? "date" : undefined}>
            Hoy
          </Link>
        </Button>
        <Button variant="outline" size="icon" asChild>
          <Link href={hrefSemana(sumarDias(semana, 7))} aria-label="Semana siguiente">
            <ChevronRight />
          </Link>
        </Button>
        <h2 className="ml-2 text-base font-medium">
          Semana del {diaMes(dias[0]!)} al {diaMes(dias.at(-1)!)}
        </h2>
      </nav>

      <GrillaSemanal
        grilla={grilla}
        dias={dias}
        hoy={hoy}
        copiando={copiando}
        onCopiarDia={(fecha) => copiar((sobrescribir) => copiarDiaAnterior(fecha, sobrescribir))}
      />

      <AlertDialog open={confirmacion !== null} onOpenChange={(abierto) => !abierto && setConfirmacion(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Sobrescribir celdas con datos?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmacion?.conflictos === 1
                ? "1 celda ya tiene otro valor."
                : `${confirmacion?.conflictos} celdas ya tienen otro valor.`}{" "}
              Podés completar solo las vacías o reemplazar también esas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="outline" onClick={() => confirmacion && copiar(confirmacion.accion, false)}>
              Solo vacías
            </AlertDialogAction>
            <AlertDialogAction onClick={() => confirmacion && copiar(confirmacion.accion, true)}>
              Sobrescribir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
