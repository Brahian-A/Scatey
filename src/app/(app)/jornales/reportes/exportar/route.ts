import type { NextRequest } from "next/server";
import { descargarExcel, excelReportes } from "@/modules/jornales/exportar";
import { parsearRango } from "@/modules/jornales/queries";

/** GET ?desde=&hasta= → .xlsx con los tres reportes. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const rango = parsearRango(params.get("desde"), params.get("hasta"));
  return descargarExcel(await excelReportes(rango));
}
