"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export default function NewPuzzleButton({ className }: { className?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button className={className} disabled={pending} onClick={() => startTransition(() => router.refresh())}>
      {pending ? "Shuffling…" : "New puzzle"}
    </button>
  );
}
