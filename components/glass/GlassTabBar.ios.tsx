import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ACTIVE_COLOR = '#007AFF';
const INACTIVE_COLOR = '#636366';
type BottomTabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

function TabItems({ state, descriptors, navigation }: BottomTabBarProps) {
  return state.routes.map((route, index) => {
    const { options } = descriptors[route.key];
    const focused = state.index === index;
    const color = focused ? ACTIVE_COLOR : INACTIVE_COLOR;
    const label = typeof options.tabBarLabel === 'string'
      ? options.tabBarLabel
      : options.title ?? route.name;

    const onPress = () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });

      if (!focused && !event.defaultPrevented) {
        navigation.navigate(route.name, route.params);
      }
    };

    const onLongPress = () => {
      navigation.emit({ type: 'tabLongPress', target: route.key });
    };

    return (
      <Pressable
        key={route.key}
        accessibilityRole="button"
        accessibilityState={focused ? { selected: true } : {}}
        accessibilityLabel={options.tabBarAccessibilityLabel}
        testID={options.tabBarButtonTestID}
        onPress={onPress}
        onLongPress={onLongPress}
        style={({ pressed }) => ({
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          minHeight: 56,
          opacity: pressed ? 0.55 : 1,
        })}
      >
        {options.tabBarIcon?.({ focused, color, size: 22 })}
        <Text
          numberOfLines={1}
          style={{ color, fontSize: 10, fontWeight: focused ? '600' : '500', paddingTop: 3 }}
        >
          {label}
        </Text>
      </Pressable>
    );
  });
}

export function GlassTabBar(props: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const barStyle = {
    borderRadius: 32,
    height: 64,
    overflow: 'hidden' as const,
  };

  const content = (
    <View style={{ flex: 1, flexDirection: 'row', paddingHorizontal: 8 }}>
      <TabItems {...props} />
    </View>
  );

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 18,
        right: 18,
        bottom: Math.max(insets.bottom, 10),
      }}
    >
      {isLiquidGlassAvailable() ? (
        <GlassView glassEffectStyle="regular" style={barStyle}>
          {content}
        </GlassView>
      ) : (
        <BlurView tint="systemMaterial" intensity={90} style={barStyle}>
          {content}
        </BlurView>
      )}
    </View>
  );
}
