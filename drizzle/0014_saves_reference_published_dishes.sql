CREATE TABLE `__new_saves` (
	`user_id` text NOT NULL,
	`dish_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`user_id`, `dish_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`dish_id`) REFERENCES `published_dishes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_saves` (`user_id`, `dish_id`, `created_at`)
SELECT `saves`.`user_id`, CAST(`saves`.`dish_id` AS text), `saves`.`created_at`
FROM `saves`
WHERE CAST(`saves`.`dish_id` AS text) IN (SELECT `id` FROM `published_dishes`);
--> statement-breakpoint
DROP TABLE `saves`;
--> statement-breakpoint
ALTER TABLE `__new_saves` RENAME TO `saves`;
--> statement-breakpoint
CREATE INDEX `saves_user_created_idx` ON `saves` (`user_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `saves_dish_idx` ON `saves` (`dish_id`);
