"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import styles from "./RagdollArchers.module.css";

const DEBUG_SUBSYSTEMS = {
  profileSync: true,
  menuScreen: true,
  matchCanvas: true,
  hud: true,
  tutorial: true,
  account: true,
  audio: true,
} as const;

const MenuScreen = dynamic(async () => {
  try {
    return (await import("@/components/ragdollArchers/MenuScreen")).MenuScreen;
  } catch (error) {
    console.error("SUBSYSTEM ERROR MenuScreen", error);
    return function MenuScreenFallback() {
      return <div className={styles.hudCard}>Menu enhancement unavailable.</div>;
    };
  }
}, { ssr: false });

const MatchCanvas = dynamic(async () => {
  try {
    return (await import("@/components/ragdollArchers/MatchCanvas")).MatchCanvas;
  } catch (error) {
    console.error("SUBSYSTEM ERROR MatchCanvas", error);
    return function MatchCanvasFallback() {
      return <div className={styles.viewportPanel} style={{ padding: 16 }}>Game canvas failed to load.</div>;
    };
  }
}, {
  ssr: false,
  loading: () => <div className={styles.viewportPanel} style={{ padding: 16 }}>Loading game systems...</div>,
});

const GameHud = dynamic(async () => {
  try {
    return (await import("@/components/ragdollArchers/GameHud")).GameHud;
  } catch (error) {
    console.error("SUBSYSTEM ERROR GameHud", error);
    return function GameHudFallback() {
      return null;
    };
  }
}, { ssr: false });

const TutorialOverlay = dynamic(async () => {
  try {
    return (await import("@/components/ragdollArchers/TutorialOverlay")).TutorialOverlay;
  } catch (error) {
    console.error("SUBSYSTEM ERROR TutorialOverlay", error);
    return function TutorialOverlayFallback() {
      return null;
    };
  }
}, { ssr: false });

const AccountPanel = dynamic(async () => {
  try {
    return (await import("@/components/ragdollArchers/AccountPanel")).AccountPanel;
  } catch (error) {
    console.error("SUBSYSTEM ERROR AccountPanel", error);
    return function AccountPanelFallback() {
      return <div className={styles.accountCard}>Account panel unavailable.</div>;
    };
  }
}, { ssr: false });

const AudioRuntime = dynamic(async () => {
  try {
    return (await import("@/game/ragdollArchers/audio/AudioRuntime")).AudioRuntime;
  } catch (error) {
    console.error("SUBSYSTEM ERROR AudioRuntime", error);
    return function AudioRuntimeFallback() {
      return null;
    };
  }
}, { ssr: false });

const ProfileSync = dynamic(async () => {
  try {
    return (await import("@/components/ragdollArchers/ProfileSync")).ProfileSync;
  } catch (error) {
    console.error("SUBSYSTEM ERROR ProfileSync", error);
    return function ProfileSyncFallback() {
      return null;
    };
  }
}, { ssr: false });

type StartMode = "quick" | "survival" | "challenge";

