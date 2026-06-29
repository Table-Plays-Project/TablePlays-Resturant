import { StyleSheet } from 'react-native';

const CORAL = '#F4736A';
const WHITE = '#FFFFFF';

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: {
    paddingHorizontal: 22,
    paddingBottom: 40,
    alignItems: 'center' as const,
  },

  // ── Back button ──
  backBtn: {
    alignSelf: 'flex-start' as const,
    marginTop: 46,
    marginBottom: 10,
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: CORAL,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },

  // ── QR Card ──
  qrCard: {
    width: 190,
    height: 190,
    borderRadius: 28,
    backgroundColor: '#F07A72',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 10,
    borderWidth: 3,
    borderColor: 'rgba(150,230,120,0.7)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 16,
  },

  // ── Room Code ──
  roomLabel: {
    fontFamily: 'Baloo2_800ExtraBold',
    fontSize: 36,
    lineHeight: 44,
    color: WHITE,
    letterSpacing: 3,
    textAlign: 'center' as const,
    marginBottom: 0,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  roomCode: {
    fontFamily: 'Baloo2_800ExtraBold',
    fontSize: 32,
    lineHeight: 40,
    color: WHITE,
    letterSpacing: 5,
    textAlign: 'center' as const,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    marginBottom: 16,
  },

  // ── Error ──
  errorBanner: {
    backgroundColor: '#DC2626',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 12,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    width: '100%' as const,
  },
  errorText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    color: WHITE,
    flex: 1,
  },

  // ── Players Card ──
  playersCard: {
    width: '100%' as const,
    backgroundColor: WHITE,
    borderWidth: 1.5,
    borderColor: 'rgba(210,160,60,0.45)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 18,
    overflow: 'visible' as const,
  },
  playersLabel: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 13,
    color: '#E8553A',
    letterSpacing: 1,
    textShadowColor: 'rgba(230,100,50,0.4)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    marginBottom: 10,
  },
  loadingIndicator: {
    marginVertical: 16,
  },

  // ── Player Row ──
  rowWrapper: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 6,
    overflow: 'visible' as const,
  },
  playerRow: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    borderRadius: 12,
    paddingVertical: 10,
    paddingLeft: 16,
    paddingRight: 14,
    backgroundColor: CORAL,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(120,220,100,0.6)',
  },
  playerRowOffline: {},
  playerName: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 15,
    color: WHITE,
  },
  hostBadge: {
    backgroundColor: WHITE,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  hostBadgeText: {
    fontFamily: 'Baloo2_800ExtraBold',
    fontSize: 13,
    color: CORAL,
    letterSpacing: 0.5,
  },
  offlineBadge: {
    backgroundColor: WHITE,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  offlineBadgeText: {
    fontFamily: 'Baloo2_800ExtraBold',
    fontSize: 13,
    color: '#DC2626',
    letterSpacing: 0.5,
  },
  botBadge: {
    backgroundColor: WHITE,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  botBadgeText: {
    fontFamily: 'Baloo2_800ExtraBold',
    fontSize: 13,
    color: '#7C3AED',
    letterSpacing: 0.5,
  },

  // ── Buttons ──
  startBtn: {
    borderRadius: 999,
    height: 58,
    width: '100%' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    shadowColor: CORAL,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 12,
  },
  startBtnDisabled: {
    opacity: 0.5,
  },
  startBtnText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 17,
    color: WHITE,
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  addBtn: {
    width: '100%' as const,
    borderRadius: 999,
    paddingVertical: 17,
    alignItems: 'center' as const,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  addBtnText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 17,
    color: WHITE,
    letterSpacing: 1,
  },

  // ── Center (loading/error states) ──
  centerWrap: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 20,
    gap: 16,
  },
  statusText: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 16,
    color: WHITE,
    textAlign: 'center' as const,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },

  // ── Empty ──
  emptyWrap: {
    alignItems: 'center' as const,
    paddingVertical: 24,
    gap: 12,
  },
  emptyText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center' as const,
  },
});

export default styles;
