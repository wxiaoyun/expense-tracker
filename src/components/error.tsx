import { Component } from "solid-js";

// TODO: Implement ErrorComponent
export const ErrorComponent: Component<Error> = (props) => {
  return <div>Error: {props?.message}</div>;
}