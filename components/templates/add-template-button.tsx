import React from 'react';
import { Pressable, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { toast } from 'sonner-native';

export function AddTemplateButton() {
  const router = useRouter();

  const handlePress = () => {
    console.info('[templates.ui][stage=navigate_create]', { template_id: null });
    try {
      router.push('/(drawer)/template-edit');
    } catch (error) {
      console.error('[templates.ui][stage=navigate_create] failed', {
        template_id: null,
        stage: 'navigate_create',
        error: String(error),
      });
      toast.error('Could not open template editor');
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Add template"
      onPress={handlePress}
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
