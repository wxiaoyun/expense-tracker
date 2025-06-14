import { useThemeColor } from "@/hooks/useThemeColor";
import Feather from "@expo/vector-icons/Feather";
import * as Haptics from "expo-haptics";
import { useCallback, useState } from "react";
import { Modal, TouchableOpacity, View } from "react-native";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuItemIcon,
  DropdownMenuItemTitle,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from "../DropdownMenu";
import { ThemedText } from "../ThemedText";

type CreateTransactionProps = {
  isModalVisible: boolean;
  setIsModalVisible: (isModalVisible: boolean) => void;
};

const CreateTransaction = ({
  isModalVisible,
  setIsModalVisible,
}: CreateTransactionProps) => {
  return (
    <Modal
      visible={isModalVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        setIsModalVisible(false);
      }}
    >
      <View>
        <ThemedText>Create</ThemedText>
      </View>
    </Modal>
  );
};

type TransactionOperationsProps = {
  onOpenFilter: () => void;
};

export const TransactionOperations = ({
  onOpenFilter,
}: TransactionOperationsProps) => {
  const textColor = useThemeColor("text");
  const [isModalVisible, setIsModalVisible] = useState(false);

  const handleDownloadTransactions = useCallback(() => {
    console.log("Downloading transactions...");
  }, []);

  return (
    <>
      <DropdownMenuRoot>
        <DropdownMenuTrigger>
          <TouchableOpacity onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}>
            <Feather name="more-horizontal" size={24} color={textColor} />
          </TouchableOpacity>
        </DropdownMenuTrigger>

        <DropdownMenuContent>
          <DropdownMenuItem
            key="add-transaction"
            onSelect={() => setIsModalVisible(true)}
          >
            <DropdownMenuItemIcon
              ios={{
                name: "plus.circle.fill",
                pointSize: 16,
                weight: "medium",
                scale: "medium",
              }}
            />
            <DropdownMenuItemTitle>Add new transaction</DropdownMenuItemTitle>
          </DropdownMenuItem>

          <DropdownMenuItem key="filter-transactions" onSelect={onOpenFilter}>
            <DropdownMenuItemIcon
              ios={{
                name: "line.3.horizontal.decrease.circle",
                pointSize: 16,
                weight: "medium",
                scale: "medium",
              }}
            />
            <DropdownMenuItemTitle>Filter transactions</DropdownMenuItemTitle>
          </DropdownMenuItem>

          <DropdownMenuItem
            key="download-transactions"
            onSelect={handleDownloadTransactions}
          >
            <DropdownMenuItemIcon
              ios={{
                name: "arrow.down.circle.fill",
                pointSize: 16,
                weight: "medium",
                scale: "medium",
              }}
            />
            <DropdownMenuItemTitle>Download transactions</DropdownMenuItemTitle>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenuRoot>

      <CreateTransaction
        isModalVisible={isModalVisible}
        setIsModalVisible={setIsModalVisible}
      />
    </>
  );
};
