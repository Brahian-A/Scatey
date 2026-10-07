import type { Metadata } from "next";
import { JornalesView } from "@/modules/jornales/components/JornalesView";
import { hoyIso, obtenerGrillaSemana, parsearSemana } from "@/modules/jornales/queries";

export const metadata: Metadata = { title: "Jornales" };
// Sin ?semana= se muestra la semana actual, que depende de la fecha de cada request.
export const dynamic = "force-dynamic";

export default async function JornalesPage({ searchParams }: { searchParams: Promise<{ semana?: string }> }) {
  const semana = parsearSemana((await searchParams).semana);
  const grilla = await obtenerGrillaSemana(semana);
  return <JornalesView key={semana} grilla={grilla} hoy={hoyIso()} />;
}
