import { useEffect, useMemo, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  AppState,
  AppStateStatus,
  BackHandler,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppBackground from '@/components/AppBackground';
import BubbleHeading from '@/components/BubbleHeading';
import { ActionButton, NavigationButton, SecondaryButton } from '@/components/buttons';
import AuthContext from '@/contexts/auth';
import useGameSession from '@/hooks/game/useGameSession';
import {
  cancelGameSession,
  finishSession,
  resetSessionToWaiting,
  resolveExpiredChallenge,
} from '@/services/game';
import { colors, fontSize } from '@/constants/theme';

import styles from './styles';

const ESCAPE_GRACE_MS = 1000;

function initialsFor(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}

/** Visual-only countdown — server is the sole authority on timing. */
function useCountdownSeconds(deadline: string | null): number {
  const [seconds, setSeconds] = useState<number>(() =>
    deadline
      ? Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 1000))
      : 0,
  );

  useEffect(() => {
    if (!deadline) {
      setSeconds(0);
      return;
    }
    const deadlineMs = new Date(deadline).getTime();
    function tick(): void {
      setSeconds(Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000)));
    }
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [deadline]);

  return seconds;
}

function statusLabel(status: string | undefined): string {
  switch (status) {
    case 'active':
      return 'Waiting for players to spin...';
    case 'spinning':
      return 'Wheel is spinning!';
    case 'finished':
      return 'Game finished';
    default:
      return 'Game in progress';
  }
}

function statusIcon(status: string | undefined): keyof typeof Ionicons.glyphMap {
  switch (status) {
    case 'active':
      return 'hourglass-outline';
    case 'spinning':
      return 'sync-circle';
    case 'finished':
      return 'checkmark-circle';
    default:
      return 'game-controller';
  }
}

