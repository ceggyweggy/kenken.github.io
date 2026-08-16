"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getStoredNickname, joinRoom, setStoredNickname, type Room } from "@/lib/multiplayer";
import MultiplayerBoard from "@/components/MultiplayerBoard";
import styles from "./RoomClient.module.css";

interface PlayerProgress {
  nickname: string;
  filled: number;
  correct: number;
  total: number;
}

export default function RoomClient() {
  const searchParams = useSearchParams();
  const code = (searchParams.get("code") ?? "").toUpperCase();

  const [phase, setPhase] = useState<"nickname" | "loading" | "ready" | "error">("loading");
  const [nicknameInput, setNicknameInput] = useState(getStoredNickname());
  const [error, setError] = useState("");
  const [room, setRoom] = useState<Room | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [players, setPlayers] = useState<Record<string, string>>({});
  const [progressByPlayer, setProgressByPlayer] = useState<Record<string, PlayerProgress>>({});

  const presenceRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const myProgressRef = useRef<{ filled: number; correct: number; total: number }>({
    filled: 0,
    correct: 0,
    total: 0,
  });
  const trackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function trackProgress() {
    presenceRef.current
      ?.track({ nickname: getStoredNickname(), ...myProgressRef.current })
      .then((status) => {
        if (status !== "ok") console.error("presence.track failed:", status);
      });
  }

  const join = useCallback(
    async (nickname: string) => {
      try {
        setStoredNickname(nickname);
        const joinedRoom = await joinRoom(code, nickname);
        const { data } = await supabase.auth.getSession();
        const uid = data.session!.user.id;

        const { data: playerRows } = await supabase
          .from("room_players")
          .select("player_id, nickname")
          .eq("room_id", joinedRoom.id);
        const playerMap: Record<string, string> = {};
        for (const p of playerRows ?? []) playerMap[p.player_id] = p.nickname;

        setRoom(joinedRoom);
        setUserId(uid);
        setPlayers(playerMap);
        setPhase("ready");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not join that room.");
        setPhase("error");
      }
    },
    [code]
  );

  // Kicks off the initial session/join fetch on mount (and again if the room
  // code changes) — a legitimate "subscribe to an external system" effect,
  // not derivable during render.
  useEffect(() => {
    if (!code) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhase("loading");
    const stored = getStoredNickname();
    if (stored) join(stored);
    else setPhase("nickname");
  }, [code, join]);

  useEffect(() => {
    if (!room || !userId) return;

    const updates = supabase
      .channel(`room-updates-${room.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${room.id}` },
        (payload) => setRoom((prev) => (prev ? { ...prev, ...(payload.new as Partial<Room>) } : prev))
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "room_players", filter: `room_id=eq.${room.id}` },
        (payload) => {
          const row = payload.new as { player_id: string; nickname: string };
          setPlayers((prev) => ({ ...prev, [row.player_id]: row.nickname }));
        }
      )
      .subscribe((status, err) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("room-updates channel error:", status, err);
        }
      });

    const presence = supabase.channel(`presence-${room.id}`, {
      config: { presence: { key: userId } },
    });
    presence
      .on("presence", { event: "sync" }, () => {
        const state = presence.presenceState<PlayerProgress>();
        const next: Record<string, PlayerProgress> = {};
        for (const [id, entries] of Object.entries(state)) {
          if (entries[0]) next[id] = entries[0];
        }
        setProgressByPlayer(next);
      })
      .subscribe(async (status, err) => {
        if (status === "SUBSCRIBED") {
          const trackStatus = await presence.track({
            nickname: getStoredNickname(),
            ...myProgressRef.current,
          });
          if (trackStatus !== "ok") console.error("presence.track failed:", trackStatus);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("presence channel error:", status, err);
        }
      });
    presenceRef.current = presence;

    return () => {
      supabase.removeChannel(updates);
      supabase.removeChannel(presence);
      presenceRef.current = null;
      if (trackTimerRef.current) clearTimeout(trackTimerRef.current);
    };
    // Depend on room.id, not room itself — resubscribing on every realtime
    // update to `room` (e.g. solved_at landing) would tear the channels down.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id, userId]);

  function handleProgressChange(filled: number, correct: number, total: number) {
    myProgressRef.current = { filled, correct, total };
    if (trackTimerRef.current) return; // already scheduled — this call will pick up the latest ref
    trackTimerRef.current = setTimeout(() => {
      trackTimerRef.current = null;
      trackProgress();
    }, 400);
  }

  if (!code) {
    return (
      <main className={styles.page}>
        <div className={styles.card}>
          <p className={styles.error}>No room code provided.</p>
          <Link href="/multiplayer" className={styles.primary}>
            Back to multiplayer
          </Link>
        </div>
      </main>
    );
  }

  if (phase === "nickname") {
    return (
      <main className={styles.page}>
        <div className={styles.card}>
          <h1>Join room {code}</h1>
          <label className={styles.field}>
            <span>Your name</span>
            <input
              autoFocus
              value={nicknameInput}
              onChange={(e) => setNicknameInput(e.target.value)}
              maxLength={24}
              placeholder="e.g. Alex"
              onKeyDown={(e) => e.key === "Enter" && nicknameInput.trim() && join(nicknameInput.trim())}
            />
          </label>
          <button
            className={styles.primary}
            disabled={!nicknameInput.trim()}
            onClick={() => join(nicknameInput.trim())}
          >
            Join
          </button>
        </div>
      </main>
    );
  }

  if (phase === "loading") {
    return (
      <main className={styles.page}>
        <p className={styles.muted}>Joining room {code}…</p>
      </main>
    );
  }

  if (phase === "error" || !room || !userId) {
    return (
      <main className={styles.page}>
        <div className={styles.card}>
          <p className={styles.error}>{error || "Something went wrong."}</p>
          <Link href="/multiplayer" className={styles.primary}>
            Back to multiplayer
          </Link>
        </div>
      </main>
    );
  }

  const frozen = Boolean(room.solved_at);
  const winnerName = room.solved_by ? players[room.solved_by] ?? "Someone" : null;
  const iWon = room.solved_by === userId;

  return (
    <main className={styles.page}>
      <div className={styles.top}>
        <Link href="/multiplayer" className={styles.back}>
          &larr; Multiplayer
        </Link>
        <div className={styles.title}>
          <h1>
            {room.size} &times; {room.size}
          </h1>
          <span className={styles.code}>Room {room.code}</span>
        </div>
      </div>

      {frozen && (
        <div className={`${styles.banner} ${iWon ? styles.bannerWin : ""}`}>
          {iWon ? "You solved it first! 🎉" : `${winnerName} solved it first.`}
        </div>
      )}

      <div className={styles.layout}>
        <div className={styles.boardWrap}>
          <MultiplayerBoard room={room} userId={userId} frozen={frozen} onProgressChange={handleProgressChange} />
        </div>

        <aside className={styles.players}>
          <h2>Players</h2>
          <ul>
            {Object.entries(players).map(([id, name]) => {
              const progress = progressByPlayer[id];
              const pct = progress && progress.total ? Math.round((progress.correct / progress.total) * 100) : 0;
              const online = Boolean(progress);
              return (
                <li key={id} className={styles.player}>
                  <span className={`${styles.dot} ${online ? styles.dotOnline : ""}`} />
                  <span className={styles.playerName}>
                    {name}
                    {id === userId ? " (you)" : ""}
                  </span>
                  <span className={styles.playerPct}>{pct}%</span>
                </li>
              );
            })}
          </ul>
        </aside>
      </div>
    </main>
  );
}
