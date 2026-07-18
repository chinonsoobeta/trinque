ALTER TABLE `preferences` ADD `language` text DEFAULT 'en-CA' NOT NULL;--> statement-breakpoint
ALTER TABLE `preferences` ADD `theme` text DEFAULT 'system' NOT NULL;--> statement-breakpoint
ALTER TABLE `preferences` ADD `measurement_system` text DEFAULT 'metric' NOT NULL;--> statement-breakpoint
ALTER TABLE `preferences` ADD `location_latitude` real;--> statement-breakpoint
ALTER TABLE `preferences` ADD `location_longitude` real;--> statement-breakpoint
ALTER TABLE `preferences` ADD `location_locality` text;--> statement-breakpoint
ALTER TABLE `preferences` ADD `location_administrative_region` text;--> statement-breakpoint
ALTER TABLE `preferences` ADD `location_country_code` text;--> statement-breakpoint
ALTER TABLE `preferences` ADD `location_time_zone` text;--> statement-breakpoint
ALTER TABLE `preferences` ADD `location_currency_code` text;--> statement-breakpoint
ALTER TABLE `preferences` ADD `location_locale` text;--> statement-breakpoint
ALTER TABLE `preferences` ADD `location_updated_at` text;