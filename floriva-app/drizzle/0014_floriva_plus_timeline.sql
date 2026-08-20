CREATE TABLE `backup_events` (
  `id` text PRIMARY KEY NOT NULL,
  `action` text NOT NULL,
  `occurred_at` text NOT NULL,
  `detail` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `backup_events_occurred_at_idx` ON `backup_events` (`occurred_at`);
