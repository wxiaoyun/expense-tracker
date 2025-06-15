PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_recurring_transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`amount` real NOT NULL,
	`description` text NOT NULL,
	`category` text NOT NULL,
	`start_date` integer NOT NULL,
	`last_charged` integer,
	`recurrence_value` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_recurring_transactions`("id", "amount", "description", "category", "start_date", "last_charged", "recurrence_value", "created_at", "updated_at") SELECT "id", "amount", "description", "category", "start_date", "last_charged", "recurrence_value", "created_at", "updated_at" FROM `recurring_transactions`;--> statement-breakpoint
DROP TABLE `recurring_transactions`;--> statement-breakpoint
ALTER TABLE `__new_recurring_transactions` RENAME TO `recurring_transactions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_recurring_transactions_date` ON `recurring_transactions` (`start_date`);--> statement-breakpoint
CREATE INDEX `idx_recurring_transactions_category` ON `recurring_transactions` (`category`);--> statement-breakpoint
CREATE INDEX `idx_recurring_transactions_last_charged` ON `recurring_transactions` (`last_charged`);--> statement-breakpoint
CREATE TABLE `__new_transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`amount` real NOT NULL,
	`transaction_date` integer NOT NULL,
	`description` text NOT NULL,
	`category` text NOT NULL,
	`recurring_transaction_id` integer,
	`verified` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_transactions`("id", "amount", "transaction_date", "description", "category", "recurring_transaction_id", "verified", "created_at", "updated_at") SELECT "id", "amount", "transaction_date", "description", "category", "recurring_transaction_id", "verified", "created_at", "updated_at" FROM `transactions`;--> statement-breakpoint
DROP TABLE `transactions`;--> statement-breakpoint
ALTER TABLE `__new_transactions` RENAME TO `transactions`;--> statement-breakpoint
CREATE INDEX `idx_transactions_date` ON `transactions` (`transaction_date`);--> statement-breakpoint
CREATE INDEX `idx_transactions_category` ON `transactions` (`category`);--> statement-breakpoint
CREATE INDEX `idx_transactions_recurring` ON `transactions` (`recurring_transaction_id`);--> statement-breakpoint
CREATE INDEX `idx_transactions_verified` ON `transactions` (`verified`);