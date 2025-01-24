import { useSearchParams } from "@solidjs/router";
import { createMemo } from "solid-js";

export const useTransactionParams = (prefix = "") => {
  const [searchParams] = useSearchParams();

  const amount = createMemo(
    () => (searchParams[`${prefix}amount`] as string) || "",
  );
  const date = createMemo(() => {
    const date = searchParams[`${prefix}date`] as string;
    if (!date) {
      return new Date();
    }
    return new Date(date);
  });
  const description = createMemo(
    () => (searchParams[`${prefix}description`] as string) || "",
  );
  const category = createMemo(
    () => (searchParams[`${prefix}category`] as string) || "",
  );

  return {
    amount,
    date,
    description,
    category,
  };
};
