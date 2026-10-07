import type { NextRequest } from "next/server";
import { descargarExcel, excelSemana } from "@/modules/jornales/exportar";
import { parsearSemana } from "@/modules/jornales/queries";

/** GET ?semana=<lunes>&sabado=1 → .xlsx con la grilla de esa semana. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const semana = parsearSemana(params.get("semana"));
  return descargarExcel(await excelSemana(semana, params.get("sabado") === "1"));
}
