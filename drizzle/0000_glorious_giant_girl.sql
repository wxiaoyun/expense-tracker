CREATE TABLE `recurring_transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`amount` real NOT NULL,
	`description` text,
	`category` text NOT NULL,
	`start_date` integer NOT NULL,
	`last_charged` integer,
	`recurrence_value` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_recurring_transactions_date` ON `recurring_transactions` (`start_date`);--> statement-breakpoint
CREATE INDEX `idx_recurring_transactions_category` ON `recurring_transactions` (`category`);--> statement-breakpoint
CREATE INDEX `idx_recurring_transactions_last_charged` ON `recurring_transactions` (`last_charged`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `settings_key_unique` ON `settings` (`key`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`amount` real NOT NULL,
	`transaction_date` integer NOT NULL,
	`description` text,
	`category` text NOT NULL,
	`recurring_transaction_id` integer,
	`verified` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_transactions_date` ON `transactions` (`transaction_date`);--> statement-breakpoint
CREATE INDEX `idx_transactions_category` ON `transactions` (`category`);--> statement-breakpoint
CREATE INDEX `idx_transactions_recurring` ON `transactions` (`recurring_transaction_id`);--> statement-breakpoint
CREATE INDEX `idx_transactions_verified` ON `transactions` (`verified`);