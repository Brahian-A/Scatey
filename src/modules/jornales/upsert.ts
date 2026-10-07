import "server-only";
import { sql } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import type { db } from "@/core/db/client";
import { jornales } from "./schema";
import type { Jornal } from "./validation";

const excluido = (col: SQLiteColumn) => sql.raw(`excluded.${col.name}`);

/** Upsert sobre (fecha, trabajador_id): una sola sentencia, atómica. */
export function upsert(ejecutor: Pick<typeof db, "insert">, registros: Jornal[]) {
  return ejecutor
    .insert(jornales)
    .values(registros)
    .onConflictDoUpdate({
      target: [jornales.fecha, jornales.trabajadorId],
      set: {
        estado: excluido(jornales.estado),
        obraId: excluido(jornales.obraId),
        motivoAusencia: excluido(jornales.motivoAusencia),
        fraccion: excluido(jornales.fraccion),
        nota: excluido(jornales.nota),
        updatedAt: excluido(jornales.updatedAt),
      },
    });
}
