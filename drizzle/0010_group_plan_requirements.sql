ALTER TABLE `groups` ADD `distance_unit` text DEFAULT 'metric' NOT NULL;
--> statement-breakpoint
ALTER TABLE `groups` ADD `dietary_requirements` text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
ALTER TABLE `groups` ADD `cuisine_types` text DEFAULT '[]' NOT NULL;
