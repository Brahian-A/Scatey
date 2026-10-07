"use client";

import { FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/core/ui/PageHeader";
import { useFiltrosUrl } from "@/core/ui/useFiltrosUrl";
import { cn } from "@/lib/utils";
import { lunesDe, type Rango } from "../../fechas";
import { jornalesManifest } from "../../manifest";
import type {
  FilaDetalle,
  FilaPorObra,
  FilaPorTrabajador,
  FiltrosDetalle,
  OpcionesDetalle,
  VistaReporte,
} from "../../queries";
import { JornalesTabs } from "../JornalesTabs";
import { SelectorRango } from "./SelectorRango";
import { TablaDetalle } from "./TablaDetalle";
import { TablaPorObra } from "./TablaPorObra";
import { TablaPorTrabajador } from "./TablaPorTrabajador";

/** Solo se consulta el reporte que se está viendo. */
export type DatosReporte =
  | { vista: "trabajador"; filas: FilaPorTrabajador[] }
  | { vista: "obra"; filas: FilaPorObra[] }
  | { vista: "detalle"; filas: FilaDetalle[]; total: number; filtros: FiltrosDetalle; opciones: OpcionesDetalle };

const VISTAS: Array<{ value: VistaReporte; label: string }> = [
  { value: "trabajador", label: "Por trabajador" },
  { value: "obra", label: "Por obra" },
  { value: "detalle", label: "Detalle" },
];

export function ReportesView({ rango, hoy, datos }: { rango: Rango; hoy: string; datos: DatosReporte }) {
  const { setFiltro, setFiltros, pendiente } = useFiltrosUrl();
  const base = jornalesManifest.href;

  return (
    <>
      <PageHeader
        titulo="Jornales"
        acciones={
          <Button variant="outline" asChild>
            <a href={`${base}/reportes/exportar?desde=${rango.desde}&hasta=${rango.hasta}`} download>
              <FileSpreadsheet /> Exportar a Excel
            </a>
          </Button>
        }
      />

      <JornalesTabs
        actual="reportes"
        hrefSemana={`${base}?semana=${lunesDe(rango.desde)}`}
        hrefReportes={`${base}/reportes?desde=${rango.desde}&hasta=${rango.hasta}`}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {/* Los filtros del detalle dependen del período: al cambiarlo se limpian. */}
        <SelectorRango
          rango={rango}
          hoy={hoy}
          onCambiar={(r) => setFiltros({ desde: r.desde, hasta: r.hasta, trabajador: null, filtro: null })}
        />
        <div role="tablist" aria-label="Reporte" className="inline-flex rounded-lg border p-0.5">
          {VISTAS.map((v) => (
            <Button
              key={v.value}
              role="tab"
              size="sm"
              variant={datos.vista === v.value ? "secondary" : "ghost"}
              aria-selected={datos.vista === v.value}
              onClick={() => setFiltro("vista", v.value === "trabajador" ? null : v.value)}
            >
              {v.label}
            </Button>
          ))}
        </div>
      </div>

      <div className={cn("transition-opacity", pendiente && "opacity-60")} aria-busy={pendiente}>
        {datos.vista === "trabajador" && <TablaPorTrabajador filas={datos.filas} />}
        {datos.vista === "obra" && <TablaPorObra filas={datos.filas} />}
        {datos.vista === "detalle" && (
          <TablaDetalle
            filas={datos.filas}
            total={datos.total}
            filtros={datos.filtros}
            opciones={datos.opciones}
            onFiltro={setFiltro}
          />
        )}
      </div>
    </>
  );
}
