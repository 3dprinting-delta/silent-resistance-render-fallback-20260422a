type ClassificationVariant =
  | "safe"
  | "euclid"
  | "keter"
  | "thaumiel"
  | "explained"
  | "neutralized"
  | "unknown-esoteric"
  | "apollyon";

function normalizeVariant(value: string): ClassificationVariant {
  switch (value) {
    case "safe":
    case "euclid":
    case "keter":
    case "thaumiel":
    case "explained":
    case "neutralized":
    case "unknown-esoteric":
    case "apollyon":
      return value;
    default:
      return "safe";
  }
}

function OuterShell() {
  return (
    <g fill="#000">
      <path d="M76 2 H124 L128 30 H72 Z" />
      <path d="M17 122 L43 102 L63 140 L29 158 Z" />
      <path d="M183 122 L157 102 L137 140 L171 158 Z" />
      <circle cx="100" cy="90" r="70" />
    </g>
  );
}

function RingCuts({ radius, width, color }: { radius: number; width: number; color: string }) {
  return (
    <>
      <circle cx="100" cy="90" r={radius} fill="none" stroke={color} strokeWidth={width} />
      <rect x="96" y={90 - radius - width / 2} width="8" height={width + 8} fill="#000" />
      <rect x="96" y={90 + radius - width / 2 - 8} width="8" height={width + 8} fill="#000" />
      <rect x={100 - radius - width / 2} y="86" width={width + 8} height="8" fill="#000" />
      <rect x={100 + radius - width / 2 - 8} y="86" width={width + 8} height="8" fill="#000" />
    </>
  );
}

function SafeIcon() {
  return (
    <>
      <OuterShell />
      <circle cx="100" cy="90" r="54" fill="#ffe96e" />
      <circle cx="100" cy="90" r="42" fill="#fff0a5" stroke="#000" strokeWidth="2.5" />
      <text x="100" y="103" textAnchor="middle" fontSize="38" fontWeight="800" fill="#000">
        S
      </text>
    </>
  );
}

function EuclidIcon() {
  return (
    <>
      <OuterShell />
      <circle cx="100" cy="90" r="54" fill="#ffb66f" />
      <circle cx="100" cy="90" r="42" fill="#ffb66f" />
      <RingCuts radius={50} width={8} color="#000" />
      <text x="100" y="103" textAnchor="middle" fontSize="38" fontWeight="800" fill="#000">
        E
      </text>
    </>
  );
}

function KeterIcon() {
  return (
    <>
      <OuterShell />
      <circle cx="100" cy="90" r="54" fill="none" stroke="#ff4a47" strokeWidth="8" />
      <circle cx="100" cy="90" r="42" fill="none" stroke="#ff4a47" strokeWidth="8" />
      <circle cx="100" cy="90" r="28" fill="#ff4a47" />
      <RingCuts radius={50} width={8} color="#000" />
      <RingCuts radius={38} width={8} color="#000" />
      <text x="100" y="103" textAnchor="middle" fontSize="36" fontWeight="800" fill="#000">
        K
      </text>
    </>
  );
}

function ThaumielIcon() {
  return (
    <>
      <OuterShell />
      <circle cx="100" cy="90" r="56" fill="none" stroke="#68b8ff" strokeWidth="8" />
      <circle cx="100" cy="90" r="43" fill="none" stroke="#68b8ff" strokeWidth="8" />
      <circle cx="100" cy="90" r="30" fill="none" stroke="#68b8ff" strokeWidth="8" />
      <circle cx="100" cy="90" r="18" fill="#000" />
      <RingCuts radius={52} width={8} color="#000" />
      <RingCuts radius={39} width={8} color="#000" />
      <RingCuts radius={26} width={8} color="#000" />
      <text x="100" y="101" textAnchor="middle" fontSize="30" fontWeight="800" fill="#68b8ff">
        T
      </text>
    </>
  );
}

