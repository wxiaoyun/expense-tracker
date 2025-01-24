# Architecture

## Frontend

- Solidjs
- TailwindCSS

### Overal Layout

- Main Body
- Footer + Navbar
  - 4 tabs: Transactions, Recurring Transactions, Stats, Settings

### Pages

- Transactions
  - `/` and `/transactions` Overview of all transactions
    - Top bar
      - Button to navigate to new transaction page
      - Date range selector (daily, weekly, monthly, yearly)
      - Search bar (frontend fuzzy search)
    - Buttons to shift date range
    - Range summary (expense, income, balance)
    - Table of transactions (scrollable)
      - List of transaction cards
        - Top row
          - Transaction date
          - Transaction amount
          - Edit button
        - Buttom row
          - Transaction description
          - Transaction category
          - Transaction recurring transaction badge
  - `/transactions/new` Create a new transaction
    - Top bar
      - Button to return to the previous page
    - Form: new transaction
      - Date
      - Amount
      - Description
      - Category
      - Recurring transaction
  - `/transactions/edit/:id` Edit a transaction
    - Top bar
      - Button to return to the previous page. Need alert to ask to confirm exit
    - Form
      - Date
      - Amount
      - Description
      - Category
      - Recurring transaction (not editable)
- Recurring Transactions
  - `/recurring_transactions` Overview of all recurring transactions
    - Top bar
      - Button to navigate to new recurring transaction page
      - Search bar (frontend fuzzy search)
    - Table of recurring transactions (scrollable)
      - List of recurring transaction cards
        - Top row
          - Recurring transaction date
          - Recurring transaction amount
          - Edit button
        - Middle row
          - Total amount under the recurring transaction id
          - start date
          - end date
          - interval
        - Buttom row
          - Description
          - Category
  - `/recurring_transactions/new` Create a new recurring transaction
    - Form: new recurring transaction
      - amount
      - description
      - category
      - start date
      - end date
      - interval
  - `/recurring_transactions/edit/:id` Edit a recurring transaction
    - Form: edit recurring transaction
      - Amount
      - Description
      - Category
      - end date
      - interval
- Stats
  - `/stats` Overview of all stats
- Settings
  - `/settings` Overview of all settings

### State management

- Tanstack Query
- Signals

## Database

- SQLite

### Table Schemas

```sql
CREATE TABLE IF NOT EXISTS recurring_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    amount REAL NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    start_date INTEGER NOT NULL,
    end_date INTEGER,
    interval INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
);

CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    amount REAL NOT NULL,
    transaction_date INTEGER NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    recurring_transaction_id INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (recurring_transaction_id) REFERENCES recurring_transactions(id)
);

CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
```
