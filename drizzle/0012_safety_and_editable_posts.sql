ALTER TABLE `published_dishes` ADD `caption` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `published_dishes` ADD `taste_notes` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `published_dishes` ADD `dietary_notes` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `published_dishes` ADD `personal_comments` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `published_dishes` ADD `location_tag` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `published_dishes` ADD `image_retained` integer DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE `published_dishes` ADD `moderation_status` text DEFAULT 'active' NOT NULL;
--> statement-breakpoint
ALTER TABLE `published_dishes` ADD `deleted_at` text;
--> statement-breakpoint
ALTER TABLE `comments` ADD `moderation_status` text DEFAULT 'active' NOT NULL;
--> statement-breakpoint
ALTER TABLE `comments` ADD `deleted_at` text;
--> statement-breakpoint
CREATE TABLE `blocks` (`blocker_id` text NOT NULL, `blocked_id` text NOT NULL, `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL, PRIMARY KEY(`blocker_id`, `blocked_id`), FOREIGN KEY (`blocker_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade, FOREIGN KEY (`blocked_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade, CHECK (`blocker_id` <> `blocked_id`));
--> statement-breakpoint
CREATE TABLE `mutes` (`muter_id` text NOT NULL, `muted_id` text NOT NULL, `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL, PRIMARY KEY(`muter_id`, `muted_id`), FOREIGN KEY (`muter_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade, FOREIGN KEY (`muted_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade, CHECK (`muter_id` <> `muted_id`));
--> statement-breakpoint
CREATE TABLE `hidden_dishes` (`user_id` text NOT NULL, `dish_id` text NOT NULL, `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL, PRIMARY KEY(`user_id`, `dish_id`), FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade, FOREIGN KEY (`dish_id`) REFERENCES `published_dishes`(`id`) ON UPDATE no action ON DELETE cascade);
--> statement-breakpoint
CREATE TABLE `content_reports` (`id` text PRIMARY KEY NOT NULL, `reporter_id` text NOT NULL, `target_type` text NOT NULL, `target_id` text NOT NULL, `reason` text NOT NULL, `details` text DEFAULT '' NOT NULL, `status` text DEFAULT 'open' NOT NULL, `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL, `resolved_at` text, FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade);
--> statement-breakpoint
CREATE INDEX `content_reports_status_created_idx` ON `content_reports` (`status`,`created_at`);
--> statement-breakpoint
CREATE INDEX `content_reports_target_idx` ON `content_reports` (`target_type`,`target_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `moderation_actions` (`id` text PRIMARY KEY NOT NULL, `report_id` text, `admin_id` text NOT NULL, `target_type` text NOT NULL, `target_id` text NOT NULL, `action` text NOT NULL, `reason` text DEFAULT '' NOT NULL, `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL, FOREIGN KEY (`report_id`) REFERENCES `content_reports`(`id`) ON UPDATE no action ON DELETE set null, FOREIGN KEY (`admin_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict);
--> statement-breakpoint
CREATE INDEX `moderation_actions_target_idx` ON `moderation_actions` (`target_type`,`target_id`,`created_at`);
