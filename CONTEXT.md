# Vibe Tracker

A personal expense tracker. Users record transactions, reuse templates to create them faster, and group spending by category.

## Language

### Transactions

**Transaction**:
A single money movement on a date, with an amount, description, and category. Either an expense or an income.
_Avoid_: Expense (when meaning both types), entry, record

**Transaction Type**:
Whether a transaction is an expense or an income.
_Avoid_: Direction, kind

**Verified**:
A flag the user sets to mark a transaction as checked against a real statement.
_Avoid_: Confirmed, reconciled

**Soft Delete**:
A transaction or template hidden from the user but kept in storage. Ignored by lists, summaries, and category usage.
_Avoid_: Archive, remove

**Source**:
Where a transaction came from: entered by the user, created by a schedule, or imported from a bank statement.
_Avoid_: Origin, provider, channel

**Imported Transaction**:
A transaction created from a bank statement file rather than typed by the user. Lands unverified. Importing the same statement rows again changes nothing.
_Avoid_: Synced transaction, bank transaction, fetched transaction

**Statement Import**:
Reading a bank statement file the user picks and creating an Imported Transaction for each row not already present.
_Avoid_: Sync, pull, fetch, upload

**Top-up**:
A statement row where money moves from the bank account into a wallet such as PayLah!. Treated as an expense because the wallet's own spending is not visible.
_Avoid_: Transfer, reload

### Categories

**Category**:
A label that groups transactions. Referenced by name. Either a Preset Category or a Custom Category.
_Avoid_: Tag, type, group

**Preset Category**:
A category shipped with the app, with its own icon, color, and sort order.
_Avoid_: Default category, built-in category

**Custom Category**:
A category name typed by the user that matches no Preset Category. Exists only because at least one transaction uses it.
_Avoid_: User category, ad-hoc category

**Category Picker**:
The form control for choosing a category: a free-text input above a chip list of all categories ordered by usage. Typing filters the chips fuzzily.
_Avoid_: Category chips, category selector

### Templates

**Template**:
Saved default values for creating a transaction. Has a unique name among non-deleted templates.
_Avoid_: Preset, recurring (when meaning a template with no schedule)

**Suggestion**:
A template draft the app proposes from repeated past transactions with the same description and category.
_Avoid_: Recommendation, autofill

**Schedule**:
The part of a template that creates transactions automatically on a recurrence. A template with a schedule is a Scheduled Template.
_Avoid_: Recurring, repeat, cron (when meaning the concept rather than the expression)

**Recurrence**:
The cron expression that defines when a schedule fires.
_Avoid_: Frequency, interval

**Schedule Cursor**:
The point in time up to which a schedule has already created transactions.
_Avoid_: Last run, checkpoint

**Backfill**:
Creating the transactions a schedule would have produced between its start date and now.
_Avoid_: Catch-up, replay

### Backup

**Backup**:
A copy of the whole database file, taken on a cadence or exported by the user, and restorable later.
_Avoid_: Export, snapshot, sync
