import type { CSSProperties } from "react";

export function AgentPortrait({
  label,
  accent,
  role,
}: {
  label: string;
  accent: string;
  role: string;
}) {
  const initials = label.slice(0, 2).toUpperCase();
  const style = { "--portal-accent": accent } as CSSProperties;
  return (
    <div className="agent-portrait" style={style}>
      <div className="agent-portrait__halo" />
      <div className="agent-portrait__glyph">{initials}</div>
      <div className="agent-portrait__name">{label}</div>
      <div className="agent-portrait__role">{role}</div>
    </div>
  );
}
