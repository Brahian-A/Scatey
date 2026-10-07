import type { Metadata } from "next";
import { JornalesPlaceholder } from "@/modules/jornales/components/JornalesPlaceholder";

export const metadata: Metadata = { title: "Jornales" };
// La semana actual depende de la fecha de cada request.
export const dynamic = "force-dynamic";

export default function JornalesPage() {
  return <JornalesPlaceholder />;
}
