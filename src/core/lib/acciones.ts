import type { z } from "zod";

/** Resultado estándar de una Server Action. */
export type ResultadoAccion<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; errores?: Record<string, string[] | undefined> };

export function ok(): ResultadoAccion;
export function ok<T>(data: T): ResultadoAccion<T>;
export function ok<T>(data?: T): ResultadoAccion<T | undefined> {
  return { ok: true, data };
}

export function falla(error: string, errores?: Record<string, string[] | undefined>): { ok: false; error: string; errores?: Record<string, string[] | undefined> } {
  return { ok: false, error, errores };
}

export function fallaValidacion(error: z.ZodError) {
  const errores: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const clave = issue.path.join(".") || "_";
    (errores[clave] ??= []).push(issue.message);
  }
  return falla("Revisá los datos del formulario.", errores);
}
