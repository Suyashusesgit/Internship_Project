import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "T-BTN Dashboard — Pet Health Telemetry",
  description:
    "Real-time dog health monitoring dashboard. View live vitals (temperature, BPM, SpO2) and GPS location streamed from a Raspberry Pi 5 wearable device.",
  keywords: ["pet health", "dog telemetry", "IoT", "heart rate", "temperature", "GPS"],
  openGraph: {
    title: "T-BTN Dashboard",
    description: "Real-time dog health telemetry dashboard",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="page-wrapper">
          <Navbar />
          <main className="page-content">
            <div className="container">{children}</div>
          </main>
          <Footer />
        </div>
      </body>
    </html>
  );
}

function Navbar() {
  return (
    <header style={styles.navbar}>
      <div className="container" style={styles.navInner}>
        <div style={styles.navBrand}>
          <PawIcon />
          <span style={styles.navTitle}>T-BTN Dashboard</span>
          <span style={styles.navSubtitle}>Pet Health Telemetry</span>
        </div>
        <nav style={styles.navLinks}>
          <NavLink href="/" label="Live" />
          <NavLink href="/history" label="History" />
        </nav>
      </div>
    </header>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} style={styles.navLink}>
      {label}
    </Link>
  );
}

function Footer() {
  return (
    <footer style={styles.footer}>
      <div className="container" style={styles.footerInner}>
        <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
          T-BTN Dashboard · Real-time pet health monitoring
        </span>
        <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
          Data via Raspberry Pi 5 wearable · Firestore
        </span>
      </div>
    </footer>
  );
}

function PawIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="9" cy="5" r="2" fill="var(--accent)" />
      <circle cx="15" cy="5" r="2" fill="var(--accent)" />
      <circle cx="5.5" cy="9.5" r="1.8" fill="var(--accent)" />
      <circle cx="18.5" cy="9.5" r="1.8" fill="var(--accent)" />
      <path
        d="M12 9c-3.3 0-6 2.2-6 5 0 1.5.7 2.8 2 3.7.6.4 1.5 1 2.5 1.5.4.2.9.3 1.5.3s1.1-.1 1.5-.3c1-.5 1.9-1.1 2.5-1.5 1.3-.9 2-2.2 2-3.7 0-2.8-2.7-5-6-5z"
        fill="var(--accent)"
      />
    </svg>
  );
}

const styles: Record<string, React.CSSProperties> = {
  navbar: {
    position: "sticky",
    top: 0,
    zIndex: 100,
    background: "rgba(8, 12, 24, 0.85)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    borderBottom: "1px solid var(--border-subtle)",
  },
  navInner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    height: "60px",
  },
  navBrand: {
    display: "flex",
    alignItems: "center",
    gap: "var(--space-3)",
  },
  navTitle: {
    fontSize: "1rem",
    fontWeight: 700,
    color: "var(--text-primary)",
    letterSpacing: "-0.02em",
  },
  navSubtitle: {
    fontSize: "0.7rem",
    fontWeight: 500,
    color: "var(--text-muted)",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    padding: "2px 8px",
    background: "var(--bg-elevated)",
    borderRadius: "20px",
    border: "1px solid var(--border-subtle)",
    display: "none",
  },
  navLinks: {
    display: "flex",
    gap: "var(--space-2)",
  },
  navLink: {
    color: "var(--text-secondary)",
    textDecoration: "none",
    fontSize: "0.875rem",
    fontWeight: 500,
    padding: "var(--space-2) var(--space-4)",
    borderRadius: "var(--radius-md)",
    transition: "all var(--transition-fast)",
    border: "1px solid transparent",
  },
  footer: {
    borderTop: "1px solid var(--border-subtle)",
    padding: "var(--space-5) 0",
  },
  footerInner: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "var(--space-2)",
  },
};
