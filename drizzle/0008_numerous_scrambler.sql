CREATE TABLE `client_error_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`code` text NOT NULL,
	`platform` text NOT NULL,
	`app_version` text NOT NULL,
	`route` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `client_error_reports_user_created_idx` ON `client_error_reports` (`user_id`,`created_at`);