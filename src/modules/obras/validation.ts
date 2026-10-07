import { z } from "zod";
import { aTitleCase, vacioANull } from "@/core/lib/texto";
import { COLORES_OBRA, ESTADOS_OBRA, TIPOS_OBRA } from "./constants";

export const obraInput = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio.")
    .max(80, "Máximo 80 caracteres.")
    .transform(aTitleCase),
  tipo: z.enum(TIPOS_OBRA, { error: "Elegí un tipo." }),
  ubicacion: z
    .string()
    .trim()
    .max(80, "Máximo 80 caracteres.")
    .nullish()
    .transform((v) => {
      const limpio = vacioANull(v);
      return limpio ? aTitleCase(limpio) : null;
    }),
  color: z.enum(COLORES_OBRA, { error: "Elegí un color de la paleta." }),
  notas: z.string().trim().max(500, "Máximo 500 caracteres.").nullish().transform(vacioANull),
});

// El color llega como string desde el formulario; Zod valida que sea de la paleta.
export type ObraInput = Omit<z.input<typeof obraInput>, "color"> & { color: string };

export const filtrosObras = z.object({
  estado: z.enum([...ESTADOS_OBRA, "todas"]).catch("activa"),
  tipo: z.enum([...TIPOS_OBRA, "todos"]).catch("todos"),
});

export type FiltrosObras = z.infer<typeof filtrosObras>;
