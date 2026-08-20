CREATE TABLE `review_prompt_state` (
	`id` text PRIMARY KEY NOT NULL,
	`onboarding_completed_at` text,
	`automatic_prompt_count` integer DEFAULT 0 NOT NULL,
	`last_automatic_prompt_at` text,
	`suppress_automatic_prompts` integer DEFAULT false NOT NULL,
	`last_manual_store_open_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `review_prompt_save_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`log_date` text NOT NULL,
	`saved_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `review_prompt_save_events_saved_at_idx` ON `review_prompt_save_events` (`saved_at`);
--> statement-breakpoint
INSERT OR IGNORE INTO `review_prompt_state` (
  `id`,
  `onboarding_completed_at`,
  `automatic_prompt_count`,
  `last_automatic_prompt_at`,
  `suppress_automatic_prompts`,
  `last_manual_store_open_at`
) VALUES (
  'review-prompt-state',
  NULL,
  0,
  NULL,
  false,
  NULL
);
