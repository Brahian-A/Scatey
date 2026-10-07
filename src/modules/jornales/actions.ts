"use server";

import { and, eq, gte, inArray, lt, max, or, sql } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/core/db/client";
import { obras, trabajadores } from "@/core/db/schema";
import { falla, ok, type ResultadoAccion } from "@/core/lib/acciones";
import { lunesDe, sumarDias } from "./fechas";
import { jornalesManifest } from "./manifest";
import { jornales } from "./schema";
import { celdaInput, claveCelda, fechaInput, jornalInput, MAX_CELDAS, type Celda, type Jornal, type JornalInput } from "./validation";

function revalidar() {
  revalidatePath(jornalesManifest.href);
}

function primerError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Datos inválidos.";
}

const excluido = (col: SQLiteColumn) => sql.raw(`excluded.${col.name}`);

/** Upsert sobre (fecha, trabajador_id): una sola sentencia, atómica. */
function upsert(ejecutor: Pick<typeof db, "insert">, registros: Jornal[]) {
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

function sinRepetidos(celdas: Celda[]): boolean {
  return new Set(celdas.map(claveCelda)).size === celdas.length;
}

/** Guarda (crea o reemplaza) varias celdas a la vez. */
export async function guardarJornales(input: JornalInput[]): Promise<ResultadoAccion> {
  const parsed = z.array(jornalInput).min(1).max(MAX_CELDAS).safeParse(input);
  if (!parsed.success) return falla(primerError(parsed.error));
  if (!sinRepetidos(parsed.data)) return falla("Hay celdas repetidas.");

  try {
    await upsert(db, parsed.data);
  } catch (e) {
    console.error("guardarJornales", e);
    return falla("No se pudo guardar. Revisá que la obra y el trabajador existan.");
  }

  revalidar();
  return ok();
}

/** Vacía celdas (borra el registro de ese día para ese trabajador). */
export async function borrarJornales(input: Celda[]): Promise<ResultadoAccion> {
  const parsed = z.array(celdaInput).min(1).max(MAX_CELDAS).safeParse(input);
  if (!parsed.success) return falla(primerError(parsed.error));

  await db
    .delete(jornales)
    .where(or(...parsed.data.map((c) => and(eq(jornales.fecha, c.fecha), eq(jornales.trabajadorId, c.trabajadorId)))));

  revalidar();
  return ok();
}

export type ResultadoCopia =
  | { estado: "confirmar"; conflictos: number }
  | { estado: "listo"; copiados: number; desde?: string };

type ValorCopiado = Pick<Jornal, "estado" | "obraId" | "motivoAusencia" | "fraccion">;

function mismoValor(a: ValorCopiado, b: ValorCopiado): boolean {
  return a.estado === b.estado && a.obraId === b.obraId && a.motivoAusencia === b.motivoAusencia && a.fraccion === b.fraccion;
}

/**
 * Copia los jornales de cada día `desde` a su día `hacia`. Solo copia trabajadores
 * activos y obras activas; las notas no se copian.
 * - `sobrescribir` sin definir: si alguna celda destino ya tiene otro valor, no
 *   escribe nada y devuelve cuántos conflictos hay para que el usuario decida.
 * - `false`: completa solo las celdas vacías. `true`: pisa las que tienen valor.
 */
async function copiar(pares: Array<[desde: string, hacia: string]>, sobrescribir: boolean | undefined) {
  const destinoDe = new Map(pares);

  return db.transaction(async (tx): Promise<ResultadoCopia> => {
    const origen = await tx
      .select({
        fecha: jornales.fecha,
        trabajadorId: jornales.trabajadorId,
        estado: jornales.estado,
        obraId: jornales.obraId,
        motivoAusencia: jornales.motivoAusencia,
        fraccion: jornales.fraccion,
      })
      .from(jornales)
      .innerJoin(trabajadores, and(eq(trabajadores.id, jornales.trabajadorId), eq(trabajadores.activo, true)))
      .leftJoin(obras, eq(obras.id, jornales.obraId))
      .where(
        and(
          inArray(jornales.fecha, [...destinoDe.keys()]),
          or(eq(jornales.estado, "ausente"), eq(obras.estado, "activa")),
        ),
      );

    const existentes = new Map(
      (
        await tx
          .select({
            fecha: jornales.fecha,
            trabajadorId: jornales.trabajadorId,
            estado: jornales.estado,
            obraId: jornales.obraId,
            motivoAusencia: jornales.motivoAusencia,
            fraccion: jornales.fraccion,
          })
          .from(jornales)
          .where(inArray(jornales.fecha, [...destinoDe.values()]))
      ).map((r) => [claveCelda(r), r]),
    );

    const nuevos = origen.map((r) => ({ ...r, fecha: destinoDe.get(r.fecha)!, nota: null }) as Jornal);
    const conflictos = nuevos.filter((n) => {
      const actual = existentes.get(claveCelda(n));
      return actual && !mismoValor(actual, n);
    });

    if (sobrescribir === undefined && conflictos.length > 0) {
      return { estado: "confirmar", conflictos: conflictos.length };
    }

    const aEscribir = nuevos.filter((n) => {
      const actual = existentes.get(claveCelda(n));
      return !actual || (sobrescribir && !mismoValor(actual, n));
    });
    if (aEscribir.length > 0) await upsert(tx, aEscribir);

    return { estado: "listo", copiados: aEscribir.length };
  });
}

const sobrescribirInput = z.boolean().optional();

/** Copia al día `fecha` el último día con jornales cargados (hasta 7 días atrás). */
export async function copiarDiaAnterior(
  fecha: string,
  sobrescribir?: boolean,
): Promise<ResultadoAccion<ResultadoCopia>> {
  if (!fechaInput.safeParse(fecha).success || !sobrescribirInput.safeParse(sobrescribir).success) {
    return falla("Datos inválidos.");
  }

  const [ultimo] = await db
    .select({ fecha: max(jornales.fecha) })
    .from(jornales)
    .where(and(lt(jornales.fecha, fecha), gte(jornales.fecha, sumarDias(fecha, -7))));
  const desde = ultimo?.fecha;
  if (!desde) return falla("No hay jornales cargados en los 7 días anteriores.");

  const res = await copiar([[desde, fecha]], sobrescribir);
  if (res.estado === "listo") revalidar();
  return ok(res.estado === "listo" ? { ...res, desde } : res);
}

/** Copia cada día de la semana anterior al mismo día de `semana` (un lunes). */
export async function copiarSemanaAnterior(
  semana: string,
  sobrescribir?: boolean,
): Promise<ResultadoAccion<ResultadoCopia>> {
  if (
    !fechaInput.safeParse(semana).success ||
    lunesDe(semana) !== semana ||
    !sobrescribirInput.safeParse(sobrescribir).success
  ) {
    return falla("Datos inválidos.");
  }

  const pares = Array.from({ length: 7 }, (_, i): [string, string] => [sumarDias(semana, i - 7), sumarDias(semana, i)]);
  const res = await copiar(pares, sobrescribir);
  if (res.estado === "listo") revalidar();
  return ok(res);
}
