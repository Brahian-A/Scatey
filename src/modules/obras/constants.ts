export const TIPOS_OBRA = ["cliente", "interna"] as const;
export type TipoObra = (typeof TIPOS_OBRA)[number];

export const ESTADOS_OBRA = ["activa", "terminada"] as const;
export type EstadoObra = (typeof ESTADOS_OBRA)[number];

export const ETIQUETA_TIPO: Record<TipoObra, string> = { cliente: "Cliente", interna: "Interna" };
export const ETIQUETA_ESTADO: Record<EstadoObra, string> = { activa: "Activa", terminada: "Terminada" };

/** 10 colores bien distinguibles entre sí para los chips de obra. */
export const PALETA_OBRAS = [
  { hex: "#2563eb", nombre: "Azul" },
  { hex: "#dc2626", nombre: "Rojo" },
  { hex: "#16a34a", nombre: "Verde" },
  { hex: "#f59e0b", nombre: "Ámbar" },
  { hex: "#7c3aed", nombre: "Violeta" },
  { hex: "#0891b2", nombre: "Celeste" },
  { hex: "#db2777", nombre: "Rosa" },
  { hex: "#92400e", nombre: "Marrón" },
  { hex: "#84cc16", nombre: "Lima" },
  { hex: "#475569", nombre: "Gris pizarra" },
] as const;
export type ColorObra = (typeof PALETA_OBRAS)[number]["hex"];
export const COLORES_OBRA = PALETA_OBRAS.map((c) => c.hex) as [ColorObra, ...ColorObra[]];
