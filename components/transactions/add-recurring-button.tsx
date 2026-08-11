import React from 'react';
import { Pressable, Text } from 'react-native';
import { useRouter } from 'expo-router';

export function AddRecurringButton() {
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Add recurring expense"
      onPress={() => router.push('/(drawer)/recurring-edit')}
      style={({ pressed }) => ({
        position: 'absolute',
        right: 24,
        bottom: 104,
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#007AFF',
        boxShadow: '0 8px 24px rgba(0, 122, 255, 0.32)',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ color: '#FFFFFF', fontSize: 34, fontWeight: '300', lineHeight: 38 }}>+</Text>
    </Pressable>
  );
}
