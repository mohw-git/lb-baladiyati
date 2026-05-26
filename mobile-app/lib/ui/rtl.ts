import { I18nManager, type TextStyle, type ViewStyle } from 'react-native';

/** Effective RTL: user locale or system RTL when allowed. */
export function useLayoutRtl(isRtlLocale: boolean): boolean {
  return isRtlLocale || I18nManager.isRTL;
}

export function flexRow(rtl: boolean): ViewStyle {
  return { flexDirection: rtl ? 'row-reverse' : 'row' };
}

export function textAlignStart(rtl: boolean): TextStyle {
  return { textAlign: rtl ? 'right' : 'left' };
}

/** Centered copy for empty/locked cards — same in LTR and RTL locales. */
export const centeredText: TextStyle = { textAlign: 'center' };

export function textAlignEnd(rtl: boolean): TextStyle {
  return { textAlign: rtl ? 'left' : 'right' };
}

/** Inline-start margin (logical “start” using locale RTL, not I18nManager alone). */
export function marginStart(rtl: boolean, value: number): ViewStyle {
  return rtl ? { marginRight: value } : { marginLeft: value };
}

/** Inline-end margin. */
export function marginEnd(rtl: boolean, value: number): ViewStyle {
  return rtl ? { marginLeft: value } : { marginRight: value };
}

export function paddingStart(rtl: boolean, value: number): ViewStyle {
  return rtl ? { paddingRight: value } : { paddingLeft: value };
}

export function paddingEnd(rtl: boolean, value: number): ViewStyle {
  return rtl ? { paddingLeft: value } : { paddingRight: value };
}

/** Absolute position on the inline-start edge. */
export function positionStart(rtl: boolean, value: number): ViewStyle {
  return rtl ? { right: value, left: undefined } : { left: value, right: undefined };
}

/** Absolute position on the inline-end edge. */
export function positionEnd(rtl: boolean, value: number): ViewStyle {
  return rtl ? { left: value, right: undefined } : { right: value, left: undefined };
}

export function alignItemsStart(rtl: boolean): ViewStyle {
  return { alignItems: rtl ? 'flex-end' : 'flex-start' };
}

export function chevronForward(rtl: boolean): 'chevron-forward' | 'chevron-back' {
  return rtl ? 'chevron-back' : 'chevron-forward';
}

/** Leading icon for back navigation in headers/toolbars. */
export function chevronBack(rtl: boolean): 'chevron-back' | 'chevron-forward' {
  return rtl ? 'chevron-forward' : 'chevron-back';
}
