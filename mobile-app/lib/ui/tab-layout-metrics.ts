import { Platform } from 'react-native';

/** Visible tab bar content height (icons + labels), excluding device bottom inset */
export const TAB_BAR_CORE_HEIGHT = 60;

/** Extra scroll padding below last item so content clears the tab bar comfortably */
export const TAB_CONTENT_EXTRA_PADDING = 24;

export const TAB_HORIZONTAL_PADDING = 16;

export function getTabBarPaddingBottom(bottomInset: number): number {
  return Math.max(bottomInset, 10);
}

export function getTabBarHeight(bottomInset: number): number {
  return TAB_BAR_CORE_HEIGHT + bottomInset;
}

export function getTabContentPaddingBottom(bottomInset: number): number {
  return getTabBarHeight(bottomInset) + TAB_CONTENT_EXTRA_PADDING;
}

/** Min height for vertically centered list empty states */
export function getListEmptyMinHeight(
  windowHeight: number,
  topInset: number,
  bottomInset: number,
  headerHeight = 56,
): number {
  const chrome = topInset + headerHeight + getTabBarHeight(bottomInset) + 48;
  return Math.max(240, windowHeight - chrome);
}
