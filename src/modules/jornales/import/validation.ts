import { z } from "zod";
import { TIPOS_OBRA } from "@/modules/obras/queries";
import { VALORES_MOTIVO } from "../schema";
import { fechaInput } from "../validation";

/** Tope de registros por importación (varios años de una cuadrilla grande). */
export const MAX_FILAS_IMPORTACION = 20_000;

const texto = z.string().trim().min(1).max(200);

/** Una celda de la planilla ya leída (ver `FilaLegacy`). `destino: null` = falta (XXX). */
export const filaImportadaInput = z.object({
  fila: z.int().positive(),
  fecha: fechaInput,
  trabajador: texto,
  destino: texto.nullable(),
});

export const decisionTrabajador = z.discriminatedUnion(
  "accion",
  [
    z.object({ accion: z.literal("existente"), id: z.uuid({ error: "Trabajador inválido." }) }),
    // nombre/apellido se validan con el schema de Personal al importar.
    z.object({ accion: z.literal("nuevo"), nombre: z.string(), apellido: z.string() }),
    z.object({ accion: z.literal("ignorar") }),
  ],
  { error: "Elegí qué hacer con el trabajador." },
);
export type DecisionTrabajador = z.infer<typeof decisionTrabajador>;

export const decisionDestino = z.discriminatedUnion(
  "accion",
  [
    z.object({ accion: z.literal("existente"), id: z.uuid({ error: "Obra inválida." }) }),
    // nombre se valida con el schema de Obras al importar.
    z.object({ accion: z.literal("nuevo"), nombre: z.string(), tipo: z.enum(TIPOS_OBRA, { error: "Elegí un tipo." }) }),
    z.object({ accion: z.literal("ausente"), motivo: z.enum(VALORES_MOTIVO, { error: "Elegí un motivo." }) }),
    z.object({ accion: z.literal("ignorar") }),
  ],
  { error: "Elegí qué hacer con el destino." },
);
export type DecisionDestino = z.infer<typeof decisionDestino>;

/** Las decisiones van por clave normalizada (ver `normalizar`). */
export const importacionInput = z.object({
  filas: z.array(filaImportadaInput).min(1, "No hay filas para importar.").max(MAX_FILAS_IMPORTACION),
  trabajadores: z.record(z.string(), decisionTrabajador),
  destinos: z.record(z.string(), decisionDestino),
});
export type ImportacionInput = z.input<typeof importacionInput>;
export type FilaImportada = z.infer<typeof filaImportadaInput>;
