export const YEAR = 365 * 24 * 60 * 60 * 1000;
export const MONTH = 30 * 24 * 60 * 60 * 1000;
export const DAY = 24 * 60 * 60 * 1000;
export const HOUR = 60 * 60 * 1000;
export const MINUTE = 60 * 1000;
export const SECOND = 1000;

export const IntervalToText = {
  [YEAR]: "yearly",
  [MONTH]: "monthly",
  [DAY]: "daily",
  [HOUR]: "hourly",
  [MINUTE]: "minutely",
  [SECOND]: "secondly",
};
