import React from "react";
import { AppState, type AppStateStatus } from "react-native";
import { act, cleanup, renderHook } from "@testing-library/react-native";
import { createStore, Provider } from "jotai";

import {
  computeDateRange,
  dateRangeAtom,
  useDateRange,
  type DateRangePreset,
} from "../useFilter";

let store: ReturnType<typeof createStore>;
let changeAppState: (state: AppStateStatus) => void;
const removeListener = jest.fn();
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <Provider store={store}>{children}</Provider>
);
const previousDay = new Date(2026, 8, 30, 12);
const today = new Date(2026, 9, 3, 12);

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(previousDay);
  store = createStore();
  jest.spyOn(AppState, "addEventListener").mockImplementation((_, listener) => {
    changeAppState = listener;
    return { remove: removeListener };
  });
});

afterEach(async () => {
  await cleanup();
  jest.useRealTimers();
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

it.each<DateRangePreset>(["all", "7d", "30d", "365d", "monthly", "weekly"])(
  "refreshes %s for Expenses and Summary when returning from background on a later day",
  async (preset) => {
    store.set(dateRangeAtom, {
      preset,
      ...computeDateRange(preset, previousDay),
    });
    const { result, unmount } = await renderHook(
      () => ({ expenses: useDateRange()[0], summary: useDateRange()[0] }),
      { wrapper },
    );

    await act(async () => {
      changeAppState("background");
      jest.setSystemTime(today);
      changeAppState("active");
    });

    const expected = { preset, ...computeDateRange(preset, today) };
    expect(result.current.expenses).toEqual(expected);
    expect(result.current.summary).toEqual(expected);
    expect(result.current.expenses.end.getTime()).toBeGreaterThan(Date.now());
    expect(AppState.addEventListener).toHaveBeenCalledTimes(1);
    await unmount();
    expect(removeListener).toHaveBeenCalledTimes(1);
    await act(async () => {
      jest.advanceTimersByTime(24 * 60 * 60 * 1000);
    });
    expect(store.get(dateRangeAtom)).toEqual(expected);
  },
);

it("refreshes a preset first mounted after the app launch day", async () => {
  store.set(dateRangeAtom, {
    preset: "all",
    ...computeDateRange("all", previousDay),
  });
  jest.setSystemTime(today);

  const { result } = await renderHook(useDateRange, { wrapper });

  expect(result.current[0]).toEqual({
    preset: "all",
    ...computeDateRange("all", today),
  });
});

it("advances the range at midnight while the app stays active", async () => {
  const beforeMidnight = new Date(2026, 8, 30, 23, 59);
  jest.setSystemTime(beforeMidnight);
  store.set(dateRangeAtom, {
    preset: "monthly",
    ...computeDateRange("monthly", beforeMidnight),
  });
  const { result } = await renderHook(useDateRange, { wrapper });

  await act(async () => {
    jest.advanceTimersByTime(60_000);
  });

  expect(result.current[0]).toEqual({
    preset: "monthly",
    ...computeDateRange("monthly", new Date()),
  });
});

it("preserves custom ranges when returning from background", async () => {
  const range = {
    preset: "custom" as const,
    start: new Date(2025, 0, 1),
    end: new Date(2025, 0, 31),
    customStart: new Date(2025, 0, 1),
    customEnd: new Date(2025, 0, 31),
  };
  store.set(dateRangeAtom, range);
  const { result } = await renderHook(useDateRange, { wrapper });

  await act(async () => {
    jest.setSystemTime(today);
    changeAppState("active");
  });

  expect(result.current[0]).toBe(range);
});
