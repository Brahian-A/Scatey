import { z } from "zod";
import { vacioANull } from "@/core/lib/texto";
import { esFechaIso } from "./fechas";
import { FRACCIONES, VALORES_MOTIVO } from "./schema";

/** Máximo de celdas por operación (una semana completa de ~80 trabajadores). */
export const MAX_CELDAS = 500;

export const fechaInput = z.string().refine(esFechaIso, "Fecha inválida.");

export const celdaInput = z.object({
  fecha: fechaInput,
  trabajadorId: z.uuid({ error: "Trabajador inválido." }),
});
export type Celda = z.infer<typeof celdaInput>;

const comunes = {
  ...celdaInput.shape,
  fraccion: z.literal(FRACCIONES, { error: "La fracción debe ser 1 o ½." }).default(1),
  nota: z.string().trim().max(200, "Máximo 200 caracteres.").nullish().transform(vacioANull),
};

// Mismas reglas que el CHECK de la tabla: trabajo ⇒ obra sin motivo; ausente ⇒ motivo sin obra.
export const jornalInput = z.discriminatedUnion(
  "estado",
  [
    z.object({
      ...comunes,
      estado: z.literal("trabajo"),
      obraId: z.uuid({ error: "Elegí una obra." }),
      motivoAusencia: z.null({ error: "Un día trabajado no lleva motivo de ausencia." }).default(null),
    }),
    z.object({
      ...comunes,
      estado: z.literal("ausente"),
      obraId: z.null({ error: "Una ausencia no lleva obra." }).default(null),
      motivoAusencia: z.enum(VALORES_MOTIVO, { error: "Elegí un motivo de ausencia." }),
    }),
  ],
  { error: "Elegí una obra o un motivo de ausencia." },
);

export type JornalInput = z.input<typeof jornalInput>;
export type Jornal = z.output<typeof jornalInput>;

export function claveCelda(c: Celda): string {
  return `${c.fecha}|${c.trabajadorId}`;
}
