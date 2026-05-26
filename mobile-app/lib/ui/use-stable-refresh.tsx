import { useCallback, useRef, useState } from 'react';
import { Platform, RefreshControl, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Colors } from '../../constants/theme';

const TOP_THRESHOLD = 12;

type UseStableRefreshOptions = {
  onRefresh: () => void | Promise<unknown>;
};

/**
 * Pull-to-refresh that only runs when the list is scrolled to the top.
 * `refreshing` reflects user-initiated pulls — not background query refetches.
 */
export function useStableRefresh({ onRefresh }: UseStableRefreshOptions) {
  const scrollYRef = useRef(0);
  const refreshingRef = useRef(false);
  const [refreshing, setRefreshing] = useState(false);

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollYRef.current = event.nativeEvent.contentOffset.y;
  }, []);

  const handleRefresh = useCallback(async () => {
    if (scrollYRef.current > TOP_THRESHOLD) return;
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }, [onRefresh]);

  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={handleRefresh}
      tintColor={Colors.navy[700]}
      colors={[Colors.navy[700]]}
      progressBackgroundColor={Colors.white}
      progressViewOffset={Platform.OS === 'android' ? 0 : undefined}
    />
  );

  return {
    refreshing,
    refreshControl,
    onScroll,
    scrollEventThrottle: 16 as const,
  };
}
