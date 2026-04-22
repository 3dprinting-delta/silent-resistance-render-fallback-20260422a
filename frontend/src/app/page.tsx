import dynamic from "next/dynamic";

const GameShell = dynamic(() => import("@/components/game/GameShell"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 text-sm text-neutral-500">
      Loading operation shell...
    </div>
  ),
});

export default function HomePage() {
  return <GameShell />;
}
