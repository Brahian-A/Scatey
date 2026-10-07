import type { Metadata } from "next";
import { ImportarView } from "@/modules/jornales/import/components/ImportarView";
import { hoyIso } from "@/modules/jornales/queries";
import { ETIQUETA_TIPO, TIPOS_OBRA } from "@/modules/obras/queries";

export const metadata: Metadata = { title: "Importar jornales" };
// El año sugerido depende de la fecha de cada request.
export const dynamic = "force-dynamic";

export default function ImportarPage() {
  return (
    <ImportarView
      anioActual={Number(hoyIso().slice(0, 4))}
      tiposObra={TIPOS_OBRA.map((t) => ({ value: t, label: ETIQUETA_TIPO[t] }))}
    />
  );
}
