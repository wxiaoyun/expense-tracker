import { useThemeColor } from "@/hooks/useThemeColor";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { Picker } from "@react-native-picker/picker";
import { forwardRef, useImperativeHandle, useRef } from "react";
import { Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "./ThemedText";
import { ThemedView } from "./ThemedView";

export type BottomSheetsRef = {
  openIntervalSheet: () => void;
  openThemeSheet: () => void;
};

type IntervalOption = {
  label: string;
  value: string;
};

type Props = {
  intervalOptions: IntervalOption[];
  selectedIntervalIndex: number;
  onIntervalChange: (index: number) => void;
};

export const BottomSheets = forwardRef<BottomSheetsRef, Props>((props, ref) => {
  const { intervalOptions, selectedIntervalIndex, onIntervalChange } = props;
  const insets = useSafeAreaInsets();
  const backgroundColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "tint");

  const intervalSheetRef = useRef<BottomSheet>(null);
  const themeSheetRef = useRef<BottomSheet>(null);

  useImperativeHandle(ref, () => ({
    openIntervalSheet: () => {
      intervalSheetRef.current?.expand();
    },
    openThemeSheet: () => {
      themeSheetRef.current?.expand();
    },
  }));

  return (
    <>
      {/* Interval Selection Sheet */}
      <BottomSheet
        index={-1}
        ref={intervalSheetRef}
        enablePanDownToClose
        enableDynamicSizing
        handleStyle={{ backgroundColor }}
        handleIndicatorStyle={{ backgroundColor: textColor }}
      >
        <BottomSheetView
          style={{
            backgroundColor,
            flex: 1,
            paddingHorizontal: 16,
            paddingBottom: insets.bottom + 32,
          }}
        >
          <ThemedView
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              width: "100%",
            }}
          >
            <ThemedText type="defaultSemiBold">Backup interval</ThemedText>
            <Pressable onPress={() => intervalSheetRef.current?.close()}>
              <MaterialIcons name="close" size={24} color={textColor} />
            </Pressable>
          </ThemedView>
          <Picker
            selectedValue={intervalOptions[selectedIntervalIndex].value}
            onValueChange={(itemValue) =>
              onIntervalChange(
                intervalOptions.findIndex(
                  (option) => option.value === itemValue,
                ),
              )
            }
          >
            {intervalOptions.map((option, index) => (
              <Picker.Item
                key={index}
                label={option.label}
                value={option.value}
              />
            ))}
          </Picker>
        </BottomSheetView>
      </BottomSheet>

      {/* Theme Selection Sheet */}
      <BottomSheet
        index={-1}
        ref={themeSheetRef}
        enablePanDownToClose
        enableDynamicSizing
        handleStyle={{ backgroundColor }}
        handleIndicatorStyle={{ backgroundColor: textColor }}
      >
        <BottomSheetView
          style={{
            backgroundColor,
            flex: 1,
            paddingHorizontal: 16,
            paddingBottom: insets.bottom + 32,
          }}
        >
          <ThemedView
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              width: "100%",
            }}
          >
            <ThemedText type="defaultSemiBold">Theme Selection</ThemedText>
            <Pressable onPress={() => themeSheetRef.current?.close()}>
              <MaterialIcons name="close" size={24} color={textColor} />
            </Pressable>
          </ThemedView>
          {/* Add your theme selection UI here */}
        </BottomSheetView>
      </BottomSheet>
    </>
  );
}); 

BottomSheets.displayName = "BottomSheets";