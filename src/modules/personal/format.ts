export function nombreCompleto(t: { nombre: string; apellido: string }): string {
  return [t.nombre, t.apellido].filter(Boolean).join(" ");
}
