import { StyleSheet } from 'react-native';
import {
  colors,
  fonts,
  fontSize,
  spacing,
  borderRadius,
} from '@/constants/theme';

const TEXT_SHADOW = {
  textShadowColor: 'rgba(0, 0, 0, 0.3)',
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 4,
} as const;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[12],
    paddingBottom: spacing[10],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  headerSpacer: {
    width: 44,
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[5],
    gap: spacing[4],
  },
  statusText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSize.base,
    lineHeight: 20,
    color: colors.textInverse,
    textAlign: 'center',
    ...TEXT_SHADOW,
  },
  roomCodeCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: borderRadius.xl,
    paddingVertical: spacing[6],
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  roomCodeLabel: {
    fontFamily: fonts.semiBold,
    fontSize: fontSize.sm,
    lineHeight: 18,
    color: 'rgba(255, 255, 255, 0.8)',
    letterSpacing: 1,
    ...TEXT_SHADOW,
  },
  roomCodeValue: {
    fontFamily: fonts.bold,
    fontSize: fontSize['4xl'],
    lineHeight: 50,
    color: colors.textInverse,
    letterSpacing: 4,
    marginTop: spacing[2],
    fontVariant: ['tabular-nums'],
    ...TEXT_SHADOW,
  },
  roomCodeHint: {
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
    lineHeight: 18,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: spacing[2],
    ...TEXT_SHADOW,
  },
  errorBanner: {
    backgroundColor: colors.error,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    marginBottom: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  errorText: {
    fontFamily: fonts.medium,
    fontSize: fontSize.sm,
    lineHeight: 18,
    color: colors.textInverse,
    flex: 1,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSize.md,
    lineHeight: 22,
    color: colors.textInverse,
    letterSpacing: 0.5,
    marginBottom: spacing[3],
    ...TEXT_SHADOW,
  },
  loadingIndicator: {
    marginTop: spacing[8],
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: spacing[8],
    gap: spacing[3],
  },
  emptyText: {
    fontFamily: fonts.medium,
    fontSize: fontSize.base,
    lineHeight: 20,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    ...TEXT_SHADOW,
  },
  playersList: {
    gap: spacing[3],
    marginBottom: spacing[8],
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: borderRadius.xl,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    gap: spacing[3],
  },
  playerAvatar: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: colors.ctaSolid,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  playerAvatarText: {
    fontFamily: fonts.bold,
    fontSize: fontSize.md,
    color: colors.textInverse,
  },
  playerName: {
    flex: 1,
    fontFamily: fonts.semiBold,
    fontSize: fontSize.base,
    lineHeight: 20,
    color: colors.textInverse,
    ...TEXT_SHADOW,
  },
});

export default styles;
