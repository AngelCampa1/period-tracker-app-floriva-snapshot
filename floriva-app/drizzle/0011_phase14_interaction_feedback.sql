ALTER TABLE `app_preferences`
ADD `haptics_enabled` integer DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE `app_preferences`
ADD `tap_sound_enabled` integer DEFAULT false NOT NULL;