export default function SpectatorPage(): JSX.Element {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { user } = AuthContext.useAuth();
  const [actionLoading, setActionLoading] = useState(false);
  const navigatedRef = useRef(false);

  const accountName =
    user?.user_metadata?.first_name ??
    user?.user_metadata?.name ??
    'Restaurant';

  const { session, players, loading, error, refetch } = useGameSession(
    sessionId ?? null,
    user?.id ?? null,
    accountName,
  );

  const payerIndex =
    typeof session?.game_state?.payer_index === 'number'
      ? session.game_state.payer_index
      : null;
  const payerPlayer = payerIndex !== null ? players[payerIndex] : null;
  const isFinished = session?.status === 'finished';
  const duration = session?.created_at && session?.ended_at
    ? Math.round(
        (new Date(session.ended_at).getTime() -
          new Date(session.created_at).getTime()) /
          1000,
      )
    : null;
  const durationText = duration !== null
    ? duration < 60
      ? `${duration}s`
      : `${Math.floor(duration / 60)}m ${duration % 60}s`
    : null;
  const roundNumber =
    typeof session?.game_state?.round === 'number'
      ? session.game_state.round
      : 1;

  // Escape-challenge: read-only for the restaurant owner — they have no
  // session_players row, so they can never be challenge_player_id.
  const challengeStatus =
    session?.game_state?.challenge_status === 'pending' ? 'pending' : null;
  const challengeDeadline =
    typeof session?.game_state?.challenge_deadline === 'string'
      ? session.game_state.challenge_deadline
      : null;
  const challengePlayerId =
    typeof session?.game_state?.challenge_player_id === 'string'
      ? session.game_state.challenge_player_id
      : null;
  const challengedPlayer = challengePlayerId
    ? players.find((p) => p.id === challengePlayerId) ?? null
    : null;
  const challengeSeconds = useCountdownSeconds(
    challengeStatus === 'pending' ? challengeDeadline : null,
  );

  // Safety net: the restaurant owner's device also polls this session
  // and can finalize an expired challenge if every player's device
  // happened to die. resolve_expired_challenge's atomic UPDATE...WHERE
  // gate makes it safe for multiple devices to race on this.
  const resolvedDeadlineRef = useRef<string | null>(null);
  useEffect(() => {
    if (challengeStatus !== 'pending' || !challengeDeadline || !sessionId) return;
    if (resolvedDeadlineRef.current === challengeDeadline) return;

    const msUntilCheck =
      new Date(challengeDeadline).getTime() - Date.now() + ESCAPE_GRACE_MS;

    const timer = setTimeout(() => {
      resolvedDeadlineRef.current = challengeDeadline;
      resolveExpiredChallenge(sessionId).catch(() => {});
    }, Math.max(0, msUntilCheck));

    return () => clearTimeout(timer);
  }, [challengeStatus, challengeDeadline, sessionId]);

  // Unmount cleanup
  useEffect(() => {
    return () => {
      if (!navigatedRef.current && sessionId) {
        cancelGameSession(sessionId).catch(() => {});
      }
    };
  }, [sessionId]);

  // Navigate to dashboard on abandoned/finished
  useEffect(() => {
    if (navigatedRef.current) return;
    if (session?.status === 'abandoned') {
      navigatedRef.current = true;
      router.replace('/(private)/dashboard/page');
    }
  }, [session?.status]);

  // If status resets to waiting (shouldn't happen in spectator, but guard)
  useEffect(() => {
    if (navigatedRef.current || !sessionId) return;
    if (session?.status === 'waiting') {
      navigatedRef.current = true;
      router.replace({
        pathname: '/(private)/createRoom/page',
        params: { gameType: session?.game_type ?? 'spin_wheel' },
      } as never);
    }
  }, [session?.status, sessionId]);

  // Host background cleanup — 15s
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
      handleBack();
      return true;
    });
    return () => sub.remove();
  });

  // Stable key — only changes on actual join/leave, not every poll
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
        Alert.alert('Player Left', `${left.join(', ')} left the game.`);
      }
    }

    prevCountRef.current = players.length;
    prevNamesRef.current = currentNames;

    if (players.length > 0 && players.length < 2 && session?.status !== 'finished') {
      navigatedRef.current = true;
      resetSessionToWaiting(sessionId!).then(() => {
        router.replace({
          pathname: '/(private)/createRoom/page',
          params: { gameType: session?.game_type ?? 'spin_wheel' },
        } as never);
      });
    }
  }, [playerKey, sessionId, session?.status, session?.game_type]);

  function handleBack(): void {
    Alert.alert(
      'Game Options',
      'What would you like to do?',
      [
        { text: 'Stay', style: 'cancel' },
        {
          text: 'Back to Room',
          onPress: async () => {
            if (navigatedRef.current) return;
            navigatedRef.current = true;
            try {
              if (sessionId) await resetSessionToWaiting(sessionId);
            } catch { /* best-effort */ }
            router.replace({
              pathname: '/(private)/createRoom/page',
              params: { gameType: session?.game_type ?? 'spin_wheel' },
            } as never);
          },
        },
        {
          text: 'End Game',
          style: 'destructive',
          onPress: async () => {
            if (navigatedRef.current) return;
            navigatedRef.current = true;
            setActionLoading(true);
            try {
              if (sessionId) {
                if (session?.status === 'spinning') {
                  await finishSession(sessionId);
                } else {
                  await cancelGameSession(sessionId);
                }
              }
            } catch { /* best-effort */ }
            router.replace('/(private)/dashboard/page');
          },
        },
      ],
    );
  }

  async function handleEndGame(): Promise<void> {
    if (actionLoading || !sessionId) return;
    setActionLoading(true);
    navigatedRef.current = true;
    try {
      if (session?.status === 'spinning') {
        await finishSession(sessionId);
      } else {
        await cancelGameSession(sessionId);
      }
    } catch { /* best-effort */ }
    router.replace('/(private)/dashboard/page');
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
            <NavigationButton onPress={handleBack} arrow="arrow-back" />
            <BubbleHeading
              text="GAME TABLE"
              fontSize={fontSize['2xl']}
              align="center"
            />
            <View style={styles.headerSpacer} />
          </View>

          {/* Status Card */}
          <View style={[styles.statusCard, isFinished && styles.statusCardFinished]}>
            <Ionicons
              name={statusIcon(session?.status)}
              size={40}
              color={isFinished ? colors.success : colors.textInverse}
            />
            <Text style={styles.statusLabel}>
              {statusLabel(session?.status)}
            </Text>
            {session?.status === 'spinning' ? (
              <Text style={styles.roundText}>Round {roundNumber}</Text>
            ) : null}
            {isFinished && durationText ? (
              <Text style={styles.roundText}>Duration: {durationText}</Text>
            ) : null}
            {challengeStatus === 'pending' && challengedPlayer ? (
              <Text style={styles.roundText}>
                {challengedPlayer.player_name} has {challengeSeconds}s to escape!
              </Text>
            ) : null}
          </View>

          {/* Payer Result */}
          {payerPlayer && (session?.status === 'spinning' || session?.status === 'finished') ? (
            <View style={styles.resultCard}>
              <View style={styles.resultAvatar}>
                <Text style={styles.resultAvatarText}>
                  {initialsFor(payerPlayer.player_name)}
                </Text>
              </View>
              <View style={styles.resultInfo}>
                <Text style={styles.resultName}>
                  {payerPlayer.player_name}
                </Text>
                <Text style={styles.resultLabel}>PAYS THE BILL</Text>
              </View>
            </View>
          ) : null}

          {error ? (
            <View style={styles.errorBanner}>
              <Ionicons
                name="alert-circle"
                size={18}
                color={colors.textInverse}
              />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Player List */}
          <Text style={styles.sectionTitle}>
            PLAYERS ({players.length})
          </Text>

          {loading && players.length === 0 ? (
            <ActivityIndicator
              size="large"
              color={colors.textInverse}
              style={styles.loadingIndicator}
            />
          ) : (
            <View style={styles.playersList}>
              {players.map((player, idx) => (
                <View
                  key={player.id}
                  style={[
                    styles.playerRow,
                    payerIndex === idx && styles.playerRowPayer,
                  ]}
                >
                  <View
                    style={[
                      styles.playerAvatar,
                      payerIndex === idx && styles.playerAvatarPayer,
                    ]}
                  >
                    <Text style={styles.playerAvatarText}>
                      {initialsFor(player.player_name)}
                    </Text>
                  </View>
                  <Text style={styles.playerName}>
                    {player.player_name}
                  </Text>
                  {payerIndex === idx ? (
                    <View style={styles.paysBadge}>
                      <Text style={styles.paysBadgeText}>PAYS</Text>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            <ActionButton
              onPress={handleEndGame}
              text={actionLoading ? 'ENDING...' : 'END TABLE'}
              disabled={actionLoading}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </AppBackground>
  );
}
