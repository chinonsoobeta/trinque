CREATE TABLE `group_candidates` (
	`group_id` text NOT NULL,
	`candidate_id` text NOT NULL,
	`name` text NOT NULL,
	`restaurant` text NOT NULL,
	`neighborhood` text NOT NULL,
	`distance_km` integer NOT NULL,
	`price` text NOT NULL,
	`image` text NOT NULL,
	`score` integer NOT NULL,
	`eligible` integer NOT NULL,
	`explanation` text NOT NULL,
	`conflicts` text DEFAULT '[]' NOT NULL,
	PRIMARY KEY(`group_id`, `candidate_id`),
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `group_rsvps` (
	`group_id` text NOT NULL,
	`user_id` text NOT NULL,
	`status` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`group_id`, `user_id`),
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `group_votes` (
	`group_id` text NOT NULL,
	`user_id` text NOT NULL,
	`candidate_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`group_id`, `user_id`),
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `groups` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`event_time` text NOT NULL,
	`neighborhood` text NOT NULL,
	`budget_max` integer NOT NULL,
	`max_distance_km` integer NOT NULL,
	`vegetarian_required` integer DEFAULT 0 NOT NULL,
	`allergies` text DEFAULT '[]' NOT NULL,
	`invite_code` text NOT NULL,
	`status` text DEFAULT 'voting' NOT NULL,
	`selected_candidate_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `groups_invite_code_unique` ON `groups` (`invite_code`);