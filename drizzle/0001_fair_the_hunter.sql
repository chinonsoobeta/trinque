CREATE TABLE `published_dishes` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`source_mode` text NOT NULL,
	`name` text NOT NULL,
	`cuisine` text NOT NULL,
	`ingredients` text NOT NULL,
	`dietary` text NOT NULL,
	`confidence` integer NOT NULL,
	`description` text NOT NULL,
	`image_key` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
