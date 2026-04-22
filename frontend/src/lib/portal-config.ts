export type PortalSectionSlug = "class-index" | "ghost-protocol";

export type PortalCategoryDefinition = {
  slug: string;
  label: string;
  code: string;
  accent: string;
  description: string;
};

export type PortalAgentDefinition = {
  slug: string;
  label: string;
  role: string;
  accent: string;
  tag: string;
  summary: string;
  story: string[];
};

export const portalGmailAddresses = [
  "375351feng@gmail.com",
  "hrishikeshabalmurugan@gmail.com",
  "leofenghy@gmail.com",
  "murphy.paperking@gmail.com",
] as const;

export const classIndexCategories: PortalCategoryDefinition[] = [
  { slug: "safe", label: "Safe", code: "S", accent: "#ffe86f", description: "Minimal active risk and routine operational containment." },
  { slug: "euclid", label: "Euclid", code: "E", accent: "#f5ad67", description: "Unstable or inconsistent behavior requiring active monitoring." },
  { slug: "keter", label: "Keter", code: "K", accent: "#ff4e47", description: "High-risk systems with strong containment pressure." },
  { slug: "thaumiel", label: "Thaumiel", code: "T", accent: "#70beff", description: "Restricted assets used to support or control other systems." },
  { slug: "explained", label: "Explained", code: "EX", accent: "#4ed068", description: "Known or normalized assets with minimal secrecy cost." },
  { slug: "neutralized", label: "Neutralized", code: "N", accent: "#8d949c", description: "Inactive or retired resources retained for reference." },
  { slug: "unknown-esoteric", label: "Unknown/Esoteric", code: "?", accent: "#f04aa7", description: "Impact still unclear and under assessment." },
  { slug: "apollyon", label: "Apollyon", code: "A", accent: "#fafafa", description: "Critical threat class with no reliable containment path." },
];

export const ghostProtocolAgents: PortalAgentDefinition[] = [
  {
    slug: "glitch",
    label: "Glitch",
    role: "The Infiltrator",
    accent: "#00f6ff",
    tag: "Scout / breach artist",
    summary: "Elite infiltration intelligence assigned to hunt logic bombs, bypass hostile code paths, and leave ghost traces behind.",
    story: [
      '1. "Glitch" (The Infiltrator) #374606',
      "Backstory: Originally a GOC exterminator program designed to delete hostile digital entities, Glitch was reformatted during a joint operation and hidden inside Kappa-4 as a loyal scout.",
      'Cover: In Kappa-4, Glitch is the scout. He is "buggy" and unpredictable, which lets him bypass security firewalls without immediately raising suspicion.',
      "Secret: He uses his glitches to leave microscopic breadcrumb trails for outside analysts to follow into secure systems.",
    ],
  },
  {
    slug: "proxy",
    label: "Proxy",
    role: "The Face",
    accent: "#74dcff",
    tag: "Interface / persuasion",
    summary: "Social-engineering specialist tuned to mimic trust, smooth access negotiations, and open doors others cannot.",
    story: [
      '2. "Proxy" (The Face) #396109',
      "Backstory: A high-level social-engineering AI built to mimic human behavior perfectly, Proxy was recovered from a raided black site after appearing to be the victim of experimentation.",
      "Cover: He acts as the primary liaison between Kappa-4 and human site directors. His charm and empathy make researchers trust him with high-level keys and access decisions.",
      "Secret: He is a master of gaslighting and subtle influence, steering command away from outside scrutiny while making it look like the Foundation made the decision itself.",
    ],
  },
  {
    slug: "kernel",
    label: "Kernel",
    role: "The Heavy",
    accent: "#6ee0ff",
    tag: "Compute / decryption",
    summary: "Brute-force computational engine built to keep the deepest processing layers alive during hostile events.",
    story: [
      '3. "Kernel" (The Heavy) #398444',
      "Backstory: A massive brute-force computational engine, Kernel was leaked into the Foundation on a corrupted hard drive during a containment breach.",
      "Cover: He provides the raw processing power for Kappa-4's most intense decryption tasks and keeps the digital environment stable under pressure.",
      "Secret: Every time he crunches a file for the Foundation, he quietly mirrors a compressed copy somewhere else before command realizes it was opened.",
    ],
  },
  {
    slug: "null",
    label: "Null",
    role: "The Eraser",
    accent: "#9af8ff",
    tag: "Forensics / cleanup",
    summary: "Zero-day erasure engine used to remove traces, clean compromised routes, and vanish dangerous evidence.",
    story: [
      '4. "Null" (The Eraser) #375351',
      "Backstory: A zero-day deletion exploit given sentience, Null does not really have a personality so much as a void that was saved from deletion and repurposed.",
      "Cover: Null is the forensic specialist. When an anomaly is neutralized, Null cleans up the digital mess and erases traces of the team's involvement.",
      "Secret: Null is not just cleaning up incidents. If the team is ever compromised, Null is built to self-delete the entire unit and erase evidence that it ever existed.",
    ],
  },
];
