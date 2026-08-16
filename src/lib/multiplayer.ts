import { supabase } from "@/lib/supabase";
import { generatePuzzle, type Clue, type Difficulty } from "@/lib/kenken";

export interface Room {
  id: string;
  code: string;
  size: number;
  solution: number[][];
  clues: Clue[];
  created_by: string;
  solved_by: string | null;
  solved_at: string | null;
}

const NICKNAME_KEY = "kenken:nickname";
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

export function getStoredNickname(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(NICKNAME_KEY) ?? "";
}

export function setStoredNickname(name: string) {
  window.localStorage.setItem(NICKNAME_KEY, name);
}

function randomCode(length = 5): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return out;
}

export async function ensureSession(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session.user.id;

  const { data: signIn, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return signIn.user!.id;
}

export async function createRoom(n: number, difficulty: Difficulty): Promise<string> {
  const userId = await ensureSession();
  const puzzle = generatePuzzle(n, difficulty);

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const { error } = await supabase.from("rooms").insert({
      code,
      size: puzzle.size,
      solution: puzzle.solution,
      clues: puzzle.clues,
      created_by: userId,
    });
    if (!error) return code;
    if (error.code !== "23505") throw error; // anything but "code already taken" is fatal
  }
  throw new Error("Could not allocate a room code, please try again.");
}

export async function joinRoom(code: string, nickname: string): Promise<Room> {
  const userId = await ensureSession();
  const normalizedCode = code.trim().toUpperCase();

  const { data: foundRaw, error: lookupError } = await supabase
    .rpc("find_room_by_code", { p_code: normalizedCode })
    .single();
  if (lookupError || !foundRaw) throw new Error("No room with that code.");
  const found = foundRaw as { id: string; code: string; size: number };

  const { error: joinError } = await supabase
    .from("room_players")
    .insert({ room_id: found.id, player_id: userId, nickname });
  if (joinError && joinError.code !== "23505") throw joinError; // 23505 = already joined

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("*")
    .eq("id", found.id)
    .single();
  if (roomError || !room) throw new Error("Could not load the room.");

  return room as Room;
}
