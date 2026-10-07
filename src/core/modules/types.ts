import type { icons } from "lucide-react";

/** Nombre de un ícono de lucide-react en PascalCase, p. ej. "Users". */
export type IconName = keyof typeof icons;

export interface ModuleManifest {
  /** Identificador único y estable del módulo. */
  id: string;
  /** Texto que aparece en la barra lateral. */
  label: string;
  /** Ruta de la página principal del módulo. */
  href: string;
  icon: IconName;
  /** Posición en la barra lateral (menor = más arriba). */
  order: number;
}