function ExplainedIcon() {
  return (
    <>
      <OuterShell />
      <circle cx="100" cy="90" r="55" fill="#000" stroke="#50d764" strokeWidth="9" />
      <circle cx="100" cy="90" r="36" fill="#000" />
      <text x="100" y="101" textAnchor="middle" fontSize="26" fontWeight="800" fill="#50d764">
        EX
      </text>
    </>
  );
}

function NeutralizedIcon() {
  return (
    <>
      <OuterShell />
      <circle cx="100" cy="90" r="55" fill="#8f9399" />
      <line x1="60" y1="50" x2="88" y2="78" stroke="#000" strokeWidth="11" strokeLinecap="round" />
      <line x1="140" y1="50" x2="112" y2="78" stroke="#000" strokeWidth="11" strokeLinecap="round" />
      <line x1="60" y1="130" x2="88" y2="102" stroke="#000" strokeWidth="11" strokeLinecap="round" />
      <line x1="140" y1="130" x2="112" y2="102" stroke="#000" strokeWidth="11" strokeLinecap="round" />
      <circle cx="100" cy="90" r="23" fill="#000" />
      <text x="100" y="101" textAnchor="middle" fontSize="34" fontWeight="800" fill="#8f9399">
        N
      </text>
    </>
  );
}

function UnknownIcon() {
  return (
    <>
      <OuterShell />
      <circle cx="100" cy="90" r="54" fill="none" stroke="#f04ab1" strokeWidth="8" />
      <circle cx="100" cy="90" r="41" fill="none" stroke="#f04ab1" strokeWidth="8" />
      <circle cx="100" cy="90" r="26" fill="#f04ab1" />
      <text x="100" y="102" textAnchor="middle" fontSize="38" fontWeight="800" fill="#000">
        ?
      </text>
    </>
  );
}

function ApollyonIcon() {
  return (
    <>
      <g fill="none" stroke="#000" strokeWidth="14" strokeLinecap="round">
        <path d="M94 8 A84 84 0 0 1 146 25" />
        <path d="M176 66 A84 84 0 0 1 176 114" />
        <path d="M146 155 A84 84 0 0 1 94 172" />
        <path d="M54 155 A84 84 0 0 1 24 114" />
        <path d="M24 66 A84 84 0 0 1 54 25" />
      </g>
      <g fill="none" stroke="#000" strokeWidth="9" strokeLinecap="round">
        <path d="M100 43 A47 47 0 0 1 132 56" />
        <path d="M147 90 A47 47 0 0 1 132 124" />
        <path d="M68 124 A47 47 0 0 1 53 90" />
        <path d="M68 56 A47 47 0 0 1 100 43" />
      </g>
      <circle cx="100" cy="90" r="28" fill="#fff" />
      <text x="100" y="103" textAnchor="middle" fontSize="38" fontWeight="800" fill="#000">
        A
      </text>
    </>
  );
}

function renderVariant(variant: ClassificationVariant) {
  switch (variant) {
    case "safe":
      return <SafeIcon />;
    case "euclid":
      return <EuclidIcon />;
    case "keter":
      return <KeterIcon />;
    case "thaumiel":
      return <ThaumielIcon />;
    case "explained":
      return <ExplainedIcon />;
    case "neutralized":
      return <NeutralizedIcon />;
    case "unknown-esoteric":
      return <UnknownIcon />;
    case "apollyon":
      return <ApollyonIcon />;
  }
}

export function ClassificationIcon({
  variant,
  label,
  size = "default",
}: {
  variant: string;
  label: string;
  size?: "default" | "large";
}) {
  const resolvedVariant = normalizeVariant(variant);
  return (
    <div className={`classification-icon ${size === "large" ? "classification-icon-large" : ""}`} aria-label={label}>
      <svg viewBox="0 0 200 180" className="classification-icon__svg" role="img" aria-hidden="true">
        {renderVariant(resolvedVariant)}
      </svg>
    </div>
  );
}
