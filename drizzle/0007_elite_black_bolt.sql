CREATE TABLE `analytics_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`event` text NOT NULL,
	`language` text,
	`country_code` text,
	`mode` text,
	`outcome` text,
	`duration_ms` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `analytics_events_user_created_idx` ON `analytics_events` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `analytics_events_event_created_idx` ON `analytics_events` (`event`,`created_at`);--> statement-breakpoint
CREATE TABLE `feedback_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`reason` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text,
	`comment` text,
	`country_code` text,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`resolved_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `feedback_reports_target_idx` ON `feedback_reports` (`target_type`,`target_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `feedback_reports_status_idx` ON `feedback_reports` (`status`,`created_at`);