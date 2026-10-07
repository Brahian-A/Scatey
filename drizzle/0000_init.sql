CREATE TABLE `trabajadores` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`apellido` text DEFAULT '' NOT NULL,
	`apodo` text,
	`telefono` text,
	`activo` integer DEFAULT true NOT NULL,
	`orden` integer DEFAULT 0 NOT NULL,
	`notas` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `trabajadores_activo_orden_idx` ON `trabajadores` (`activo`,`orden`);--> statement-breakpoint
CREATE TABLE `obras` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`tipo` text NOT NULL,
	`ubicacion` text,
	`color` text NOT NULL,
	`estado` text DEFAULT 'activa' NOT NULL,
	`notas` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `obras_estado_idx` ON `obras` (`estado`);