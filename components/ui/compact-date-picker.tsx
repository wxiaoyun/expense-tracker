import { DatePicker, Host } from '@expo/ui/swift-ui';
import { datePickerStyle } from '@expo/ui/swift-ui/modifiers';

type CompactDatePickerProps = {
  value: Date;
  onValueChange: (date: Date) => void;
  testID?: string;
};

export function CompactDatePicker({
  value,
  onValueChange,
  testID,
}: CompactDatePickerProps) {
  return (
    <Host matchContents={{ horizontal: true, vertical: true }} ignoreSafeArea="all" testID={testID}>
      <DatePicker
        selection={value}
        displayedComponents={['date']}
        onDateChange={onValueChange}
        modifiers={[datePickerStyle('compact')]}
      />
    </Host>
  );
}
