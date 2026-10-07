import type { Metadata } from "next";
import { ReportesView, type DatosReporte } from "@/modules/jornales/components/reportes/ReportesView";
import {
  hoyIso,
  LIMITE_DETALLE,
  opcionesDetalle,
  parsearFiltrosDetalle,
  parsearRango,
  parsearVistaReporte,
  reporteDetalle,
  reportePorObra,
  reportePorTrabajador,
  type Rango,
  type VistaReporte,
} from "@/modules/jornales/queries";

export const metadata: Metadata = { title: "Reportes de jornales" };
// Sin ?desde=&hasta= se muestra la semana actual, que depende de la fecha de cada request.
export const dynamic = "force-dynamic";

type Params = Record<string, string | string[] | undefined>;

async function cargar(vista: VistaReporte, rango: Rango, hoy: string, params: Params): Promise<DatosReporte> {
  switch (vista) {
    case "trabajador":
      return { vista, filas: await reportePorTrabajador(rango, hoy) };
    case "obra":
      return { vista, filas: await reportePorObra(rango) };
    case "detalle": {
      const filtros = parsearFiltrosDetalle(params);
      const [{ filas, total }, opciones] = await Promise.all([
        reporteDetalle(rango, filtros, LIMITE_DETALLE),
        opcionesDetalle(rango),
      ]);
      return { vista, filas, total, filtros, opciones };
    }
  }
}

export default async function ReportesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const hoy = hoyIso();
  const rango = parsearRango(params.desde, params.hasta, hoy);
  const datos = await cargar(parsearVistaReporte(params.vista), rango, hoy, params);
  return <ReportesView rango={rango} hoy={hoy} datos={datos} />;
}
