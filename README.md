# Scatey — gestión interna

Aplicación interna para la empresa: personal, obras y (próximamente) jornales, órdenes de compra, stock y coordinación.
Funciona **en una sola PC**, con la base de datos guardada en un archivo local (`data/app.db`). No necesita internet para funcionar.

## 1. Instalar Node.js (una sola vez)

Se necesita **Node.js 20 o superior** (recomendado: la versión LTS).

- **Windows / macOS:** descargar el instalador "LTS" desde <https://nodejs.org/es> y seguir los pasos (siguiente, siguiente…).
- **Linux (Ubuntu/Debian):**
  ```bash
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
  ```

Para verificar, abrir una terminal (en Windows: "Símbolo del sistema" o "PowerShell") y escribir:

```bash
node -v   # debe mostrar v20.x o superior
npm -v
```

## 2. Instalar la aplicación (una sola vez)

Dentro de la carpeta del proyecto:

```bash
npm install          # descarga las dependencias
npm run db:migrate   # crea la base de datos en data/app.db
npm run db:seed      # carga el personal y las obras iniciales
```

`db:seed` se puede correr más de una vez: no duplica datos.

## 3. Usar la aplicación

### Modo normal (recomendado para el día a día)

```bash
npm run build        # solo la primera vez y cada vez que se actualiza el código
npm start
```

Abrir en el navegador: <http://localhost:3000>

### Modo desarrollo (para hacer cambios en el código)

```bash
npm run dev
```

## 4. Abrir la app desde otra PC de la red (LAN)

1. En la PC donde está instalada la app, iniciarla así:
   ```bash
   npm run build      # si no se hizo antes
   npm run start:lan
   ```
2. Averiguar la IP de esa PC:
   - **Windows:** en una terminal escribir `ipconfig` y buscar "Dirección IPv4" (por ejemplo `192.168.1.50`).
   - **Linux:** `hostname -I` (el primer número).
   - **macOS:** Preferencias del Sistema → Red.
3. Desde la otra PC (o celular) conectada al **mismo Wi-Fi / red**, abrir en el navegador:
   `http://192.168.1.50:3000` (cambiando por la IP real).
4. Si no abre, probablemente el firewall está bloqueando el puerto 3000:
   - **Windows:** al iniciar la app por primera vez aparece un aviso del Firewall → marcar "Redes privadas" y "Permitir acceso". Si no apareció: Panel de control → Firewall de Windows Defender → Configuración avanzada → Reglas de entrada → Nueva regla → Puerto → TCP 3000 → Permitir.
   - **Linux (ufw):** `sudo ufw allow 3000/tcp`

> Conviene que la PC servidor tenga **IP fija** en el router, así la dirección no cambia.
> Todas las PCs usan la misma base de datos: la de la PC servidor.

## 5. Copias de seguridad (backup)

```bash
npm run db:backup
```

Crea una copia en `data/backups/app-AAAAMMDD-HHmm.db` (fecha y hora de Montevideo).
Se puede hacer con la app abierta. **Recomendado: hacer backup todos los días** y copiar la carpeta `data/backups` a un pendrive o a la nube de vez en cuando.

### Restaurar un backup

1. Cerrar la app (Ctrl + C en la terminal donde corre).
2. Renombrar `data/app.db` a `data/app-roto.db` (por las dudas).
3. Copiar el backup elegido a `data/app.db`.
4. Volver a iniciar la app.

## 6. Actualizar a una versión nueva del código

```bash
npm run db:backup    # siempre antes de actualizar
git pull
npm install
npm run db:migrate   # aplica cambios en la base, si los hay
npm run build
npm start            # o npm run start:lan
```

## Comandos disponibles

| Comando               | Qué hace                                                      |
| --------------------- | ------------------------------------------------------------- |
| `npm run dev`         | Modo desarrollo en <http://localhost:3000>                    |
| `npm run build`       | Prepara la app para uso normal                                |
| `npm start`           | Inicia la app (solo en esta PC)                               |
| `npm run start:lan`   | Inicia la app accesible desde otras PCs de la red             |
| `npm run db:migrate`  | Crea / actualiza la estructura de la base de datos            |
| `npm run db:seed`     | Carga datos iniciales (personal y obras)                      |
| `npm run db:backup`   | Copia la base a `data/backups/`                               |
| `npm run db:generate` | (Desarrollo) Genera una migración nueva a partir del schema   |

---

## Para desarrolladores

**Stack:** Next.js 15 (App Router) · TypeScript estricto · Tailwind 4 · shadcn/ui · Drizzle ORM + libsql (SQLite) · Zod · Server Actions · date-fns (es, America/Montevideo, semana empieza el lunes).

La ruta de la base se configura con `DATABASE_URL` (por defecto `file:./data/app.db`; ver `.env.example`).

### Estructura

```
src/
  core/                 # infraestructura compartida
    db/client.ts        # cliente drizzle
    db/schema.ts        # re-exporta el schema de cada módulo
    db/columns.ts       # helpers: id UUID, created_at / updated_at
    lib/                # fechas (zona Montevideo), texto (Title Case), resultados de acciones
    modules/registry.ts # lista de módulos → arma la barra lateral
    ui/AppShell.tsx     # barra lateral + área principal
  modules/<modulo>/
    manifest.ts         # id, label, href, icon, order
    schema.ts           # tablas drizzle
    queries.ts          # lecturas (API pública del módulo)
    actions.ts          # Server Actions (API pública del módulo)
    components/         # UI del módulo
  app/(app)/<modulo>/page.tsx   # páginas "finitas": leen datos y renderizan el componente del módulo
```

**Reglas:**

- Un módulo nunca importa archivos internos de otro módulo; solo su `queries.ts` o `actions.ts`.
- Las páginas no tienen lógica: la lógica vive en el módulo.
- Claves primarias: UUID en texto. Todas las tablas tienen `created_at` / `updated_at`.
- Nada se borra: trabajadores se desactivan, obras se marcan como terminadas.

### Agregar un módulo nuevo

1. Crear `src/modules/<id>/` con `manifest.ts`, `schema.ts`, `queries.ts`, `actions.ts` y `components/`.
2. Sumar el manifest en `src/core/modules/registry.ts` (una línea en el import y otra en el array).
3. Si tiene tablas: agregar `export * from "../../modules/<id>/schema";` en `src/core/db/schema.ts` y correr `npm run db:generate` y `npm run db:migrate`.
4. Crear la página en `src/app/(app)/<id>/page.tsx`.
