ALTER TABLE `app_preferences`
ADD `deferred_cycle_setup` integer DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE `app_preferences`
ADD `deferred_tracking_setup` integer DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE `app_preferences`
ADD `dismissed_tailoring_checklist` integer DEFAULT false NOT NULL;
