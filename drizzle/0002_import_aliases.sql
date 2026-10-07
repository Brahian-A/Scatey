CREATE TABLE `import_aliases` (
	`id` text PRIMARY KEY NOT NULL,
	`tipo` text NOT NULL,
	`clave` text NOT NULL,
	`texto_original` text NOT NULL,
	`target_id` text,
	`motivo` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "import_aliases_destino_check" CHECK("import_aliases"."target_id" IS NULL OR "import_aliases"."motivo" IS NULL),
	CONSTRAINT "import_aliases_motivo_check" CHECK("import_aliases"."tipo" = 'destino' OR "import_aliases"."motivo" IS NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `import_aliases_tipo_clave_uq` ON `import_aliases` (`tipo`,`clave`);