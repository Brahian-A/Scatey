import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/core/db/client";
import { obras } from "./schema";
import { filtrosObras, type FiltrosObras } from "./validation";

export type Obra = typeof obras.$inferSelect;
export type { FiltrosObras } from "./validation";
export { ETIQUETA_ESTADO, ETIQUETA_TIPO, PALETA_OBRAS, TIPOS_OBRA, type TipoObra } from "./constants";
export { obraInput } from "./validation";

/** Convierte la query string en filtros válidos (por defecto: obras activas de cualquier tipo). */
export function parsearFiltrosObras(params: Record<string, string | string[] | undefined>): FiltrosObras {
  return filtrosObras.parse({ estado: params.estado, tipo: params.tipo });
}

export async function listarObras(
  filtros: Partial<FiltrosObras> = {},
): Promise<Obra[]> {
  const { estado = "activa", tipo = "todos" } = filtros;
  return db
    .select()
    .from(obras)
    .where(
      and(
        estado === "todas" ? undefined : eq(obras.estado, estado),
        tipo === "todos" ? undefined : eq(obras.tipo, tipo),
      ),
    )
    .orderBy(asc(obras.nombre));
}

export async function obtenerObra(id: string): Promise<Obra | undefined> {
  return db.query.obras.findFirst({ where: eq(obras.id, id) });
}
