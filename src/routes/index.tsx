import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { listOperators } from "@/lib/app.functions";
import { ArrowUpRight, FileText, Shield, Warehouse, Wrench } from "lucide-react";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Programação Diária — Empilhadeiras" },
      { name: "description", content: "Lousa digital de programação diária dos operadores de empilhadeira." },
      { property: "og:title", content: "Programação Diária — Empilhadeiras" },
      { property: "og:description", content: "Lousa digital de programação diária dos operadores de empilhadeira." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function useLiteMode() {
  const [lite, setLite] = useState(false);
  useEffect(() => {
    const nav = navigator as Navigator & { deviceMemory?: number };
    const weak =
      (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4;
    const check = () => setLite(weak || window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return lite;
}

function Cube({ className }: { className: string }) {
  return (
    <div className={`g3-cube ${className}`}>
      <span className="g3-face g3-f1" />
      <span className="g3-face g3-f2" />
      <span className="g3-face g3-f3" />
      <span className="g3-face g3-f4" />
      <span className="g3-face g3-f5" />
      <span className="g3-face g3-f6" />
    </div>
  );
}

function WarehouseBackground({ lite }: { lite: boolean }) {
  return (
    <div className="g3-bg" aria-hidden="true">
      <div className="g3-glow" />
      <div className="g3-ceiling" />
      <div className="g3-wall g3-wall-l" />
      <div className="g3-wall g3-wall-r" />
      <div className="g3-floor" />
      {!lite && (
        <>
          <div className="g3-beam" />
          <div className="g3-dust">
            {Array.from({ length: 18 }).map((_, i) => (
              <span
                key={i}
                style={{
                  left: `${(i * 53) % 100}%`,
                  animationDelay: `${(i * 1.7) % 14}s`,
                  animationDuration: `${12 + (i % 5) * 3}s`,
                }}
              />
            ))}
          </div>
          <div className="g3-stack">
            <Cube className="g3-c1" />
            <Cube className="g3-c2" />
            <Cube className="g3-c3" />
          </div>
          <div className="g3-small-wrap">
            <Cube className="g3-small" />
          </div>
          <div className="g3-holo">
            <div className="g3-cone" />
            <div className="g3-rings">
              <span />
              <span />
            </div>
            <svg className="g3-forklift" viewBox="0 0 200 160" fill="none" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round">
              <path d="M150 20 V140 M162 20 V140" />
              <path d="M150 130 H195 M150 118 H195" />
              <path d="M40 60 H105 L120 95 H145 V130 H40 Z" />
              <path d="M55 60 V25 H100 L110 60" />
              <path d="M30 95 H40 V130 H25 Z" />
              <circle cx="65" cy="135" r="16" />
              <circle cx="125" cy="135" r="13" />
              <circle cx="65" cy="135" r="5" />
              <circle cx="125" cy="135" r="4" />
              <path d="M150 50 H162 M150 80 H162" />
            </svg>
          </div>
        </>
      )}
    </div>
  );
}

const sectors = [
  { to: "/almoxarifado", label: "Almoxarifado", Icon: Warehouse },
  { to: "/oficina", label: "Oficina", Icon: Wrench },
  { to: "/vendas", label: "Vendas", Icon: FileText },
  { to: "/admin", label: "PCM", Icon: Shield, pcm: true },
] as const;

function Index() {
  const fetchOps = useServerFn(listOperators);
  const { data: operators, isLoading } = useQuery({
    queryKey: ["operators"],
    queryFn: () => fetchOps(),
  });
  const lite = useLiteMode();

  return (
    <div className={`g3-root min-h-screen ${lite ? "g3-lite" : ""}`}>
      <WarehouseBackground lite={lite} />
      <div className="hazard-stripe h-2 relative z-10" />

      <div className="relative z-10 mx-auto max-w-6xl px-5 py-6 md:py-10">
        <header className="g3-glass g3-header flex items-center gap-4 px-6 py-5">
          <div className="g3-logo">
            <Logo className="h-14 w-auto" />
          </div>
          <div>
            <h1 className="g3-title font-display text-2xl md:text-3xl font-bold uppercase tracking-wide">
              Lousa Digital
            </h1>
            <p className="text-sm text-muted-foreground">
              Programação diária — toque no seu nome
            </p>
          </div>
        </header>

        <main className="mt-8">
          {isLoading ? (
            <div className="g3-grid">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="g3-glass h-32 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="g3-grid">
              {operators?.map((op, i) => (
                <Link
                  key={op.id}
                  to="/operador/$id"
                  params={{ id: op.id }}
                  className="g3-card g3-glass"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <span className="g3-badge font-mono">
                    #{String(op.position).padStart(2, "0")}
                  </span>
                  <ArrowUpRight className="g3-arrow h-5 w-5" />
                  <span className="font-display text-xl md:text-2xl font-bold uppercase">
                    {op.name}
                  </span>
                </Link>
              ))}
            </div>
          )}

          <div className="g3-sectors mt-10">
            {sectors.map(({ to, label, Icon, ...rest }) => (
              <Link
                key={to}
                to={to}
                className={`g3-sector ${"pcm" in rest ? "g3-pcm" : ""}`}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
