import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, AppStateStatus, BackHandler, View } from 'react-native';
import { Asset } from 'expo-asset';
import { router, useLocalSearchParams } from 'expo-router';

import { SpinWheelScreen } from '@/components/games/SpinWheel';
import type { WheelPlayer } from '@/components/games/SpinWheel';
import AuthContext from '@/contexts/auth';
import AVATARS from '@/constants/avatars';
import useGameSession from '@/hooks/game/useGameSession';
import {
  cancelGameSession,
  finishSession,
  kickOfflinePlayer,
  resetSessionToWaiting,
  resolveExpiredChallenge,
  spinWheel,
} from '@/services/game';
import { ESCAPE_CHALLENGE } from '@/components/games/SpinWheel/wheelConfig';

const avatarAssetMap = new Map<string, number>();
AVATARS.forEach((a) => {
  avatarAssetMap.set(a.id, a.source as number);
});

function useAvatarUris(avatarIds: string[]): Map<string, string> {
  const [uriMap, setUriMap] = useState<Map<string, string>>(new Map());
  const loadedRef = useRef(new Set<string>());

  useEffect(() => {
    const toLoad = avatarIds.filter(
      (id) => !loadedRef.current.has(id) && avatarAssetMap.has(id),
    );
    if (toLoad.length === 0) return;

    Promise.all(
      toLoad.map(async (id) => {
        const source = avatarAssetMap.get(id)!;
        const asset = Asset.fromModule(source);
        await asset.downloadAsync();
        return { id, uri: asset.localUri ?? asset.uri };
      }),
    ).then((results) => {
      setUriMap((prev) => {
        const next = new Map(prev);
        results.forEach((r) => {
          if (r.uri) {
            next.set(r.id, r.uri);
            loadedRef.current.add(r.id);
          }
        });
        return next;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avatarIds.join(',')]);

  return uriMap;
}

export default function SpectatorPage(): JSX.Element {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { user } = AuthContext.useAuth();
  const accountName =
    user?.user_metadata?.first_name ??
    user?.user_metadata?.name ??
    'Restaurant';

  const { session, players, loading, error, refetch } = useGameSession(
    sessionId ?? null,
    user?.id ?? null,
    accountName,
  );
  const navigatedAway = useRef(false);

  const isSpinning = session?.status === 'spinning';
  const payerIndex =
    typeof session?.game_state?.payer_index === 'number'
      ? session.game_state.payer_index
      : null;
  const spinStartedAt =
    typeof session?.game_state?.spin_started_at === 'string'
      ? session.game_state.spin_started_at
      : null;

  const excludedPayerIds = useMemo(
    () =>
      Array.isArray(session?.game_state?.excluded_payer_ids)
        ? (session.game_state.excluded_payer_ids as string[])
        : [],
    [session?.game_state?.excluded_payer_ids],
  );
  const isEscapeContinuation = excludedPayerIds.length > 0;
  const rawChallengeStatus = session?.game_state?.challenge_status;

  const challengeStatus =
    rawChallengeStatus === 'pending' || rawChallengeStatus === 'failed'
      ? rawChallengeStatus
      : null;
  const challengePlayerId =
    typeof session?.game_state?.challenge_player_id === 'string'
      ? session.game_state.challenge_player_id
      : null;
  const challengeStart =
    typeof session?.game_state?.challenge_start === 'number'
      ? session.game_state.challenge_start
      : null;
  const challengeStep =
    typeof session?.game_state?.challenge_step === 'number'
      ? session.game_state.challenge_step
      : null;
  const challengeDeadline =
    typeof session?.game_state?.challenge_deadline === 'string'
      ? session.game_state.challenge_deadline
      : null;

  const challengedPlayer = challengePlayerId
    ? players.find((p) => p.id === challengePlayerId) ?? null
    : null;

  useEffect(() => {
    if (__DEV__) console.log('[Screen] SpectatorPage MOUNTED');
    return () => {
      if (__DEV__) console.log('[Screen] SpectatorPage UNMOUNTED');
    };
  }, []);

  // Background > 15 seconds → cancel and go to dashboard
  const bgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!sessionId) return;
    const sub = AppState.addEventListener(
      'change',
      (state: AppStateStatus) => {
        if (state === 'background' || state === 'inactive') {
          bgTimerRef.current = setTimeout(() => {
            if (navigatedAway.current) return;
            navigatedAway.current = true;
            cancelGameSession(sessionId).catch(() => {});
            router.replace('/(private)/dashboard/page');
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

  // When status resets to waiting → back to createRoom
  useEffect(() => {
    if (navigatedAway.current || !sessionId) return;
    if (session?.status === 'waiting') {
      navigatedAway.current = true;
      router.replace({
        pathname: '/(private)/createRoom/page',
        params: { gameType: session?.game_type ?? 'spin_wheel', existingSessionId: sessionId, existingRoomCode: session?.room_code ?? '' },
      } as never);
    }
  }, [session?.status, sessionId]);

  // Abandoned/finished detection
  useEffect(() => {
    if (navigatedAway.current) return;
    if (session?.status === 'abandoned' || session?.status === 'finished') {
      navigatedAway.current = true;
      router.replace('/(private)/dashboard/page');
    }
  }, [session?.status]);

  // Android hardware back
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true;
    });
    return () => sub.remove();
  });

  // Player change tracking
  const playerKey = useMemo(
    () => players.map((p) => p.id).join(','),
    [players],
  );
  const prevPlayerCountRef = useRef(players.length);
  const prevPlayerNamesRef = useRef<string[]>([]);
  useEffect(() => {
    if (navigatedAway.current || !sessionId) return;
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

    if (players.length > 0 && players.length < 2 && session?.status !== 'finished') {
      navigatedAway.current = true;
      resetSessionToWaiting(sessionId).then(() => {
        router.replace({
          pathname: '/(private)/createRoom/page',
          params: { gameType: session?.game_type ?? 'spin_wheel', existingSessionId: sessionId, existingRoomCode: session?.room_code ?? '' },
        } as never);
      });
    }
  }, [playerKey, sessionId, session?.status, session?.game_type, session?.room_code]);

  // Avatar resolution
  const avatarIds = useMemo(
    () => players.map((p) => p.avatar_id).filter((id): id is string => id !== null),
    [players],
  );
  const avatarUris = useAvatarUris(avatarIds);

  const wheelPlayers: WheelPlayer[] = useMemo(() => {
    return players.map((p) => {
      const uri = p.avatar_id ? (avatarUris.get(p.avatar_id) ?? null) : null;
      return {
        id: p.id,
        name: p.player_name,
        avatarUri: uri,
        avatarSource: null,
      };
    });
  }, [players, avatarUris]);

  // Spin logic — restaurant host always controls
  const forceNewSpinRef = useRef(false);

  const requestWinner = useCallback(async (): Promise<number> => {
    const forceFresh = forceNewSpinRef.current;
    forceNewSpinRef.current = false;

    if (
      !forceFresh &&
      isEscapeContinuation &&
      payerIndex !== null &&
      payerIndex < players.length
    ) {
      return payerIndex;
    }

    if (!sessionId) throw new Error('No session');
    const result = await spinWheel(sessionId);
    if (result.error || result.payerIndex === null) {
      throw new Error(result.error?.message ?? 'Spin failed');
    }
    if (result.payerIndex >= players.length) {
      throw new Error('Player list out of sync. Please retry.');
    }
    return result.payerIndex;
  }, [sessionId, payerIndex, players.length, isEscapeContinuation]);

  async function doHostExit(): Promise<void> {
    if (navigatedAway.current) return;
    navigatedAway.current = true;
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
  }

  async function doBackToRoom(): Promise<void> {
    if (navigatedAway.current || !sessionId) return;
    navigatedAway.current = true;
    try {
      await resetSessionToWaiting(sessionId);
    } catch { /* best-effort */ }
    router.replace({
      pathname: '/(private)/createRoom/page',
      params: { gameType: session?.game_type ?? 'spin_wheel', existingSessionId: sessionId, existingRoomCode: session?.room_code ?? '' },
    } as never);
  }

  function handleBack(): void {
    Alert.alert(
      'Game Options',
      'What would you like to do?',
      [
        { text: 'Stay', style: 'cancel' },
        { text: 'Back to Room', onPress: doBackToRoom },
        { text: 'End Game', style: 'destructive', onPress: doHostExit },
      ],
    );
  }

  const handleResult = useCallback(
    (_payerIdx: number): void => {
      forceNewSpinRef.current = true;
    },
    [],
  );

  const handleSubmitEscapeAnswer = useCallback(
    async (_answer: number): Promise<void> => {
      // Restaurant host can never be challenged — no-op
    },
    [],
  );

  // Safety net: resolve expired challenges from spectator device
  const resolvedDeadlineRef = useRef<string | null>(null);
  useEffect(() => {
    if (challengeStatus !== 'pending' || !challengeDeadline || !sessionId) return;
    if (resolvedDeadlineRef.current === challengeDeadline) return;

    const msUntilCheck =
      new Date(challengeDeadline).getTime() - Date.now() + ESCAPE_CHALLENGE.GRACE_MS;

    const timer = setTimeout(() => {
      resolvedDeadlineRef.current = challengeDeadline;
      resolveExpiredChallenge(sessionId).catch((e) => {
        console.error('resolveExpiredChallenge failed:', e);
      });
    }, Math.max(0, msUntilCheck));

    return () => clearTimeout(timer);
  }, [challengeStatus, challengeDeadline, sessionId]);

  // Offline detection
  const OFFLINE_THRESHOLD_MS = 10_000;
  const GRACE_MS = 15_000;
  const [offlineTick, setOfflineTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setOfflineTick((v) => v + 1), 3000);
    return () => clearInterval(t);
  }, []);

  const offlinePlayers = useMemo(() => {
    const now = Date.now();
    return players.filter((p) => {
      if (!p.user_id) return false;
      if (!p.last_active_at) return false;
      const joinedAgo = now - new Date(p.created_at).getTime();
      if (joinedAgo < GRACE_MS) return false;
      return now - new Date(p.last_active_at).getTime() > OFFLINE_THRESHOLD_MS;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, offlineTick]);

  const allPlayersOnline = offlinePlayers.length === 0;

  // Auto-kick offline players after 15 seconds
  const kickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!sessionId || allPlayersOnline) {
      if (kickTimerRef.current) {
        clearTimeout(kickTimerRef.current);
        kickTimerRef.current = null;
      }
      return;
    }
    kickTimerRef.current = setTimeout(() => {
      offlinePlayers.forEach((p) => {
        kickOfflinePlayer(sessionId, p.id).catch((e) => {
          console.error('kickOfflinePlayer failed:', e);
        });
      });
    }, 15_000);
    return () => {
      if (kickTimerRef.current) clearTimeout(kickTimerRef.current);
    };
  }, [sessionId, allPlayersOnline, offlinePlayers]);

  function handleGameEnd(): void {
    Alert.alert(
      'End Game',
      'Are you sure you want to end this game?',
      [
        { text: 'Stay', style: 'cancel' },
        { text: 'End Game', style: 'destructive', onPress: doHostExit },
      ],
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <SpinWheelScreen
        players={wheelPlayers}
        loading={loading}
        error={!!error}
        requestWinner={requestWinner}
        onBack={handleBack}
        onRetry={refetch}
        autoSpin={
          !!session &&
          isSpinning &&
          payerIndex !== null &&
          isEscapeContinuation
        }
        canSpin={allPlayersOnline}
        spinKey={spinStartedAt}
        onResult={handleResult}
        onGameEnd={handleGameEnd}
        challengeStatus={challengeStatus}
        isChallengedPlayer={false}
        challengedPlayerName={challengedPlayer?.player_name ?? null}
        challengeStart={challengeStart}
        challengeStep={challengeStep}
        challengeDeadline={challengeDeadline}
        onSubmitEscapeAnswer={handleSubmitEscapeAnswer}
        onChallengeReady={() => {}}
        statusMessage={
          !allPlayersOnline
            ? `${offlinePlayers.map((p) => p.player_name).join(', ')} is not here`
            : null
        }
      />
    </View>
  );
}
