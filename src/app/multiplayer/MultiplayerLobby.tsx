"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Difficulty } from "@/lib/kenken";
import { createRoom, getStoredNickname, joinRoom, setStoredNickname } from "@/lib/multiplayer";
import styles from "./MultiplayerLobby.module.css";

const SIZES = [6, 9] as const;
const DIFFICULTIES: { key: Difficulty; label: string }[] = [
  { key: "easy", label: "Easy" },
  { key: "medium", label: "Medium" },
  { key: "hard", label: "Hard" },
];

export default function MultiplayerLobby() {
  const router = useRouter();
  const [nickname, setNickname] = useState(getStoredNickname());
  const [size, setSize] = useState<number>(6);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState<"" | "create" | "join">("");
  const [error, setError] = useState("");

  function requireNickname(): string | null {
    const trimmed = nickname.trim();
    if (!trimmed) {
      setError("Enter a name first.");
      return null;
    }
    setStoredNickname(trimmed);
    return trimmed;
  }

  async function handleCreate() {
    if (!requireNickname()) return;
    setError("");
    setPending("create");
    try {
      const roomCode = await createRoom(size, difficulty);
      router.push(`/room?code=${roomCode}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the room.");
      setPending("");
    }
  }

  async function handleJoin() {
    const name = requireNickname();
    if (!name) return;
    if (!code.trim()) {
      setError("Enter a room code.");
      return;
    }
    setError("");
    setPending("join");
    try {
      const room = await joinRoom(code, name);
      router.push(`/room?code=${room.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join that room.");
      setPending("");
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.top}>
        <Link href="/" className={styles.back}>
          &larr; Home
        </Link>
        <h1>Multiplayer</h1>
      </div>
      <p className={styles.intro}>
        Everyone races on their own copy of the same grid &mdash; first to solve it correctly wins.
      </p>

      <label className={styles.field}>
        <span>Your name</span>
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={24}
          placeholder="e.g. Alex"
        />
      </label>

      <div className={styles.panels}>
        <div className={styles.panel}>
          <h2>Create a room</h2>
          <label className={styles.field}>
            <span>Size</span>
            <select value={size} onChange={(e) => setSize(Number(e.target.value))}>
              {SIZES.map((n) => (
                <option key={n} value={n}>
                  {n} &times; {n}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>Difficulty</span>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
              {DIFFICULTIES.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <button className={styles.primary} onClick={handleCreate} disabled={pending !== ""}>
            {pending === "create" ? "Creating…" : "Create room"}
          </button>
        </div>

        <div className={styles.panel}>
          <h2>Join a room</h2>
          <label className={styles.field}>
            <span>Room code</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={5}
              placeholder="ABCDE"
              className={styles.codeInput}
            />
          </label>
          <button className={styles.primary} onClick={handleJoin} disabled={pending !== ""}>
            {pending === "join" ? "Joining…" : "Join room"}
          </button>
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}
    </main>
  );
}
