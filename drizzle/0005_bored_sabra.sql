CREATE TABLE `group_members` (
	`group_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`language` text DEFAULT 'en-CA' NOT NULL,
	`joined_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`group_id`, `user_id`),
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `group_members_user_idx` ON `group_members` (`user_id`,`joined_at`);--> statement-breakpoint
ALTER TABLE `group_candidates` ADD `kind` text DEFAULT 'seed_demo' NOT NULL;--> statement-breakpoint
ALTER TABLE `group_candidates` ADD `restaurant_id` text REFERENCES restaurants(id);--> statement-breakpoint
ALTER TABLE `group_candidates` ADD `provider_place_id` text;--> statement-breakpoint
ALTER TABLE `group_candidates` ADD `price_amount` real;--> statement-breakpoint
ALTER TABLE `group_candidates` ADD `currency_code` text;--> statement-breakpoint
ALTER TABLE `group_candidates` ADD `provenance` text;--> statement-breakpoint
ALTER TABLE `group_candidates` ADD `verification_status` text;--> statement-breakpoint
ALTER TABLE `group_candidates` ADD `current_availability_confirmed` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `group_candidates` ADD `dietary_caveat` text DEFAULT 'Dietary details are unknown; confirm directly.' NOT NULL;--> statement-breakpoint
ALTER TABLE `groups` ADD `invite_expires_at` text;--> statement-breakpoint
ALTER TABLE `groups` ADD `invite_revoked_at` text;--> statement-breakpoint
ALTER TABLE `groups` ADD `latitude` real;--> statement-breakpoint
ALTER TABLE `groups` ADD `longitude` real;--> statement-breakpoint
ALTER TABLE `groups` ADD `locality` text;--> statement-breakpoint
ALTER TABLE `groups` ADD `administrative_region` text;--> statement-breakpoint
ALTER TABLE `groups` ADD `country_code` text;--> statement-breakpoint
ALTER TABLE `groups` ADD `currency_code` text;--> statement-breakpoint
ALTER TABLE `groups` ADD `time_zone` text;--> statement-breakpoint
ALTER TABLE `groups` ADD `locale` text;--> statement-breakpoint
ALTER TABLE `groups` ADD `display_language` text DEFAULT 'en-CA' NOT NULL;--> statement-breakpoint
ALTER TABLE `groups` ADD `updated_at` text DEFAULT '1970-01-01T00:00:00.000Z' NOT NULL;
--> statement-breakpoint
INSERT OR IGNORE INTO `group_members` (`group_id`, `user_id`, `role`, `language`, `joined_at`) SELECT `id`, `owner_id`, 'owner', `display_language`, `created_at` FROM `groups`;
--> statement-breakpoint
UPDATE `groups` SET `invite_expires_at` = strftime('%Y-%m-%dT%H:%M:%fZ', `created_at`, '+7 days') WHERE `invite_expires_at` IS NULL;
--> statement-breakpoint
UPDATE `groups` SET `updated_at` = `created_at` WHERE `updated_at` = '1970-01-01T00:00:00.000Z';
