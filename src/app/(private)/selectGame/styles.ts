import { StyleSheet } from 'react-native';
import {
  colors,
  fonts,
  fontSize,
  spacing,
  borderRadius,
} from '@/constants/theme';

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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  gameCard: {
    width: '47%',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: borderRadius.xl,
    paddingVertical: spacing[5],
    alignItems: 'center',
    gap: spacing[2],
  },
  gameCardDisabled: {
    opacity: 0.5,
  },
  gameCardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconShadow: {
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  gameLabel: {
    fontFamily: fonts.semiBold,
    fontSize: fontSize.sm,
    lineHeight: 18,
    color: colors.textInverse,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  gameLabelDisabled: {
    opacity: 0.7,
  },
  comingSoonBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: borderRadius.full,
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[3],
  },
  comingSoonText: {
    fontFamily: fonts.bold,
    fontSize: fontSize.xs,
    lineHeight: 14,
    color: colors.textInverse,
    letterSpacing: 0.5,
  },
});

export default styles;
