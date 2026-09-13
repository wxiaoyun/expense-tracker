import React from 'react';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useThemeColors } from '@/hooks/useThemeColor';

export default function TabsLayout() {
  const colors = useThemeColors();
  return (
    <NativeTabs tintColor={colors.primary}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Expenses</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'list.bullet', selected: 'list.bullet' }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="templates">
        <NativeTabs.Trigger.Label>Templates</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'doc.on.doc', selected: 'doc.on.doc.fill' }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="summary">
        <NativeTabs.Trigger.Label>Summary</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'chart.pie', selected: 'chart.pie.fill' }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
