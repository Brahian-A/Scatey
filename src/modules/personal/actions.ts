"use server";

import { eq, inArray, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/core/db/client";
import { falla, fallaValidacion, ok, type ResultadoAccion } from "@/core/lib/acciones";
import { personalManifest } from "./manifest";
import { trabajadores } from "./schema";
import { trabajadorInput, type TrabajadorInput } from "./validation";

const idSchema = z.uuid();

function revalidar() {
  revalidatePath(personalManifest.href);
}

export async function crearTrabajador(input: TrabajadorInput): Promise<ResultadoAccion<{ id: string }>> {
  const parsed = trabajadorInput.safeParse(input);
  if (!parsed.success) return fallaValidacion(parsed.error);

  const [ultimo] = await db.select({ orden: max(trabajadores.orden) }).from(trabajadores);
  const [creado] = await db
    .insert(trabajadores)
    .values({ ...parsed.data, orden: (ultimo?.orden ?? -1) + 1 })
    .returning({ id: trabajadores.id });

  revalidar();
  return ok({ id: creado!.id });
}

export async function actualizarTrabajador(id: string, input: TrabajadorInput): Promise<ResultadoAccion> {
  if (!idSchema.safeParse(id).success) return falla("Trabajador inválido.");
  const parsed = trabajadorInput.safeParse(input);
  if (!parsed.success) return fallaValidacion(parsed.error);

  const res = await db.update(trabajadores).set(parsed.data).where(eq(trabajadores.id, id)).returning({ id: trabajadores.id });
  if (res.length === 0) return falla("El trabajador no existe.");

  revalidar();
  return ok();
}

/** Nunca se borra un trabajador: se desactiva. */
export async function cambiarActivoTrabajador(id: string, activo: boolean): Promise<ResultadoAccion> {
  if (!idSchema.safeParse(id).success) return falla("Trabajador inválido.");

  const res = await db.update(trabajadores).set({ activo }).where(eq(trabajadores.id, id)).returning({ id: trabajadores.id });
  if (res.length === 0) return falla("El trabajador no existe.");

  revalidar();
  return ok();
}

/**
 * Recibe los ids visibles en su nuevo orden y les reasigna los mismos
 * valores de `orden` que ya ocupaban, así los trabajadores ocultos
 * (p. ej. inactivos) no se ven afectados.
 */
export async function reordenarTrabajadores(ids: string[]): Promise<ResultadoAccion> {
  const parsed = z.array(idSchema).min(1).safeParse(ids);
  if (!parsed.success || new Set(ids).size !== ids.length) return falla("Orden inválido.");

  const actuales = await db
    .select({ id: trabajadores.id, orden: trabajadores.orden })
    .from(trabajadores)
    .where(inArray(trabajadores.id, ids));
  if (actuales.length !== ids.length) return falla("Algún trabajador no existe.");

  // Si había valores repetidos, se usan posiciones consecutivas a partir del menor.
  const ordenes = actuales.map((t) => t.orden).sort((a, b) => a - b);
  const slots = new Set(ordenes).size === ordenes.length ? ordenes : ordenes.map((_, i) => ordenes[0]! + i);

  await db.transaction(async (tx) => {
    for (const [i, id] of ids.entries()) {
      await tx.update(trabajadores).set({ orden: slots[i]! }).where(eq(trabajadores.id, id));
    }
  });

  revalidar();
  return ok();
}
