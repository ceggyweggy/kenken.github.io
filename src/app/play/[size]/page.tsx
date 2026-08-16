import { notFound } from "next/navigation";
import PuzzleClient from "./PuzzleClient";

const VALID_SIZES = [6, 9];

export function generateStaticParams() {
  return VALID_SIZES.map((n) => ({ size: String(n) }));
}

export default async function PlayPage({ params }: PageProps<"/play/[size]">) {
  const { size } = await params;
  const n = Number(size);
  if (!VALID_SIZES.includes(n)) notFound();

  return <PuzzleClient n={n} />;
}
