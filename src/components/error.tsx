import { useNavigate } from "@solidjs/router";
import { Component } from "solid-js";
import { Button } from "./ui/button";

export const ErrorComponent: Component<Error> = (props) => {
  const navigate = useNavigate();
  console.error(props);
  return (
    <main class="flex flex-col items-center justify-center h-[100dvh]">
      <h1 class="text-4xl font-bold">Oops</h1>
      <p class="text-lg">Something went wrong</p>
      <p class="text-md">Error: {props?.message}</p>
      <Button onClick={() => navigate("/")}>Go to home</Button>
    </main>
  );
};
