"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/core/db/client";
import { falla, fallaValidacion, ok, type ResultadoAccion } from "@/core/lib/acciones";
import { ESTADOS_OBRA, type EstadoObra } from "./constants";
import { obrasManifest } from "./manifest";
import { obras } from "./schema";
import { obraInput, type ObraInput } from "./validation";

const idSchema = z.uuid();

function revalidar() {
  revalidatePath(obrasManifest.href);
}

export async function crearObra(input: ObraInput): Promise<ResultadoAccion<{ id: string }>> {
  const parsed = obraInput.safeParse(input);
  if (!parsed.success) return fallaValidacion(parsed.error);

  const [creada] = await db.insert(obras).values(parsed.data).returning({ id: obras.id });

  revalidar();
  return ok({ id: creada!.id });
}

export async function actualizarObra(id: string, input: ObraInput): Promise<ResultadoAccion> {
  if (!idSchema.safeParse(id).success) return falla("Obra inválida.");
  const parsed = obraInput.safeParse(input);
  if (!parsed.success) return fallaValidacion(parsed.error);

  const res = await db.update(obras).set(parsed.data).where(eq(obras.id, id)).returning({ id: obras.id });
  if (res.length === 0) return falla("La obra no existe.");

  revalidar();
  return ok();
}

/** Nunca se borra una obra: se marca como terminada. */
export async function cambiarEstadoObra(id: string, estado: EstadoObra): Promise<ResultadoAccion> {
  if (!idSchema.safeParse(id).success || !ESTADOS_OBRA.includes(estado)) return falla("Datos inválidos.");

  const res = await db.update(obras).set({ estado }).where(eq(obras.id, id)).returning({ id: obras.id });
  if (res.length === 0) return falla("La obra no existe.");

  revalidar();
  return ok();
}
