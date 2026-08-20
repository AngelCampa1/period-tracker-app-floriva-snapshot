ALTER TABLE `privacy_preferences`
ADD `diagnostics_consent_enabled` integer DEFAULT false NOT NULL;
--> statement-breakpoint
INSERT INTO `reminder_preferences` (
  `id`,
  `kind`,
  `enabled`,
  `hour`,
  `minute`,
  `schedule_cadence`,
  `schedule_days_before`,
  `sort_order`
)
VALUES (
  'reminder-birth-control',
  'birth-control',
  false,
  8,
  0,
  'daily',
  NULL,
  3
)
ON CONFLICT(`kind`) DO NOTHING;
