"use client";

export default function NewPuzzleButton({
  className,
  pending,
  onClick,
}: {
  className?: string;
  pending: boolean;
  onClick: () => void;
}) {
  return (
    <button className={className} disabled={pending} onClick={onClick}>
      {pending ? "Shuffling…" : "New puzzle"}
    </button>
  );
}
