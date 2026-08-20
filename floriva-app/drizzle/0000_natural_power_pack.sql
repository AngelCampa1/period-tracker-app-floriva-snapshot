PRAGMA foreign_keys = ON;
--> statement-breakpoint
CREATE TABLE `app_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`has_completed_onboarding` integer NOT NULL,
	`deferred_biometrics_setup` integer NOT NULL,
	`deferred_reminder_setup` integer NOT NULL,
	`deferred_import_setup` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `birth_control_events` (
	`id` text PRIMARY KEY NOT NULL,
	`daily_log_id` text NOT NULL,
	`method` text NOT NULL,
	`missed_dose` integer,
	`late_dose` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`daily_log_id`) REFERENCES `daily_logs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `birth_control_events_daily_log_unique` ON `birth_control_events` (`daily_log_id`);--> statement-breakpoint
CREATE TABLE `daily_log_symptoms` (
	`id` text PRIMARY KEY NOT NULL,
	`daily_log_id` text NOT NULL,
	`symptom_key` text NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`daily_log_id`) REFERENCES `daily_logs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_log_symptoms_daily_log_symptom_unique` ON `daily_log_symptoms` (`daily_log_id`,`symptom_key`);--> statement-breakpoint
CREATE TABLE `daily_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`log_date` text NOT NULL,
	`bleeding` text NOT NULL,
	`mood` text,
	`notes` text,
	`import_session_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`import_session_id`) REFERENCES `import_sessions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_logs_log_date_unique` ON `daily_logs` (`log_date`);--> statement-breakpoint
CREATE INDEX `daily_logs_import_session_idx` ON `daily_logs` (`import_session_id`);--> statement-breakpoint
CREATE TABLE `import_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`status` text NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`imported_log_count` integer NOT NULL,
	`skipped_log_count` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `privacy_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`biometrics_enabled` integer NOT NULL,
	`relock_after_seconds` integer NOT NULL,
	`destructive_action_confirmation_required` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reminder_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`enabled` integer NOT NULL,
	`hour` integer NOT NULL,
	`minute` integer NOT NULL,
	`schedule_cadence` text NOT NULL,
	`schedule_days_before` integer,
	`sort_order` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reminder_preferences_kind_unique` ON `reminder_preferences` (`kind`);--> statement-breakpoint
CREATE TABLE `ttc_observations` (
	`id` text PRIMARY KEY NOT NULL,
	`daily_log_id` text NOT NULL,
	`cervical_mucus` text,
	`ovulation_test` text,
	`basal_body_temperature_celsius` real,
	`sex_logged` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`daily_log_id`) REFERENCES `daily_logs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ttc_observations_daily_log_unique` ON `ttc_observations` (`daily_log_id`);--> statement-breakpoint
CREATE TABLE `user_profile_conditions` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`condition_key` text NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `user_profile`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_profile_conditions_profile_condition_unique` ON `user_profile_conditions` (`profile_id`,`condition_key`);--> statement-breakpoint
CREATE TABLE `user_profile_goals` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`goal` text NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `user_profile`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_profile_goals_profile_goal_unique` ON `user_profile_goals` (`profile_id`,`goal`);--> statement-breakpoint
CREATE TABLE `user_profile` (
	`id` text PRIMARY KEY NOT NULL,
	`cycle_length_days` integer,
	`period_length_days` integer,
	`supports_irregular_cycles` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT OR IGNORE INTO `app_preferences` (
	`id`,
	`has_completed_onboarding`,
	`deferred_biometrics_setup`,
	`deferred_reminder_setup`,
	`deferred_import_setup`
) VALUES (
	'app-preferences',
	0,
	0,
	0,
	0
);
--> statement-breakpoint
INSERT OR IGNORE INTO `privacy_preferences` (
	`id`,
	`biometrics_enabled`,
	`relock_after_seconds`,
	`destructive_action_confirmation_required`
) VALUES (
	'privacy-preferences',
	0,
	60,
	1
);
--> statement-breakpoint
INSERT OR IGNORE INTO `reminder_preferences` (
	`id`,
	`kind`,
	`enabled`,
	`hour`,
	`minute`,
	`schedule_cadence`,
	`schedule_days_before`,
	`sort_order`
) VALUES
(
	'reminder-daily-log',
	'daily-log',
	1,
	20,
	0,
	'daily',
	NULL,
	0
),
(
	'reminder-period-start',
	'period-start',
	1,
	9,
	0,
	'cycle-event',
	0,
	1
);
