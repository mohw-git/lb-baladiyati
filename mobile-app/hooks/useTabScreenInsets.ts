import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  TAB_HORIZONTAL_PADDING,
  getListEmptyMinHeight,
  getTabBarHeight,
  getTabBarPaddingBottom,
  getTabContentPaddingBottom,
} from '../lib/ui/tab-layout-metrics';

/** Shared safe-area + tab bar metrics for tab stack screens */
export function useTabScreenInsets() {
  const insets = useSafeAreaInsets();

  return {
    top: insets.top,
    bottom: insets.bottom,
    horizontalPadding: TAB_HORIZONTAL_PADDING,
    tabBarHeight: getTabBarHeight(insets.bottom),
    tabBarPaddingBottom: getTabBarPaddingBottom(insets.bottom),
    contentPaddingBottom: getTabContentPaddingBottom(insets.bottom),
    listEmptyMinHeight: (windowHeight: number, headerHeight = 56) =>
      getListEmptyMinHeight(windowHeight, insets.top, insets.bottom, headerHeight),
  };
}
