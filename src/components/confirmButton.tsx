import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ParentComponent } from "solid-js";

type ConfirmButtonProps = {
  title: string;
  description: string;
  actionText?: string;
  closeText?: string;
  onConfirm: () => void;
};

export const ConfirmButton: ParentComponent<ConfirmButtonProps> = (props) => {
  return (
    <AlertDialog>
      <AlertDialogTrigger>{props.children}</AlertDialogTrigger>
      <AlertDialogContent class="bg-background">
        <AlertDialogHeader>
          <AlertDialogTitle>{props.title}</AlertDialogTitle>
          <AlertDialogDescription>{props.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={() => props.onConfirm()}>
            {props.actionText || "Confirm"}
          </AlertDialogAction>
          <AlertDialogClose class="m-0">
            {props.closeText || "Cancel"}
          </AlertDialogClose>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
