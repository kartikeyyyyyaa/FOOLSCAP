import Dashboard from "@/components/Dashboard";
import NavAuth from "@/components/NavAuth";
import ThemeToggle from "@/components/ThemeToggle";

export const metadata = {
  title: "Your ledger",
};

export default function DashboardPage() {
  return (
    <>
      <section className="hero" style={{ paddingBottom: 0 }}>
        <div className="mesh" aria-hidden="true" style={{ height: 380, opacity: 0.5 }} />
        <div className="mesh-fade" aria-hidden="true" />

        <div className="wrap">
          <nav className="nav">
            <a className="logo" href="/">
              <span className="logo-mark" aria-hidden="true" />
              <span className="logo-name">Foolscap</span>
            </a>
            <div className="nav-right">
              <div className="nav-links">
                <a href="/">Home</a>
                <a href="/#tool">Try it</a>
              </div>
              <ThemeToggle />
              <NavAuth />
              <a className="btn btn-fill btn-sm" href="/#tool">
                New sheet
              </a>
            </div>
          </nav>
        </div>
      </section>

      <div className="wrap">
        <Dashboard />
      </div>
    </>
  );
}
