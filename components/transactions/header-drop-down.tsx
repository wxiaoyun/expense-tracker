import Feather from "@expo/vector-icons/Feather";
import * as Haptics from "expo-haptics";
import { useCallback } from "react";
import { TouchableOpacity } from "react-native";

import { useThemeColor } from "@/hooks/useThemeColor";
import { useRouter } from "expo-router";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuItemIcon,
  DropdownMenuItemTitle,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from "../DropdownMenu";


export const TransactionDropdown = () => {
  const router = useRouter();
  const textColor = useThemeColor("text");

  const handleClickTrigger = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const onClickAdd = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/(transactions)/new");
  }, [router]);

  const onClickFilter = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/(transactions)/filter");
  }, [router]);

  // TODO
  const onClickDownload = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    console.log("Downloading transactions...");
  }, []);

  return (
    <DropdownMenuRoot>
      <DropdownMenuTrigger>
        <TouchableOpacity onPress={handleClickTrigger}>
          <Feather name="more-horizontal" size={24} color={textColor} />
        </TouchableOpacity>
      </DropdownMenuTrigger>

      <DropdownMenuContent>
        <DropdownMenuItem key="add-transaction" onSelect={onClickAdd}>
          <DropdownMenuItemIcon
            ios={{
              name: "plus",
              pointSize: 16,
              weight: "medium",
              scale: "medium",
            }}
          />
          <DropdownMenuItemTitle>Add entry</DropdownMenuItemTitle>
        </DropdownMenuItem>

        <DropdownMenuItem key="filter-transactions" onSelect={onClickFilter}>
          <DropdownMenuItemIcon
            ios={{
              name: "line.3.horizontal.decrease",
              pointSize: 16,
              weight: "medium",
              scale: "medium",
            }}
          />
          <DropdownMenuItemTitle>Filter options</DropdownMenuItemTitle>
        </DropdownMenuItem>

        <DropdownMenuItem
          key="download-transactions"
          onSelect={onClickDownload}
        >
          <DropdownMenuItemIcon
            ios={{
              name: "arrow.down",
              pointSize: 16,
              weight: "medium",
              scale: "medium",
            }}
          />
          <DropdownMenuItemTitle>Download entries</DropdownMenuItemTitle>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuRoot>
  );
};
