UPDATE `reminder_preferences`
SET `enabled` = 0;
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
) VALUES (
	'reminder-fertile-window',
	'fertile-window',
	0,
	9,
	0,
	'cycle-event',
	1,
	2
);
