import { z } from "zod";
import { aTitleCase, vacioANull } from "@/core/lib/texto";

const textoOpcional = (max: number) =>
  z.string().trim().max(max, `Máximo ${max} caracteres.`).nullish().transform(vacioANull);

export const trabajadorInput = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio.")
    .max(60, "Máximo 60 caracteres.")
    .transform(aTitleCase),
  apellido: z.string().trim().max(60, "Máximo 60 caracteres.").default("").transform(aTitleCase),
  apodo: textoOpcional(40).transform((v) => (v ? aTitleCase(v) : null)),
  telefono: textoOpcional(30).refine((v) => v === null || /^[0-9+()\s-]+$/.test(v), {
    message: "Solo números, espacios, +, - y paréntesis.",
  }),
  notas: textoOpcional(500),
});

export type TrabajadorInput = z.input<typeof trabajadorInput>;
