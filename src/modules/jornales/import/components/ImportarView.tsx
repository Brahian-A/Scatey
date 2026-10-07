"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { aTitleCase } from "@/core/lib/texto";
import { PageHeader } from "@/core/ui/PageHeader";
import { cn } from "@/lib/utils";
import { jornalesManifest } from "../../manifest";
import type { Analisis, Origen, TextoAMapear } from "../actions";
import type { DecisionDestino, DecisionTrabajador, ImportacionInput } from "../validation";
import { PasoArchivo } from "./PasoArchivo";
import { PasoConfirmar } from "./PasoConfirmar";
import { PasoMapeo } from "./PasoMapeo";

export type TipoObraOpcion = { value: "cliente" | "interna"; label: string };

/** Lo que el usuario eligió para un texto. Una sugerencia pre-cargada arranca sin confirmar. */
export type EstadoMapeo<D> = { decision: D | null; confirmado: boolean; origen: Origen | null };
export type Mapeo = {
  trabajadores: Record<string, EstadoMapeo<DecisionTrabajador>>;
  destinos: Record<string, EstadoMapeo<DecisionDestino>>;
};

function inicial<D>(textos: TextoAMapear<D>[]): Record<string, EstadoMapeo<D>> {
  return Object.fromEntries(
    textos.map((t) => [
      t.clave,
      {
        decision: t.sugerencia?.decision ?? null,
        // Lo que ya se confirmó en una importación anterior no se vuelve a preguntar.
        confirmado: t.sugerencia?.origen === "alias",
        origen: t.sugerencia?.origen ?? null,
      },
    ]),
  );
}

/** Valores por defecto al elegir "crear nuevo": el texto de la planilla en Title Case. */
export function trabajadorNuevo(texto: string): DecisionTrabajador {
  const [nombre = "", ...resto] = aTitleCase(texto).split(" ");
  return { accion: "nuevo", nombre, apellido: resto.join(" ") };
}
export function obraNueva(texto: string): DecisionDestino {
  return { accion: "nuevo", nombre: aTitleCase(texto), tipo: "cliente" };
}

/** Una fila está lista si tiene una decisión confirmada y completa. */
export function listo(e: EstadoMapeo<DecisionTrabajador | DecisionDestino> | undefined): boolean {
  if (!e?.decision || !e.confirmado) return false;
  return e.decision.accion !== "nuevo" || e.decision.nombre.trim().length > 0;
}

function aImportacion(analisis: Analisis, mapeo: Mapeo): ImportacionInput {
  const decisiones = <D,>(m: Record<string, EstadoMapeo<D>>) =>
    Object.fromEntries(Object.entries(m).flatMap(([k, e]) => (e.decision ? [[k, e.decision]] : [])));
  return {
    filas: analisis.filas,
    trabajadores: decisiones(mapeo.trabajadores),
    destinos: decisiones(mapeo.destinos),
  };
}

const PASOS = ["Archivo", "Asignar textos", "Confirmar"] as const;

export function ImportarView({ anioActual, tiposObra }: { anioActual: number; tiposObra: TipoObraOpcion[] }) {
  const [paso, setPaso] = useState<0 | 1 | 2>(0);
  const [analisis, setAnalisis] = useState<Analisis | null>(null);
  const [mapeo, setMapeo] = useState<Mapeo>({ trabajadores: {}, destinos: {} });
  const importacion = useMemo(() => analisis && aImportacion(analisis, mapeo), [analisis, mapeo]);

  function alAnalizar(a: Analisis | null) {
    setAnalisis(a);
    setMapeo(a ? { trabajadores: inicial(a.trabajadores), destinos: inicial(a.destinos) } : { trabajadores: {}, destinos: {} });
  }

  return (
    <>
      <PageHeader
        titulo="Importar planilla vieja"
        descripcion='Carga los jornales de la planilla de Excel con semanas "SEMANA DEL … AL …". No se guarda nada hasta el último paso.'
        acciones={
          <Button variant="outline" asChild>
            <Link href={jornalesManifest.href}>
              <ArrowLeft /> Volver a jornales
            </Link>
          </Button>
        }
      />

      <ol className="mb-6 flex flex-wrap items-center gap-2 text-sm" aria-label="Pasos">
        {PASOS.map((nombre, i) => (
          <li key={nombre} className="flex items-center gap-2" aria-current={paso === i ? "step" : undefined}>
            {i > 0 && <span className="h-px w-6 bg-border" aria-hidden />}
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full border text-xs font-semibold",
                paso === i ? "border-foreground bg-foreground text-background" : "text-muted-foreground",
              )}
            >
              {i + 1}
            </span>
            <span className={paso === i ? "font-medium" : "text-muted-foreground"}>{nombre}</span>
          </li>
        ))}
      </ol>

      {paso === 0 && (
        <PasoArchivo anioActual={anioActual} analisis={analisis} onAnalizado={alAnalizar} onContinuar={() => setPaso(1)} />
      )}
      {paso === 1 && analisis && (
        <PasoMapeo
          analisis={analisis}
          mapeo={mapeo}
          setMapeo={setMapeo}
          tiposObra={tiposObra}
          onVolver={() => setPaso(0)}
          onContinuar={() => setPaso(2)}
        />
      )}
      {paso === 2 && importacion && <PasoConfirmar importacion={importacion} onVolver={() => setPaso(1)} />}
    </>
  );
}
