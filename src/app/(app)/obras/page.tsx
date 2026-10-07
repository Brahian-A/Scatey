import type { Metadata } from "next";
import { ObrasView } from "@/modules/obras/components/ObrasView";
import { listarObras, parsearFiltrosObras } from "@/modules/obras/queries";

export const metadata: Metadata = { title: "Obras" };

export default async function ObrasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filtros = parsearFiltrosObras(await searchParams);
  const obras = await listarObras(filtros);
  return <ObrasView obras={obras} filtros={filtros} />;
}
