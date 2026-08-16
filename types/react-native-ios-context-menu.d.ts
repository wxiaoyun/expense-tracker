declare module 'react-native-ios-context-menu' {
  import type { ComponentType } from 'react';
  import type { ViewProps } from 'react-native';

  export type MenuState = 'on' | 'off' | 'mixed';

  export type MenuActionConfig = {
    actionKey: string;
    actionTitle: string;
    actionSubtitle?: string;
    menuState?: MenuState;
    menuAttributes?: Array<'hidden' | 'disabled' | 'destructive' | 'keepsMenuPresented'>;
  };

  export type MenuConfig = {
    menuTitle?: string;
    menuSubtitle?: string;
    menuItems?: MenuActionConfig[];
  };

  export type ContextMenuButtonProps = ViewProps & {
    isMenuPrimaryAction?: boolean;
    isContextMenuEnabled?: boolean;
    menuConfig?: MenuConfig;
    onPressMenuItem?: (event: { nativeEvent: { actionKey: string } }) => void;
  };

  export const ContextMenuButton: ComponentType<ContextMenuButtonProps>;
}
