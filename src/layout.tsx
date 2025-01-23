import { ParentComponent } from "solid-js";
import { NavBar } from "./components/navbar";

export const AppLayout: ParentComponent = (props) => {
  return (
    <div class="h-[100dvh] w-full flex flex-col justify-between">
      {props.children}
      <NavBar class="grow-0 w-full"/>
    </div>
  );
};
