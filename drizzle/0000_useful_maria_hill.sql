CREATE TABLE `preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`dietary` text DEFAULT 'Flexible' NOT NULL,
	`avoid` text DEFAULT '' NOT NULL,
	`budget_max` integer DEFAULT 40 NOT NULL,
	`radius_minutes` integer DEFAULT 25 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `saves` (
	`user_id` text NOT NULL,
	`dish_id` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`user_id`, `dish_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`auth_type` text NOT NULL,
	`display_name` text NOT NULL,
	`email` text,
	`guest_token_hash` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_guest_token_hash_unique` ON `users` (`guest_token_hash`);