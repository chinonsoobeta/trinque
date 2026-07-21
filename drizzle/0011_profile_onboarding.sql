ALTER TABLE `profiles` ADD `country_code` text;
--> statement-breakpoint
ALTER TABLE `profiles` ADD `favorite_cuisines` text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
ALTER TABLE `profiles` ADD `onboarding_completed_at` text;
