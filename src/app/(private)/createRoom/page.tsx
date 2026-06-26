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
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppBackground from '@/components/AppBackground';
import BubbleHeading from '@/components/BubbleHeading';
import { ActionButton, NavigationButton } from '@/components/buttons';
import AuthContext from '@/contexts/auth';
import useGameSession from '@/hooks/game/useGameSession';
import {
  cancelGameSession,
  createGameSession,
  resetSessionToWaiting,
  startGame,
} from '@/services/game';
import { colors, fontSize } from '@/constants/theme';

import styles from './styles';

function initialsFor(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}

export default function CreateRoomPage(): JSX.Element {
  const { gameType } = useLocalSearchParams<{ gameType: string }>();
  const { user } = AuthContext.useAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const navigatedRef = useRef(false);

  const accountName =
    user?.user_metadata?.first_name ??
    user?.user_metadata?.name ??
    'Restaurant';

  const { session, players, loading, error, refetch } = useGameSession(
    sessionId,
    user?.id ?? null,
    accountName,
  );

  // Create room on mount
  useEffect(() => {
    if (sessionId || creating) return;

    async function create(): Promise<void> {
      setCreating(true);
      setCreateError(null);
      try {
        const result = await createGameSession(
          'restaurant',
          gameType ?? 'spin_wheel',
          'Restaurant Host',
          null,
          null,
        );
        if (result.error || !result.sessionId || !result.roomCode) {
          setCreateError(
            result.error?.message ?? 'Failed to create room.',
          );
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

    create();
  }, [sessionId, creating, gameType]);

  // Unmount cleanup — cancel session if navigating away unexpectedly
  useEffect(() => {
    return () => {
      if (!navigatedRef.current && sessionId) {
        cancelGameSession(sessionId).catch(() => {});
      }
    };
  }, [sessionId]);

  // Navigate when game starts
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

  // Track player changes — notify when someone leaves
  const prevPlayerCountRef = useRef(players.length);
  const prevPlayerNamesRef = useRef<string[]>([]);
  const playerKey = useMemo(
    () => players.map((p) => p.id).join(','),
    [players],
  );
  useEffect(() => {
    const prevCount = prevPlayerCountRef.current;
    const prevNames = prevPlayerNamesRef.current;
    const currentNames = players.map((p) => p.player_name);

    if (prevCount > 0 && players.length < prevCount) {
      const left = prevNames.filter((n) => !currentNames.includes(n));
      if (left.length > 0) {
        Alert.alert('Player Left', `${left.join(', ')} left the game.`);
      }
    }

    prevPlayerCountRef.current = players.length;
    prevPlayerNamesRef.current = currentNames;
  }, [playerKey]);

  async function handleExit(): Promise<void> {
    if (actionLoading) return;
    setActionLoading(true);
    navigatedRef.current = true;
    try {
      if (sessionId) await cancelGameSession(sessionId);
    } catch {
      // Best-effort
    }
    router.replace('/(private)/dashboard/page');
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

  const canStart = players.length >= 2 && !actionLoading;

  if (creating) {
    return (
      <AppBackground>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.centerWrap}>
            <ActivityIndicator size="large" color={colors.textInverse} />
            <Text style={styles.statusText}>Creating room...</Text>
          </View>
        </SafeAreaView>
      </AppBackground>
    );
  }

  if (createError) {
    return (
      <AppBackground>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.centerWrap}>
            <Ionicons
              name="alert-circle"
              size={48}
              color={colors.textInverse}
            />
            <Text style={styles.statusText}>{createError}</Text>
            <ActionButton
              onPress={() => {
                setCreateError(null);
                setCreating(false);
              }}
              text="TRY AGAIN"
            />
          </View>
        </SafeAreaView>
      </AppBackground>
    );
  }

  return (
    <AppBackground>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <NavigationButton onPress={handleExit} arrow="arrow-back" />
            <BubbleHeading
              text="TABLE ROOM"
              fontSize={fontSize['2xl']}
              align="center"
            />
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.roomCodeCard}>
            <Text style={styles.roomCodeLabel}>ROOM CODE</Text>
            <Text style={styles.roomCodeValue}>
              {roomCode ?? '------'}
            </Text>
            <Text style={styles.roomCodeHint}>
              Customers enter this code to join
            </Text>
          </View>

          {error ? (
            <View style={styles.errorBanner}>
              <Ionicons
                name="alert-circle"
                size={18}
                color={colors.textInverse}
              />
              <Text style={styles.errorText}>{error}</Text>
              <Pressable onPress={refetch} style={styles.retryButton}>
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            </View>
          ) : null}

          <Text style={styles.sectionTitle}>
            PLAYERS ({players.length})
          </Text>

          {loading && players.length === 0 ? (
            <ActivityIndicator
              size="large"
              color={colors.textInverse}
              style={styles.loadingIndicator}
            />
          ) : players.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons
                name="hourglass-outline"
                size={40}
                color="rgba(255,255,255,0.5)"
              />
              <Text style={styles.emptyText}>
                Waiting for customers to join...
              </Text>
            </View>
          ) : (
            <View style={styles.playersList}>
              {players.map((player) => (
                <View key={player.id} style={styles.playerRow}>
                  <View style={styles.playerAvatar}>
                    <Text style={styles.playerAvatarText}>
                      {initialsFor(player.player_name)}
                    </Text>
                  </View>
                  <Text style={styles.playerName}>
                    {player.player_name}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <ActionButton
            onPress={handleStartGame}
            text={
              actionLoading
                ? 'STARTING...'
                : players.length < 2
                  ? 'NEED 2+ PLAYERS'
                  : 'START GAME'
            }
            disabled={!canStart}
          />
        </ScrollView>
      </SafeAreaView>
    </AppBackground>
  );
}
