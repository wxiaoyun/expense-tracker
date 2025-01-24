import { transactions } from "@/db";

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

  for (let i = 0; i < numTransactions; i++) {
    const category = categories[Math.floor(Math.random() * categories.length)];
    const descList = descriptions[category as keyof typeof descriptions];
    const description = descList[Math.floor(Math.random() * descList.length)];

    await transactions.create({
      amount: randomAmount(category),
      transaction_date: randomDate(startDate, endDate).getTime(),
      category,
      description,
    });
  }
};
