import SCPNightwatchShell from "@/components/scpNightwatch/SCPNightwatchShell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Site-17 Nightwatch | Recovered Incident Archive",
  description: "Recovered Foundation surveillance session documenting five nights of containment failure inside Site-17.",
};

export default function Site17NightwatchPage() {
  return <SCPNightwatchShell />;
}
