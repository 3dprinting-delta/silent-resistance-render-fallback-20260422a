import Link from "next/link";
import { SignOutButton } from "@/components/auth/SignOutButton";

const navItems = [
  { href: "/", label: "Home", key: "home" },
  { href: "/class-index", label: "Class Index", key: "class-index" },
  { href: "/ghost-protocol", label: "Ghost Protocol", key: "ghost-protocol" },
  { href: "/access-requests", label: "Access Requests", key: "access-requests" },
] as const;

export function PortalNav({ active }: { active: "home" | "class-index" | "ghost-protocol" | "access-requests" }) {
  return (
    <header className="portal-nav-shell">
      <div className="portal-brand">
        <div className="portal-brand-mark">K4</div>
        <div>
          <div className="portal-brand-title">kappa-4</div>
          <div className="portal-brand-subtitle">classified subsystem registry</div>
        </div>
      </div>

      <nav className="portal-nav-links" aria-label="Primary">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href} className={`portal-nav-link ${active === item.key ? "is-active" : ""}`}>
            {item.label}
          </Link>
        ))}
      </nav>

      <SignOutButton />
    </header>
  );
}
