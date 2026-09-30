CREATE TABLE `carpool_members` (
	`carpool_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'parent' NOT NULL,
	PRIMARY KEY(`carpool_id`, `email`),
	FOREIGN KEY (`carpool_id`) REFERENCES `carpools`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "carpool_members_role_check" CHECK(role in ('admin', 'parent'))
);
--> statement-breakpoint
CREATE INDEX `carpool_members_email_idx` ON `carpool_members` (`email`);--> statement-breakpoint
CREATE TABLE `carpools` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`school` text DEFAULT '' NOT NULL,
	`rehearsal_note` text DEFAULT '' NOT NULL,
	`dropoff_note` text DEFAULT '' NOT NULL,
	`pickup_note` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `drivers` (
	`id` text PRIMARY KEY NOT NULL,
	`rehearsal_id` text NOT NULL,
	`leg` text NOT NULL,
	`user_id` text NOT NULL,
	`seats` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`rehearsal_id`) REFERENCES `rehearsals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "drivers_leg_check" CHECK(leg in ('dropoff', 'pickup')),
	CONSTRAINT "drivers_seats_check" CHECK(seats between 1 and 8)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `drivers_rehearsal_leg_user_unique` ON `drivers` (`rehearsal_id`,`leg`,`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `drivers_id_rehearsal_leg_unique` ON `drivers` (`id`,`rehearsal_id`,`leg`);--> statement-breakpoint
CREATE TABLE `important_dates` (
	`id` text PRIMARY KEY NOT NULL,
	`carpool_id` text NOT NULL,
	`date` text NOT NULL,
	`title` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`carpool_id`) REFERENCES `carpools`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "important_dates_date_check" CHECK(date glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
);
--> statement-breakpoint
CREATE INDEX `important_dates_carpool_date_idx` ON `important_dates` (`carpool_id`,`date`);--> statement-breakpoint
CREATE TABLE `kid_guardians` (
	`kid_id` text NOT NULL,
	`carpool_id` text NOT NULL,
	`email` text NOT NULL,
	PRIMARY KEY(`kid_id`, `email`),
	FOREIGN KEY (`kid_id`,`carpool_id`) REFERENCES `kids`(`id`,`carpool_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`carpool_id`,`email`) REFERENCES `carpool_members`(`carpool_id`,`email`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `kid_guardians_email_idx` ON `kid_guardians` (`email`);--> statement-breakpoint
CREATE TABLE `kids` (
	`id` text PRIMARY KEY NOT NULL,
	`carpool_id` text NOT NULL,
	`name` text NOT NULL,
	FOREIGN KEY (`carpool_id`) REFERENCES `carpools`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `kids_carpool_idx` ON `kids` (`carpool_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `kids_id_carpool_unique` ON `kids` (`id`,`carpool_id`);--> statement-breakpoint
CREATE TABLE `need_overrides` (
	`kid_id` text NOT NULL,
	`rehearsal_id` text NOT NULL,
	`need` text NOT NULL,
	PRIMARY KEY(`kid_id`, `rehearsal_id`),
	FOREIGN KEY (`kid_id`) REFERENCES `kids`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`rehearsal_id`) REFERENCES `rehearsals`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "need_overrides_need_check" CHECK(need in ('both', 'dropoff', 'pickup', 'none'))
);
--> statement-breakpoint
CREATE TABLE `rehearsals` (
	`id` text PRIMARY KEY NOT NULL,
	`carpool_id` text NOT NULL,
	`date` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	FOREIGN KEY (`carpool_id`) REFERENCES `carpools`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "rehearsals_date_check" CHECK(date glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "rehearsals_status_check" CHECK(status in ('scheduled', 'needs_confirmation', 'cancelled'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rehearsals_carpool_date_unique` ON `rehearsals` (`carpool_id`,`date`);--> statement-breakpoint
CREATE TABLE `ride_assignments` (
	`driver_id` text NOT NULL,
	`rehearsal_id` text NOT NULL,
	`leg` text NOT NULL,
	`kid_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`driver_id`, `kid_id`),
	FOREIGN KEY (`kid_id`) REFERENCES `kids`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`driver_id`,`rehearsal_id`,`leg`) REFERENCES `drivers`(`id`,`rehearsal_id`,`leg`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ride_assignments_one_car_per_leg` ON `ride_assignments` (`rehearsal_id`,`leg`,`kid_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`email` text NOT NULL,
	`emailVerified` integer,
	`image` text,
	`phone` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `usual_needs` (
	`kid_id` text NOT NULL,
	`weekday` integer NOT NULL,
	`need` text NOT NULL,
	PRIMARY KEY(`kid_id`, `weekday`),
	FOREIGN KEY (`kid_id`) REFERENCES `kids`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "usual_needs_weekday_check" CHECK(weekday between 0 and 6),
	CONSTRAINT "usual_needs_need_check" CHECK(need in ('both', 'dropoff', 'pickup', 'none'))
);
