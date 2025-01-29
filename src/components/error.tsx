import { Component } from "solid-js";

export const ErrorComponent: Component<Error> = (props) => {
  console.error(props);
  return (
    <main class="flex flex-col items-center justify-center h-[100dvh]">
      <h1 class="text-4xl font-bold">Oops</h1>
      <p class="text-lg">Something went wrong</p>
      <p class="text-md">Error: {props?.message}</p>
    </main>
  );
};
