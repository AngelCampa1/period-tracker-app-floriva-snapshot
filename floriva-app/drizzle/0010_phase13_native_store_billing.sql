PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_billing_snapshot` (
	`id` text PRIMARY KEY NOT NULL,
	`access_state` text NOT NULL,
	`plan_id` text,
	`trial_ends_at` text,
	`first_charge_at` text,
	`expires_at` text,
	`last_synced_at` text,
	`reminder_scheduled_for` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_billing_snapshot` (
  `id`,
  `access_state`,
  `plan_id`,
  `trial_ends_at`,
  `first_charge_at`,
  `expires_at`,
  `last_synced_at`,
  `reminder_scheduled_for`,
  `created_at`,
  `updated_at`
)
SELECT
  `id`,
  `access_state`,
  `plan_id`,
  `trial_ends_at`,
  `first_charge_at`,
  `expires_at`,
  `last_synced_at`,
  `reminder_scheduled_for`,
  `created_at`,
  `updated_at`
FROM `billing_snapshot`;
--> statement-breakpoint
DROP TABLE `billing_snapshot`;
--> statement-breakpoint
ALTER TABLE `__new_billing_snapshot` RENAME TO `billing_snapshot`;
--> statement-breakpoint
INSERT INTO `billing_snapshot` (
  `id`,
  `access_state`,
  `plan_id`,
  `trial_ends_at`,
  `first_charge_at`,
  `expires_at`,
  `last_synced_at`,
  `reminder_scheduled_for`
)
VALUES (
  'billing-snapshot',
  'needs_purchase',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL
)
ON CONFLICT(`id`) DO NOTHING;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
