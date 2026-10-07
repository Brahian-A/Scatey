import type { Metadata } from "next";
import { PersonalView } from "@/modules/personal/components/PersonalView";
import { listarTrabajadores } from "@/modules/personal/queries";

export const metadata: Metadata = { title: "Personal" };

export default async function PersonalPage({ searchParams }: { searchParams: Promise<{ inactivos?: string }> }) {
  const mostrarInactivos = (await searchParams).inactivos === "1";
  const trabajadores = await listarTrabajadores({ incluirInactivos: mostrarInactivos });
  return <PersonalView trabajadores={trabajadores} mostrarInactivos={mostrarInactivos} />;
}
