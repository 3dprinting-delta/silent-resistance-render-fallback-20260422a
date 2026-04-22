import dynamic from "next/dynamic";

const DeadzoneClient = dynamic(() => import("@/components/deadzone/DeadzoneClient"), {
  ssr: false,
  loading: () => <div className="min-h-screen bg-neutral-950 text-neutral-100" />,
});

export default function DeadzonePage() {
  return <DeadzoneClient />;
}
