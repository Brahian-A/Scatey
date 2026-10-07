import type { ModuleManifest } from "./types";
import { jornalesManifest } from "@/modules/jornales/manifest";
import { personalManifest } from "@/modules/personal/manifest";
import { obrasManifest } from "@/modules/obras/manifest";

// Para agregar un módulo: crear src/modules/<id>/ y sumar su manifest acá.
const modules: ModuleManifest[] = [jornalesManifest, personalManifest, obrasManifest];

export const registry: readonly ModuleManifest[] = [...modules].sort((a, b) => a.order - b.order);
