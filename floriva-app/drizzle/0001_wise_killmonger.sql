ALTER TABLE `user_profile` ADD `last_period_start_date` text;
--> statement-breakpoint
UPDATE `user_profile`
SET `last_period_start_date` = (
  WITH RECURSIVE `latest_period_day`(`log_date`) AS (
    SELECT `log_date`
    FROM `daily_logs`
    WHERE `bleeding` IN ('light', 'medium', 'heavy')
    ORDER BY `log_date` DESC
    LIMIT 1
  ),
  `contiguous_period_days`(`log_date`) AS (
    SELECT `log_date`
    FROM `latest_period_day`

    UNION ALL

    SELECT `daily_logs`.`log_date`
    FROM `daily_logs`
    INNER JOIN `contiguous_period_days`
      ON `daily_logs`.`log_date` = date(`contiguous_period_days`.`log_date`, '-1 day')
    WHERE `daily_logs`.`bleeding` IN ('light', 'medium', 'heavy')
  )
  SELECT MIN(`log_date`)
  FROM `contiguous_period_days`
)
WHERE `last_period_start_date` IS NULL;
