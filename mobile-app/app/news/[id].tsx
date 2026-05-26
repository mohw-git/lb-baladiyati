import { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Image, TouchableOpacity } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { newsApi } from '../../lib/api/endpoints';
import { ApiError, getFileUrl } from '../../lib/api/client';
import { getErrorPresentation } from '../../lib/api/errors';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';
import { AuthGate } from '../../components/auth-gate';
import { useTranslate } from '../../lib/i18n';
import { useStableRefresh } from '../../lib/ui/use-stable-refresh';

/** Strip HTML tags and decode common entities */
function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export default function NewsDetailScreen() {
  return (
    <AuthGate>
      <NewsDetailContent />
    </AuthGate>
  );
}

function NewsDetailContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTranslate();

  const { data: article, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['news', id],
    queryFn: () => newsApi.getById(id),
    enabled: !!id,
  });

  const handleRefresh = useCallback(() => refetch(), [refetch]);
  const stableRefresh = useStableRefresh({ onRefresh: handleRefresh });

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={Colors.brand[600]} /></View>;
  }

  if (isError || !article) {
    const pres = isError
      ? getErrorPresentation(error, t)
      : getErrorPresentation(new ApiError(404, 'NOT_FOUND', t('errors.notFound.message')), t);
    return (
      <View style={styles.center}>
        <Ionicons
          name={pres.isNetwork ? 'cloud-offline-outline' : 'alert-circle-outline'}
          size={48}
          color={Colors.red[400]}
        />
        <Text style={styles.emptyText}>{t(pres.titleKey)}</Text>
        {isError && <Text style={styles.errorDetail}>{pres.message}</Text>}
        <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
          <Ionicons name="refresh" size={16} color={Colors.white} />
          <Text style={styles.retryBtnText}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={stableRefresh.refreshControl}
      onScroll={stableRefresh.onScroll}
      scrollEventThrottle={stableRefresh.scrollEventThrottle}
    >
      {article.coverImageUrl && (
        <Image source={{ uri: getFileUrl(article.coverImageUrl) }} style={styles.cover} resizeMode="cover" />
      )}
      <Text style={styles.title}>{article.title}</Text>
      <View style={styles.metaRow}>
        <Ionicons name="person" size={14} color={Colors.gray[400]} />
        <Text style={styles.meta}>
          {article.author ? `${article.author.firstName} ${article.author.lastName}` : 'Staff'}
        </Text>
        <Ionicons name="calendar" size={14} color={Colors.gray[400]} style={{ marginLeft: Spacing.md }} />
        <Text style={styles.meta}>
          {new Date(article.publishedAt || article.createdAt).toLocaleDateString()}
        </Text>
      </View>
      <Text style={styles.body}>{stripHtml(article.content)}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  content: { paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.md, padding: Spacing.xl },
  emptyText: { fontSize: FontSize.md, color: Colors.gray[500], textAlign: 'center' },
  errorDetail: { fontSize: FontSize.sm, color: Colors.gray[400], textAlign: 'center' },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    backgroundColor: Colors.brand[600], borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
  },
  retryBtnText: { fontSize: FontSize.md, fontWeight: '600', color: Colors.white },
  cover: { width: '100%', height: 220 },
  title: { fontSize: FontSize.xxl, fontWeight: '700', color: Colors.gray[900], padding: Spacing.xl, paddingBottom: Spacing.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.xl, gap: Spacing.xs, marginBottom: Spacing.lg },
  meta: { fontSize: FontSize.xs, color: Colors.gray[500] },
  body: { fontSize: FontSize.md, color: Colors.gray[700], lineHeight: 24, paddingHorizontal: Spacing.xl },
});
