CREATE TABLE `restaurants` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`provider_place_id` text,
	`name` text NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`locality` text NOT NULL,
	`administrative_region` text NOT NULL,
	`country_code` text NOT NULL,
	`address` text NOT NULL,
	`currency_code` text NOT NULL,
	`record_source` text DEFAULT 'community_submitted' NOT NULL,
	`created_by_id` text,
	`provider_updated_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `restaurants_provider_place_unique` ON `restaurants` (`provider`,`provider_place_id`);--> statement-breakpoint
CREATE INDEX `restaurants_country_location_idx` ON `restaurants` (`country_code`,`latitude`,`longitude`);--> statement-breakpoint
ALTER TABLE `published_dishes` ADD `restaurant_id` text REFERENCES restaurants(id);--> statement-breakpoint
ALTER TABLE `published_dishes` ADD `contributor_id` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `published_dishes` ADD `price_amount` real;--> statement-breakpoint
ALTER TABLE `published_dishes` ADD `currency_code` text;--> statement-breakpoint
ALTER TABLE `published_dishes` ADD `price_knowledge` text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE `published_dishes` ADD `provenance` text DEFAULT 'ai_identified' NOT NULL;--> statement-breakpoint
ALTER TABLE `published_dishes` ADD `verification_status` text DEFAULT 'unverified' NOT NULL;--> statement-breakpoint
ALTER TABLE `published_dishes` ADD `availability_knowledge` text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE `published_dishes` ADD `availability_confidence` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `published_dishes` ADD `last_confirmed_at` text;--> statement-breakpoint
ALTER TABLE `published_dishes` ADD `latitude` real;--> statement-breakpoint
ALTER TABLE `published_dishes` ADD `longitude` real;--> statement-breakpoint
ALTER TABLE `published_dishes` ADD `country_code` text;--> statement-breakpoint
ALTER TABLE `published_dishes` ADD `language` text DEFAULT 'en-CA' NOT NULL;--> statement-breakpoint
ALTER TABLE `published_dishes` ADD `original_name` text;--> statement-breakpoint
ALTER TABLE `published_dishes` ADD `canonical_cuisine` text;--> statement-breakpoint
ALTER TABLE `published_dishes` ADD `canonical_ingredients` text;--> statement-breakpoint
ALTER TABLE `published_dishes` ADD `canonical_flavours` text;--> statement-breakpoint
ALTER TABLE `published_dishes` ADD `canonical_metadata_source` text DEFAULT 'user_reviewed' NOT NULL;--> statement-breakpoint
UPDATE `published_dishes` SET `provenance` = 'seed_demo' WHERE `source_mode` = 'demo';--> statement-breakpoint
UPDATE `published_dishes` SET `original_name` = `name` WHERE `original_name` IS NULL;--> statement-breakpoint
CREATE INDEX `published_dishes_restaurant_idx` ON `published_dishes` (`restaurant_id`);--> statement-breakpoint
CREATE INDEX `published_dishes_country_location_idx` ON `published_dishes` (`country_code`,`latitude`,`longitude`);
