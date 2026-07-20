ALTER TABLE `users` ADD `normalized_email` text;
--> statement-breakpoint
ALTER TABLE `users` ADD `auth_subject_hash` text;
--> statement-breakpoint
ALTER TABLE `users` ADD `deleted_at` text;
--> statement-breakpoint
ALTER TABLE `users` ADD `email_verified_at` text;
--> statement-breakpoint
ALTER TABLE `users` ADD `avatar_url` text;
--> statement-breakpoint
ALTER TABLE `users` ADD `last_login_at` text;
--> statement-breakpoint
UPDATE `users` SET `normalized_email` = lower(trim(`email`)) WHERE `email` IS NOT NULL AND trim(`email`) <> '';
--> statement-breakpoint
CREATE UNIQUE INDEX `users_normalized_email_unique` ON `users` (`normalized_email`);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_auth_subject_hash_unique` ON `users` (`auth_subject_hash`);
--> statement-breakpoint
CREATE TABLE `sessions` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `token_hash` text NOT NULL,
  `expires_at` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `last_used_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `user_agent` text,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_unique` ON `sessions` (`token_hash`);
--> statement-breakpoint
CREATE INDEX `sessions_user_expires_idx` ON `sessions` (`user_id`,`expires_at`);
--> statement-breakpoint
CREATE INDEX `sessions_expires_idx` ON `sessions` (`expires_at`);
--> statement-breakpoint
INSERT INTO `sessions` (`id`, `user_id`, `token_hash`, `expires_at`, `created_at`, `last_used_at`)
SELECT
  'legacy_' || `id`,
  `id`,
  `guest_token_hash`,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+30 days'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `users`
WHERE `auth_type` <> 'guest' AND `guest_token_hash` IS NOT NULL;
--> statement-breakpoint
UPDATE `users` SET `guest_token_hash` = NULL WHERE `auth_type` <> 'guest' AND `guest_token_hash` IS NOT NULL;
--> statement-breakpoint
CREATE TABLE `profiles` (
  `user_id` text PRIMARY KEY NOT NULL,
  `display_name` text NOT NULL,
  `handle` text NOT NULL,
  `bio` text DEFAULT '' NOT NULL,
  `avatar_url` text,
  `location` text,
  `joined_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_handle_unique` ON `profiles` (`handle`);
--> statement-breakpoint
CREATE TABLE `follows` (
  `follower_id` text NOT NULL,
  `following_id` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY (`follower_id`,`following_id`),
  CONSTRAINT `follows_no_self` CHECK (`follower_id` <> `following_id`),
  FOREIGN KEY (`follower_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`following_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `follows_following_created_idx` ON `follows` (`following_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `follows_follower_created_idx` ON `follows` (`follower_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `likes` (
  `user_id` text NOT NULL,
  `dish_id` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY (`user_id`,`dish_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`dish_id`) REFERENCES `published_dishes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `likes_dish_created_idx` ON `likes` (`dish_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `likes_user_created_idx` ON `likes` (`user_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `comments` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `dish_id` text NOT NULL,
  `body` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`dish_id`) REFERENCES `published_dishes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `comments_dish_created_idx` ON `comments` (`dish_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `comments_user_created_idx` ON `comments` (`user_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `notifications` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `actor_id` text,
  `type` text NOT NULL,
  `target_id` text,
  `dedupe_key` text NOT NULL,
  `read` integer DEFAULT false NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notifications_dedupe_unique` ON `notifications` (`dedupe_key`);
--> statement-breakpoint
CREATE INDEX `notifications_user_unread_idx` ON `notifications` (`user_id`,`read`,`created_at`);
--> statement-breakpoint
CREATE INDEX `notifications_user_recent_idx` ON `notifications` (`user_id`,`created_at`);
