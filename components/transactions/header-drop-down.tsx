import Feather from "@expo/vector-icons/Feather";
import * as Haptics from "expo-haptics";
import { useCallback } from "react";
import { TouchableOpacity } from "react-native";

import { useCategoryFilter, useDateRange, useVerifiedFilter } from "@/hooks/useFilter";
import { useThemeColor } from "@/hooks/useThemeColor";
import { showAlert } from "@/libs/dialog";
import { exportCsvFromTransactions } from "@/libs/fs";
import { useRouter } from "expo-router";
import { toast } from "sonner-native";
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

  // Get current filter states
  const { dateRange } = useDateRange();
  const [selectedCategories] = useCategoryFilter();
  const [verifiedFilter] = useVerifiedFilter();

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

  const onClickDownload = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    try {
      console.log("Downloading filtered transactions...");
      
      // Prepare filter options for CSV export
      const exportOptions = {
        start: dateRange.start,
        end: dateRange.end,
        categories: selectedCategories.length > 0 ? selectedCategories : undefined,
        verified: verifiedFilter !== null ? (verifiedFilter ? 1 : 0) : undefined,
      };

      console.log("Export options:", exportOptions);

      await exportCsvFromTransactions(
        exportOptions,
        (msg) => {
          console.log("CSV export success:", msg);
          toast.success(msg);
        },
        (errMsg) => {
          console.error("CSV export error:", errMsg);
          showAlert("Error", errMsg, { kind: "error" });
        }
      );
    } catch (error) {
      console.error("Failed to download transactions:", error);
      showAlert("Error", "Failed to download transactions", { kind: "error" });
    }
  }, [dateRange, selectedCategories, verifiedFilter]);

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
