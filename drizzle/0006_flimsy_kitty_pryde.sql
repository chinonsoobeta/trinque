CREATE TABLE `usage_counters` (
	`action` text NOT NULL,
	`scope` text NOT NULL,
	`window_start` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`action`, `scope`, `window_start`)
);
--> statement-breakpoint
CREATE INDEX `usage_counters_cleanup_idx` ON `usage_counters` (`window_start`);--> statement-breakpoint
CREATE TABLE `user_consents` (
	`user_id` text PRIMARY KEY NOT NULL,
	`location_consent` integer DEFAULT false NOT NULL,
	`analytics_consent` integer DEFAULT false NOT NULL,
	`image_retention_consent` integer DEFAULT false NOT NULL,
	`consented_at` text,
	`withdrawn_at` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT OR IGNORE INTO `user_consents` (`user_id`, `location_consent`, `consented_at`, `updated_at`) SELECT `user_id`, true, COALESCE(`location_updated_at`, `updated_at`), COALESCE(`location_updated_at`, `updated_at`) FROM `preferences` WHERE `location_latitude` IS NOT NULL AND `location_longitude` IS NOT NULL;
