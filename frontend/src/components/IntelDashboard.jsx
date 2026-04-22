// Legacy intelligence dashboard from the prototype path. The current live route does not mount this component.
"use client";

import { useEffect, useMemo, useState } from "react";
import { eliminateWorldTarget, fetchWorldState } from "@/lib/worldApi";
import { useWorldStore } from "@/store/worldStore";
import { useSuspicionStore } from "@/game/DisguiseSystem";
import { missionBrief } from "@/game/missionData";
import { useMissionStore } from "@/store/missionStore";

const POLL_INTERVAL_MS = 8_000;

const targetDossiers = {
  "hc-1": {
    profile: "Architect of internal repression inside the regime core, with layered escorts and sealed-briefing habits.",
    habits: "Moves between the command wing, officers' mess, and sealed review chambers in a narrow evening rhythm.",
    vulnerabilities: ["Escort rings compress during evening review windows.", "Command staff uniforms pass more easily than technical crews.", "Lockdown drills create repeatable corridor bottlenecks."],
  },
  "hc-2": {
    profile: "Harbor prefect who rules through convoy tempo, customs seizures, and public intimidation.",
    habits: "Cycles between customs gate, dock inspections, and late-night enforcement sweeps.",
    vulnerabilities: ["Manifest delays force exposed dockside inspections.", "Utility interruptions reroute her through service corridors.", "Her security depends on intimidation more than deep surveillance redundancy."],
  },
  "hc-3": {
    profile: "Industrial discipline chief for Kronstadt, obsessed with quotas, silence, and visible obedience.",
    habits: "Rotates from command balcony to inspection descent to ration-control offices with militarized punctuality.",
    vulnerabilities: ["Sabotage rumors pull him onto exposed review routes.", "Inspection descents briefly outrun the outer escort ring.", "He expects routine and can be deceived by confident authority presence."],
  },
};

function TargetCard({ target, selected, onSelect, onEliminate, pendingTargetId }) {
  return (
    <div
      className={`target-select-shell ${selected ? "is-selected" : ""}`}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(target.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(target.id);
        }
      }}
    >
      <article className={`panel target-card ${target.isAlive ? "" : "is-dead"}`}>
        <p className="eyebrow">High Command</p>
        <h3>{target.name}</h3>
        <p>{target.rank}</p>
        <p>Region: {target.region}</p>
        <p>Difficulty modifier: {target.difficultyModifier}</p>
        <p>Status: {target.isAlive ? "Active" : "Eliminated"}</p>
        {target.isAlive ? (
          <button
            className="button-like red-accent target-action"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onEliminate(target.id);
            }}
            disabled={pendingTargetId === target.id}
          >
            {pendingTargetId === target.id ? "Authorizing..." : "Authorize elimination"}
          </button>
        ) : null}
      </article>
    </div>
  );
}

function ThreatBar({ label, value, tone }) {
  return (
    <div className="threat-row">
      <div className="status-row"><span>{label}</span><span>{value}%</span></div>
      <div className="threat-meter"><div className={`threat-fill tone-${tone}`} style={{ width: `${value}%` }} /></div>
    </div>
  );
}

function FeedItem({ item }) {
  return (
    <article className="feed-item">
      <div className="feed-meta"><span className="red-accent">{item.type}</span><span>{item.timestamp}</span></div>
      <p>{item.text}</p>
    </article>
  );
}