export default function RagdollArchersMountedApp() {
  const [screen, setScreen] = useState<"menu" | "game">("menu");
  const [selectedMode, setSelectedMode] = useState<StartMode>("quick");
  const [phase, setPhase] = useState<"menu" | "playing" | "result">("menu");
  const [storeReady, setStoreReady] = useState(false);
  const realismHighlights = [
    "Two combat views sharing one progression profile and one medical model",
    "Stage-based treatment with supplies, tools, and injury-specific recovery steps",
    "Food and stimulant inventory for stamina instead of a single arcade apple",
    "Account sign-in and profile sync so upgrades, runs, and death reports persist",
  ];

  useEffect(() => {
    console.log("Mounted app alive");
    const disabledSubsystems = Object.entries(DEBUG_SUBSYSTEMS)
      .filter(([, enabled]) => !enabled)
      .map(([name]) => name);
    disabledSubsystems.forEach((name) => {
      console.warn(`Disabled subsystem for isolation: ${name}`);
    });
  }, []);

  const startGame = useCallback(async (mode: StartMode, challengeBaseMode: "quick" | "survival" = "quick") => {
    console.log("Starting game mode:", mode);
    setSelectedMode(mode);
    setScreen("game");
    setPhase("playing");

    try {
      const [{ useRagdollArchersStore }, analyticsModule] = await Promise.all([
        import("@/game/ragdollArchers/core/store"),
        import("@/game/ragdollArchers/analytics/analyticsClient").catch(() => null),
      ]);

      setStoreReady(true);
      const store = useRagdollArchersStore.getState();
      if (mode === "quick") {
        analyticsModule?.trackAnalyticsEvent?.({ type: "mode_started", payload: { launchMode: "quick_duel" } });
        store.setLaunchMode("quick_duel");
        store.setMode("duel");
        store.setRealismMode(false);
      } else if (mode === "survival") {
        analyticsModule?.trackAnalyticsEvent?.({ type: "mode_started", payload: { launchMode: "survival_run" } });
        store.setLaunchMode("survival_run");
        store.setMode("firstperson");
        store.setRealismMode(false);
      } else {
        analyticsModule?.trackAnalyticsEvent?.({ type: "challenge_started", payload: { launchMode: "challenge_run", challengeId: store.selectedChallengeId || null, baseMode: challengeBaseMode } });
        store.setLaunchMode("challenge_run");
        store.setMode(challengeBaseMode === "survival" ? "firstperson" : "duel");
        store.setRealismMode(true);
      }
      store.beginMatch();
    } catch (error) {
      console.error("SUBSYSTEM ERROR store/bootstrap", error);
      setStoreReady(false);
    }
  }, []);

  const returnToMenu = useCallback(async () => {
    setScreen("menu");
    setPhase("menu");
    try {
      const { useRagdollArchersStore } = await import("@/game/ragdollArchers/core/store");
      useRagdollArchersStore.getState().returnToMenu();
    } catch (error) {
      console.error("SUBSYSTEM ERROR returnToMenu", error);
    }
  }, []);

  return (
    <main className={styles.shell}>
      <div className={styles.backdrop} />
      {DEBUG_SUBSYSTEMS.profileSync ? <ProfileSync /> : null}
      <div className={styles.chrome}>
        <section className={styles.heroPanel}>
          <div className={styles.heroNarrative}>
            <p className={styles.eyebrow}>Realistic Combat Rebuild</p>
            <h1 className={styles.title}>Ragdoll Archers: Trauma Protocol</h1>
            <p className={styles.copy}>A Vercel-ready ragdoll archery web game rebuilt around heavier impacts, medically grounded treatment, persistent accounts, and a shared combat model across classic 2D and first-person play.</p>
            <div className={styles.inlineActions}>
              <button type="button" className={styles.primaryButton} onClick={() => startGame("quick")}>
                Classic 2D
              </button>
              <button type="button" className={styles.secondaryButton} onClick={() => startGame("survival")}>
                First-Person
              </button>
              <button type="button" className={styles.secondaryButton} onClick={() => startGame("challenge", selectedMode === "survival" ? "survival" : "quick")}>
                Medical Realism
              </button>
              {screen === "game" ? (
                <button type="button" className={styles.secondaryButton} onClick={returnToMenu}>
                  Return to Menu
                </button>
              ) : null}
            </div>
            <div className={styles.heroChecklist}>
              {realismHighlights.map((item) => (
                <div key={item} className={styles.heroChecklistItem}>
                  <span className={styles.heroBullet} aria-hidden="true" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div className={styles.statusCluster}>
            <div className={styles.statusCard}>
              <span className={styles.statusLabel}>Primary Mode</span>
              <span className={styles.statusValue}>Classic 2D Duel</span>
            </div>
            <div className={styles.statusCard}>
              <span className={styles.statusLabel}>Secondary Mode</span>
              <span className={styles.statusValue}>First-Person Survival</span>
            </div>
            <div className={styles.statusCard}>
              <span className={styles.statusLabel}>Medical Model</span>
              <span className={styles.statusValue}>Staged Triage And Recovery</span>
            </div>
            <div className={styles.statusCard}>
              <span className={styles.statusLabel}>Account Sync</span>
              <span className={styles.statusValue}>{storeReady ? "ready" : "booting"}</span>
            </div>
            {DEBUG_SUBSYSTEMS.account ? <AccountPanel /> : (
              <div className={styles.accountCard}>
                <p className={styles.eyebrow}>Safe Shell</p>
                <h3 className={styles.sectionTitle}>Route stable</h3>
                <p className={styles.sectionCopy}>Account overlay disabled for isolation.</p>
              </div>
            )}
          </div>
        </section>

        <section className={styles.viewportPanel}>
          {screen === "menu" ? (
            <>
              <div className={styles.hudCard}>
                <span className={styles.hudLabel}>Rebuild Goals</span>
                <span className={styles.hudValue}>Shared combat physics, staged treatment, readable supplies, persistent accounts, and a medical death report in both modes</span>
              </div>
              <div className={styles.menuPanel}>
                <div className={styles.card}>
                  <h2 className={styles.sectionTitle}>Choose Your Entry</h2>
                  <p className={styles.sectionCopy}>Classic 2D remains the flagship loop. First-Person keeps the same injuries, supplies, and progression from the player view. Medical Realism adds stricter treatment timing, staged care, and clearer consequences when you ignore trauma.</p>
                  <div className={styles.buttonRow}>
                    <button type="button" className={styles.primaryButton} onClick={() => startGame("quick")}>
                      Classic 2D
                    </button>
                    <button type="button" className={styles.secondaryButton} onClick={() => startGame("survival")}>
                      First-Person
                    </button>
                    <button type="button" className={styles.secondaryButton} onClick={() => startGame("challenge", selectedMode === "survival" ? "survival" : "quick")}>
                      Medical Realism
                    </button>
                  </div>
                </div>
              </div>
              {DEBUG_SUBSYSTEMS.menuScreen ? <MenuScreen onStartGame={startGame} /> : null}
            </>
          ) : (
            <>
              {DEBUG_SUBSYSTEMS.matchCanvas ? <MatchCanvas mode={selectedMode} /> : <div className={styles.viewportPanel} style={{ padding: 16 }}>MatchCanvas disabled for isolation.</div>}
              {phase === "playing" && DEBUG_SUBSYSTEMS.tutorial ? <TutorialOverlay /> : null}
              {DEBUG_SUBSYSTEMS.hud ? <GameHud /> : null}
            </>
          )}
        </section>
      </div>
      {DEBUG_SUBSYSTEMS.audio ? <AudioRuntime /> : null}
    </main>
  );
}
