import dynamic from "next/dynamic";

const RagdollArchersClient = dynamic(() => import("@/components/ragdollArchers/RagdollArchersClient"), {
  ssr: false,
  loading: () => <div className="min-h-screen bg-neutral-950 text-neutral-100" />,
});

export default function RagdollArchersPage() {
  return <RagdollArchersClient />;
}
