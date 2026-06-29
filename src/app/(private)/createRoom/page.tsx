import { useEffect, useMemo, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  AppState,
  AppStateStatus,
  BackHandler,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import QRCode from 'react-native-qrcode-svg';
import Svg, { Path } from 'react-native-svg';

import BubbleHeading from '@/components/BubbleHeading';

import AppBackground from '@/components/AppBackground';
import { ActionButton } from '@/components/buttons';
import AuthContext from '@/contexts/auth';
import useGameSession from '@/hooks/game/useGameSession';
import {
  cancelGameSession,
  createGameSession,
  kickOfflinePlayer,
  startGame,
} from '@/services/game';

import styles from './styles';

function TrashIcon(): React.JSX.Element {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M3 6h18" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
      <Path d="M8 6V4h8v2" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M5 6l1 14h12l1-14" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M10 11v6" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
      <Path d="M14 11v6" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export default function CreateRoomPage(): JSX.Element {
  const params = useLocalSearchParams<{
    gameType?: string;
    existingSessionId?: string;
    existingRoomCode?: string;
    existingHostName?: string;
  }>();
  const gameType = params.gameType;
  const { user } = AuthContext.useAuth();
  const [hostName, setHostName] = useState(params.existingHostName ?? '');
  const [sessionId, setSessionId] = useState<string | null>(params.existingSessionId ?? null);
  const [roomCode, setRoomCode] = useState<string | null>(params.existingRoomCode ?? null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const navigatedRef = useRef(false);
  const addPlayerNavRef = useRef(false);
  const kickedNamesRef = useRef<Set<string>>(new Set());

  const accountName = hostName.trim() ||
    (user?.user_metadata?.first_name ??
    user?.user_metadata?.name ??
    'Restaurant');

  const { session, players, loading, error, refetch } = useGameSession(
    sessionId,
    user?.id ?? null,
    accountName,
  );

  // ── Offline detection (heartbeat-based) ──
  const OFFLINE_MS = 10_000;
  const GRACE_MS = 15_000;
  const [offTick, setOffTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setOffTick((v) => v + 1), 3000);
    return () => clearInterval(t);
  }, []);
  const isPlayerOffline = useMemo(() => {
    const now = Date.now();
    const map = new Map<string, boolean>();
    players.forEach((p) => {
      if (p.user_id === user?.id) { map.set(p.id, false); return; }
      if (!p.user_id) { map.set(p.id, false); return; }
      if (!p.last_active_at) { map.set(p.id, false); return; }
      const joinedAgo = now - new Date(p.created_at).getTime();
      if (joinedAgo < GRACE_MS) { map.set(p.id, false); return; }
      map.set(p.id, now - new Date(p.last_active_at).getTime() > OFFLINE_MS);
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, user?.id, offTick]);
  const anyOffline = Array.from(isPlayerOffline.values()).some(Boolean);

  async function handleCreateRoom(): Promise<void> {
    if (!hostName.trim()) {
      Alert.alert('Error', 'Enter your name first.');
      return;
    }
    if (sessionId || creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      const result = await createGameSession(
        'restaurant',
        gameType ?? 'spin_wheel',
        hostName.trim(),
        null,
        null,
      );
      if (result.error || !result.sessionId || !result.roomCode) {
        setCreateError(result.error?.message ?? 'Failed to create room.');
        return;
      }
      setSessionId(result.sessionId);
      setRoomCode(result.roomCode);
    } catch {
      setCreateError('Failed to create room. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  // Unmount cleanup — skip if navigating to addPlayer (session stays alive)
  useEffect(() => {
    return () => {
      if (!navigatedRef.current && !addPlayerNavRef.current && sessionId) {
        cancelGameSession(sessionId).catch(() => {});
      }
      addPlayerNavRef.current = false;
    };
  }, [sessionId]);

  // Lifecycle logging
  useEffect(() => {
    if (__DEV__) console.log('[Screen] CreateRoomPage MOUNTED');
    return () => {
      if (__DEV__) console.log('[Screen] CreateRoomPage UNMOUNTED');
    };
  }, []);

  // Auto-navigate on status change
  useEffect(() => {
    if (navigatedRef.current || !sessionId) return;
    const status = session?.status;
    if (status === 'active' || status === 'spinning') {
      navigatedRef.current = true;
      router.replace({
        pathname: '/(private)/spectator/page',
        params: { sessionId },
      } as never);
    }
    if (status === 'abandoned' || status === 'finished') {
      navigatedRef.current = true;
      router.replace('/(private)/dashboard/page');
    }
  }, [session?.status, sessionId]);

  // Host background cleanup — 15s timeout
  const bgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!sessionId) return;
    const sub = AppState.addEventListener(
      'change',
      (state: AppStateStatus) => {
        if (state === 'background' || state === 'inactive') {
          bgTimerRef.current = setTimeout(() => {
            cancelGameSession(sessionId).catch(() => {});
          }, 15_000);
        } else if (state === 'active') {
          if (bgTimerRef.current) {
            clearTimeout(bgTimerRef.current);
            bgTimerRef.current = null;
          }
        }
      },
    );
    return () => {
      sub.remove();
      if (bgTimerRef.current) clearTimeout(bgTimerRef.current);
    };
  }, [sessionId]);

  // Android hardware back
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleExit();
      return true;
    });
    return () => sub.remove();
  });

  // Track player changes
  const playerKey = useMemo(
    () => players.map((p) => p.id).join(','),
    [players],
  );
  const prevCountRef = useRef(players.length);
  const prevNamesRef = useRef<string[]>([]);
  useEffect(() => {
    const prevCount = prevCountRef.current;
    const prevNames = prevNamesRef.current;
    const currentNames = players.map((p) => p.player_name);

    if (prevCount > 0 && players.length < prevCount) {
      const left = prevNames.filter((n) => !currentNames.includes(n));
      if (left.length > 0) {
        const kicked = left.filter((n) => kickedNamesRef.current.has(n));
        const departed = left.filter((n) => !kickedNamesRef.current.has(n));
        if (kicked.length > 0) {
          Alert.alert('Player Removed', `${kicked.join(', ')} has been removed.`);
          kicked.forEach((n) => kickedNamesRef.current.delete(n));
        }
        if (departed.length > 0) {
          Alert.alert('Player Left', `${departed.join(', ')} left the game.`);
        }
      }
    }

    prevCountRef.current = players.length;
    prevNamesRef.current = currentNames;
  }, [playerKey]);

  async function doExit(): Promise<void> {
    if (actionLoading) return;
    setActionLoading(true);
    navigatedRef.current = true;
    try {
      if (sessionId) await cancelGameSession(sessionId);
    } catch { /* best-effort */ }
    router.replace('/(private)/dashboard/page');
  }

  function handleExit(): void {
    if (!sessionId || players.length === 0) {
      doExit();
      return;
    }
    Alert.alert(
      'End Game',
      'This will close the room and remove all players. Are you sure?',
      [
        { text: 'Stay', style: 'cancel' },
        { text: 'End Game', style: 'destructive', onPress: doExit },
      ],
    );
  }

  function handleKickPlayer(playerId: string, playerName: string): void {
    if (!sessionId) return;
    Alert.alert(
      'Remove Player',
      `Remove ${playerName} from the game?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            kickedNamesRef.current.add(playerName);
            const result = await kickOfflinePlayer(sessionId, playerId);
            if (result.error) {
              kickedNamesRef.current.delete(playerName);
              Alert.alert('Error', result.error.message);
            }
          },
        },
      ],
    );
  }

  async function handleStartGame(): Promise<void> {
    if (!sessionId || actionLoading) return;
    setActionLoading(true);
    try {
      const { error: startError } = await startGame(sessionId);
      if (startError) {
        setActionLoading(false);
        Alert.alert('Error', startError.message);
        return;
      }
      navigatedRef.current = true;
      router.replace({
        pathname: '/(private)/spectator/page',
        params: { sessionId },
      } as never);
    } catch {
      setActionLoading(false);
      Alert.alert('Error', 'Failed to start game. Please try again.');
    }
  }

  const canStart = players.length >= 2 && !actionLoading && !anyOffline;
  const displayCode = roomCode ?? '------';

  // ── Welcome Host screen (before room is created) ──
  if (!sessionId) {
    return (
      <AppBackground>
        <SafeAreaView style={styles.safe}>
          <ScrollView
            contentContainerStyle={welcomeStyles.scroll}
            showsVerticalScrollIndicator={false}
          >
            <Pressable
              style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
              onPress={() =>
                router.canGoBack()
                  ? router.back()
                  : router.replace('/(private)/dashboard/page')
              }
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Ionicons name="chevron-back" size={20} color="#fff" />
            </Pressable>

            <View style={welcomeStyles.headingWrap}>
              <BubbleHeading text={'WELCOME\nHOST'} fontSize={52} align="center" />
            </View>

            {createError ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={18} color="#fff" />
                <Text style={styles.errorText}>{createError}</Text>
              </View>
            ) : null}

            <View style={welcomeStyles.inputWrap}>
              <Ionicons name="person" size={18} color="#9B6FD4" />
              <View style={welcomeStyles.inputDivider} />
              <TextInput
                style={welcomeStyles.inputText}
                placeholder="Your Name"
                placeholderTextColor="#B8B0D0"
                value={hostName}
                onChangeText={setHostName}
              />
            </View>
          </ScrollView>

          <Pressable
            onPress={handleCreateRoom}
            disabled={creating || !hostName.trim()}
            style={({ pressed }) => [
              welcomeStyles.createBtn,
              pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              (creating || !hostName.trim()) && { opacity: 0.5 },
            ]}
          >
            <LinearGradient
              colors={['#F87171', '#F4736A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={welcomeStyles.createGradient}
            >
              {creating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={welcomeStyles.createText}>+ CREATE ROOM</Text>
              )}
            </LinearGradient>
          </Pressable>
        </SafeAreaView>
      </AppBackground>
    );
  }

  return (
    <AppBackground>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Back button */}
          <Pressable
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
            onPress={handleExit}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </Pressable>

          {/* QR Code */}
          <View style={styles.qrCard}>
            <QRCode
              value={Linking.createURL('(private)/joinSession/page', {
                queryParams: { mode: 'join', code: displayCode },
              })}
              size={148}
              color="#FFFFFF"
              backgroundColor="transparent"
            />
          </View>

          {/* Room Code */}
          <Text style={styles.roomLabel}>ROOM CODE</Text>
          <Text style={styles.roomCode}>{displayCode}</Text>

          {error ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={18} color="#fff" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Players Card */}
          <View style={styles.playersCard}>
            <Text style={styles.playersLabel}>
              PLAYER • {players.length}
            </Text>

            {loading && players.length === 0 ? (
              <ActivityIndicator size="large" color="#F4736A" style={styles.loadingIndicator} />
            ) : players.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Ionicons name="hourglass-outline" size={40} color="rgba(0,0,0,0.2)" />
                <Text style={styles.emptyText}>Waiting for players to join...</Text>
              </View>
            ) : (
              players.map((player) => (
                <View
                  key={player.id}
                  style={[
                    styles.rowWrapper,
                    isPlayerOffline.get(player.id) && styles.playerRowOffline,
                  ]}
                >
                  <View style={styles.playerRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.playerName}>
                        {player.player_name}
                      </Text>
                    </View>

                    {/* Offline badge */}
                    {isPlayerOffline.get(player.id) ? (
                      <View style={styles.offlineBadge}>
                        <Text style={styles.offlineBadgeText}>Offline</Text>
                      </View>
                    ) : null}

                    {/* Bot badge */}
                    {!player.user_id ? (
                      <View style={styles.botBadge}>
                        <Text style={styles.botBadgeText}>Bot</Text>
                      </View>
                    ) : null}

                    {/* Host badge */}
                    {player.is_host ? (
                      <View style={styles.hostBadge}>
                        <Text style={styles.hostBadgeText}>Host</Text>
                      </View>
                    ) : null}

                    {/* Trash icon — non-host only */}
                    {!player.is_host ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${player.player_name}`}
                        onPress={() => handleKickPlayer(player.id, player.player_name)}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        style={({ pressed }) => [pressed && { opacity: 0.5 }]}
                      >
                        <TrashIcon />
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ))
            )}
          </View>

          {/* START GAME button */}
          <Pressable
            disabled={!canStart}
            onPress={handleStartGame}
            style={({ pressed }) => [
              { width: '100%' },
              pressed && canStart && { opacity: 0.85, transform: [{ scale: 0.98 }] },
            ]}
          >
            <LinearGradient
              colors={canStart ? ['#F4736A', '#E8556A'] : ['#F4736A88', '#E8556A88']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.startBtn, !canStart && styles.startBtnDisabled]}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.startBtnText}>
                  {players.length < 2
                    ? 'NEED 2+ PLAYERS'
                    : anyOffline
                      ? 'WAITING FOR PLAYERS...'
                      : '+ START GAME'}
                </Text>
              )}
            </LinearGradient>
          </Pressable>

          {/* ADD MORE PLAYER */}
          <Pressable
            style={({ pressed }) => [
              styles.addBtn,
              pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
            ]}
            onPress={() => {
              if (!sessionId) return;
              addPlayerNavRef.current = true;
              router.push({
                pathname: '/(private)/addPlayer/page',
                params: { sessionId, roomCode: roomCode ?? '', hostName: hostName.trim() },
              } as never);
            }}
          >
            <Text style={styles.addBtnText}>ADD MORE PLAYER</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </AppBackground>
  );
}

const welcomeStyles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 22,
    flexGrow: 1,
  },
  headingWrap: {
    alignItems: 'center',
    marginTop: '42%',
    marginBottom: 40,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#6D4AFF',
    paddingHorizontal: 20,
    height: 62,
  },
  inputDivider: {
    width: 1,
    height: 22,
    backgroundColor: 'rgba(0,0,0,0.12)',
    marginHorizontal: 10,
  },
  inputText: {
    flex: 1,
    fontFamily: 'DMSans_400Regular',
    fontSize: 18,
    letterSpacing: 2,
    color: '#2A2F4A',
    paddingVertical: 0,
  },
  createBtn: {
    position: 'absolute' as const,
    bottom: 40,
    left: 24,
    right: 24,
  },
  createGradient: {
    height: 56,
    borderRadius: 999,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    shadowColor: '#F4736A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  createText: {
    fontFamily: 'Baloo2_800ExtraBold',
    fontSize: 18,
    color: '#FFFFFF',
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