export default function IntelDashboard() {
  const { world, connectionState, updateWorld, setConnectionState } = useWorldStore();
  const suspicion = useSuspicionStore((state) => state.suspicion);
  const gameOver = useSuspicionStore((state) => state.gameOver);
  const currentZoneId = useMissionStore((state) => state.currentZoneId);
  const missionPhase = useMissionStore((state) => state.missionPhase);
  const routeNote = useMissionStore((state) => state.routeNote);
  const [pendingTargetId, setPendingTargetId] = useState("");
  const [selectedTargetId, setSelectedTargetId] = useState(missionBrief.targetId);

  useEffect(() => {
    let active = true;
    async function pollWorld() {
      try {
        setConnectionState("connecting");
        const nextWorld = await fetchWorldState();
        if (!active) return;
        updateWorld(nextWorld);
        setConnectionState("connected");
      } catch (_error) {
        if (!active) return;
        setConnectionState("disconnected");
      }
    }
    pollWorld();
    const intervalId = window.setInterval(pollWorld, POLL_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [setConnectionState, updateWorld]);

  async function handleEliminate(targetId) {
    try {
      setPendingTargetId(targetId);
      setConnectionState("connecting");
      const nextWorld = await eliminateWorldTarget(targetId);
      updateWorld(nextWorld);
      setConnectionState("connected");
    } catch (_error) {
      setConnectionState("disconnected");
    } finally {
      setPendingTargetId("");
    }
  }

  const aliveTargets = useMemo(() => world.highCommand.filter((target) => target.isAlive), [world.highCommand]);
  const selectedTarget = world.highCommand.find((target) => target.id === selectedTargetId) || world.highCommand.find((target) => target.id === missionBrief.targetId) || world.highCommand[0];
  const selectedRegion = selectedTarget ? world.regions.find((region) => region.name === selectedTarget.region) : world.regions[0];
  const dossier = selectedTarget ? targetDossiers[selectedTarget.id] : null;
  const regionAlert = selectedRegion?.alertLevel === "lockdown" ? 92 : selectedRegion?.alertLevel === "curfew" ? 72 : 46;
  const regionalPressure = Math.min(100, (selectedRegion?.difficultyModifier || 1) * 18 + 24);
  const coverExposure = Math.min(100, Math.round(suspicion + regionalPressure / 3));

  return (
    <section className="dashboard-column">
      <div className="panel masthead-panel">
        <div className="status-row">
          <div>
            <p className="eyebrow red-accent">Mission Operations Console</p>
            <h2>{world.gameTime}</h2>
          </div>
          <span className={`connection-pill status-${connectionState}`}>{connectionState}</span>
        </div>

        <div className="suspicion-block">
          <div className="status-row"><span>Suspicion meter</span><span>{suspicion}%</span></div>
          <div className="suspicion-meter"><div className="suspicion-fill" style={{ width: `${suspicion}%` }} /></div>
          <p className={gameOver ? "warning-copy" : "muted-copy"}>
            {gameOver ? "Cover blown. Mission failure conditions reached." : "Blend with traffic, use the right authority layer, and keep pressure below collapse point."}
          </p>
        </div>

        {selectedTarget ? (
          <div className="dossier-hero">
            <div>
              <p className="eyebrow red-accent">Priority Dossier</p>
              <h3>{selectedTarget.name}</h3>
              <p className="dossier-rank">{selectedTarget.rank} · {selectedTarget.region}</p>
              <p className="muted-copy">{dossier?.profile || "Field reports are still being reconstructed from fragmented intercepts."}</p>
            </div>
            <div className="dossier-grid">
              <ThreatBar label="Regional pressure" value={regionalPressure} tone="pressure" />
              <ThreatBar label="Security alert" value={regionAlert} tone="alert" />
              <ThreatBar label="Cover exposure" value={coverExposure} tone="exposure" />
            </div>
          </div>
        ) : null}
      </div>

      <div className="dashboard-section mission-ops-panel">
        <div className="section-title-row"><h3>Active Mission Brief</h3><span>{missionPhase}</span></div>
        <div className="two-up dossier-detail-grid">
          <div className="panel dossier-note"><p className="eyebrow red-accent">Operation</p><p>{missionBrief.summary}</p></div>
          <div className="panel dossier-note"><p className="eyebrow red-accent">Current route note</p><p>{routeNote}</p></div>
        </div>
        <div className="mission-status-grid">
          <div className="compact-item"><strong>Focus target</strong><span>{missionBrief.title}</span></div>
          <div className="compact-item"><strong>Current zone</strong><span>{currentZoneId}</span></div>
          <div className="compact-item"><strong>Live theaters</strong><span>{world.regions.length}</span></div>
          <div className="compact-item"><strong>Active targets</strong><span>{aliveTargets.length}</span></div>
        </div>
      </div>

      <div className="dashboard-section">
        <div className="section-title-row"><h3>High Command Targets</h3><span>{aliveTargets.length} active</span></div>
        <div className="target-list">
          {world.highCommand.map((target) => (
            <TargetCard
              key={target.id}
              target={target}
              selected={selectedTarget?.id === target.id}
              onSelect={setSelectedTargetId}
              onEliminate={handleEliminate}
              pendingTargetId={pendingTargetId}
            />
          ))}
        </div>
      </div>

      {selectedTarget ? (
        <div className="dashboard-section dossier-panel">
          <div className="section-title-row"><h3>Field Assessment</h3><span>{selectedTarget.region}</span></div>
          <div className="two-up dossier-detail-grid">
            <div className="panel dossier-note"><p className="eyebrow red-accent">Pattern of life</p><p>{dossier?.habits || "Routine data remains sparse under signal suppression."}</p></div>
            <div className="panel dossier-note"><p className="eyebrow red-accent">Operational window</p><p>Conditions in {selectedTarget.region} are currently {selectedRegion?.alertLevel || "guarded"}, so the safest route is the one that looks ordinary under observation.</p></div>
          </div>
          <div className="vulnerability-list">
            {(dossier?.vulnerabilities || []).map((item) => (
              <article key={item} className="panel vulnerability-card"><p className="eyebrow red-accent">Exploit</p><p>{item}</p></article>
            ))}
          </div>
        </div>
      ) : null}

      <div className="dashboard-section two-up">
        <div className="panel">
          <div className="section-title-row"><h3>Regional Pressure</h3><span>{world.regions.length} theaters</span></div>
          <div className="compact-list">
            {world.regions.map((region) => (
              <div key={region.name} className="compact-item">
                <strong>{region.name}</strong>
                <span>Alert: {region.alertLevel}</span>
                <span>Difficulty: {region.difficultyModifier}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <div className="section-title-row"><h3>Tracked Movements</h3><span>{world.keyNpcs.length} signals</span></div>
          <div className="compact-list">
            {world.keyNpcs.map((npc) => (
              <div key={npc.id} className="compact-item">
                <strong>{npc.name}</strong>
                <span>{npc.region}</span>
                <span>{npc.currentLocation} / {npc.currentAction}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="dashboard-section">
        <div className="section-title-row"><h3>Mission Consequences</h3><span>Shared ledger</span></div>
        <div className="feed-list">
          {(world.missionConsequences || []).map((item) => <FeedItem key={item.id} item={{ type: item.region, timestamp: item.timestamp, text: item.summary }} />)}
        </div>
      </div>

      <div className="dashboard-section">
        <div className="section-title-row"><h3>Intercepted Memos and Radio Broadcasts</h3><span>Live feed</span></div>
        <div className="feed-list">
          {world.newsFeed.map((item) => <FeedItem key={item.id} item={item} />)}
        </div>
      </div>
    </section>
  );
}
