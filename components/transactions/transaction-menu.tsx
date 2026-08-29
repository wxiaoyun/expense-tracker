import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { MenuView, type MenuAction, type NativeActionEvent } from '@expo/ui/community/menu';

type TransactionMenuProps = {
  transactionId: string;
  description: string;
  templateId: string | null;
  hasActiveTemplate: boolean;
  onEdit: (id: string) => void;
  onSaveAsTemplate: (id: string) => void;
  onViewTemplate: (templateId: string) => void;
  onDelete: (id: string) => void;
};

export function TransactionMenu({
  transactionId,
  description,
  templateId,
  hasActiveTemplate,
  onEdit,
  onSaveAsTemplate,
  onViewTemplate,
  onDelete,
}: TransactionMenuProps) {
  const canViewTemplate = hasActiveTemplate && Boolean(templateId);
  const actions: MenuAction[] = [
    { id: 'edit', title: 'Edit', image: 'pencil' },
    canViewTemplate
      ? { id: 'view-template', title: 'View Template', image: 'doc.text' }
      : { id: 'save-template', title: 'Save as Template', image: 'plus.square' },
    { id: 'delete', title: 'Delete', image: 'trash', attributes: { destructive: true } },
  ];

  const handleMenuAction = ({ nativeEvent }: NativeActionEvent) => {
    switch (nativeEvent.event) {
      case 'edit':
        onEdit(transactionId);
        break;
      case 'save-template':
        onSaveAsTemplate(transactionId);
        break;
      case 'view-template':
        if (templateId) onViewTemplate(templateId);
        break;
      case 'delete':
        onDelete(transactionId);
        break;
    }
  };

  return (
    <MenuView
      actions={actions}
      onPressAction={handleMenuAction}
      shouldOpenOnLongPress={false}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Actions for ${description}`}
        hitSlop={8}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Feather name="more-vertical" size={22} color="#6E6E73" />
      </Pressable>
    </MenuView>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
