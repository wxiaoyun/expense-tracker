import { recurringTransactions, transactions } from "@/db";
import { RecurringTransaction } from "@/db/recurring_transactions";
import { Transaction } from "@/db/transactions";

const categories = [
  "Groceries",
  "Restaurants",
  "Transportation",
  "Entertainment",
  "Shopping",
  "Utilities",
  "Rent",
  "Salary",
  "Investment",
  "Healthcare",
];

const descriptions = {
  Groceries: ["Walmart", "Trader Joe's", "Whole Foods", "Costco", "Safeway"],
  Restaurants: [
    "McDonald's",
    "Chipotle",
    "Local Restaurant",
    "Coffee Shop",
    "Pizza",
  ],
  Transportation: ["Gas", "Bus Fare", "Uber", "Car Maintenance", "Parking"],
  Entertainment: ["Movies", "Netflix", "Concert", "Video Games", "Books"],
  Shopping: ["Amazon", "Target", "Best Buy", "Clothing", "Electronics"],
  Utilities: ["Electricity", "Water", "Internet", "Phone Bill", "Gas Bill"],
  Rent: ["Monthly Rent", "Security Deposit"],
  Salary: ["Monthly Salary", "Bonus", "Overtime"],
  Investment: ["Stock Purchase", "Dividend", "Crypto", "ETF"],
  Healthcare: ["Doctor Visit", "Pharmacy", "Insurance", "Dental"],
};

const randomInteger = (min: number = 0, max: number = 100) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const randomDate = (start: Date, end: Date) => {
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime()),
  );
};

const randomAmount = (category: string) => {
  // Income categories have positive amounts
  const isIncome = ["Salary", "Investment"].includes(category);

  const ranges = {
    Groceries: [30, 200],
    Restaurants: [15, 100],
    Transportation: [10, 150],
    Entertainment: [10, 100],
    Shopping: [20, 300],
    Utilities: [50, 200],
    Rent: [800, 2500],
    Salary: [3000, 8000],
    Investment: [100, 1000],
    Healthcare: [20, 500],
  };

  const [min, max] = ranges[category as keyof typeof ranges];
  const amount = min + Math.random() * (max - min);
  return isIncome ? amount : -amount;
};

export const generateTransactions = async (numTransactions: number) => {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 3); // Last 3 months of data

  const recurringTransactionIds = (await recurringTransactions.list()).map(
    (t) => t.id,
  );

  const transactionList: BeforeCreate<Transaction>[] = [];
  for (let i = 0; i < numTransactions; i++) {
    const category = categories[Math.floor(Math.random() * categories.length)];
    const descList = descriptions[category as keyof typeof descriptions];
    const description = descList[Math.floor(Math.random() * descList.length)];
    const recurringTransactionId =
      recurringTransactionIds[
        Math.floor(Math.random() * recurringTransactionIds.length)
      ];

    transactionList.push({
      amount: randomAmount(category),
      transaction_date: randomDate(startDate, endDate).getTime(),
      category,
      description,
      recurring_transaction_id: recurringTransactionId,
    });
  }

  await transactions.batchCreate(transactionList);
};

const randomRecurrenceValue = () => {
  const cron = [
    0,
    0,
    0,
    randomInteger(1, 31),
    randomInteger(1, 12),
    randomInteger(0, 6),
  ];
  return cron.join(" ");
};

export const generateRecurringTransactions = async (
  numTransactions: number,
) => {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 3);

  const recurringTransactionList: BeforeCreate<RecurringTransaction>[] = [];
  for (let i = 0; i < numTransactions; i++) {
    const category = categories[Math.floor(Math.random() * categories.length)];
    const descList = descriptions[category as keyof typeof descriptions];
    const description = descList[Math.floor(Math.random() * descList.length)];
    const recurrenceValue = randomRecurrenceValue();

    recurringTransactionList.push({
      amount: randomAmount(category),
      category,
      description,
      start_date: randomDate(startDate, endDate).getTime(),
      recurrence_value: recurrenceValue,
    });
  }

  await recurringTransactions.batchCreate(recurringTransactionList);
};
