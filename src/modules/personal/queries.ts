import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/core/db/client";
import { trabajadores } from "./schema";

export type Trabajador = typeof trabajadores.$inferSelect;
export { nombreCompleto } from "./format";
export { trabajadorInput } from "./validation";

/** Por defecto solo devuelve trabajadores activos, en el orden definido. */
export async function listarTrabajadores(opciones: { incluirInactivos?: boolean } = {}): Promise<Trabajador[]> {
  return db
    .select()
    .from(trabajadores)
    .where(opciones.incluirInactivos ? undefined : eq(trabajadores.activo, true))
    .orderBy(asc(trabajadores.orden), asc(trabajadores.nombre));
}

export async function obtenerTrabajador(id: string): Promise<Trabajador | undefined> {
  return db.query.trabajadores.findFirst({ where: eq(trabajadores.id, id) });
}
