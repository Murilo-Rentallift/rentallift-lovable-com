import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listOperators } from "@/lib/app.functions";
import { Shield, Warehouse } from "lucide-react";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Programação Diária — Empilhadeiras" },
      { name: "description", content: "Lousa digital de programação diária dos operadores de empilhadeira." },
    ],
  }),
  component: Index,
});

function Index() {
  const fetchOps = useServerFn(listOperators);
  const { data: operators, isLoading } = useQuery({
    queryKey: ["operators"],
    queryFn: () => fetchOps(),
  });

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="hazard-stripe h-2" />
        <div className="mx-auto max-w-6xl px-6 py-6 flex items-center gap-4">
          <Logo className="h-14 w-auto" />
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-wide">
              Lousa Digital
            </h1>
            <p className="text-sm text-muted-foreground">
              Programação diária — toque no seu nome
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-32 rounded-lg bg-card/50 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {operators?.map((op) => (
              <Link
                key={op.id}
                to="/operador/$id"
                params={{ id: op.id }}
                className="group relative overflow-hidden rounded-lg border border-border bg-card hover:border-primary transition-all p-5 h-32 flex flex-col justify-between shadow-lg"
              >
                <div className="absolute top-0 left-0 h-1 w-full bg-primary opacity-50 group-hover:opacity-100 transition-opacity" />
                <div className="text-xs font-mono text-muted-foreground uppercase">
                  #{String(op.position).padStart(2, "0")}
                </div>
                <div className="font-display text-xl md:text-2xl font-bold uppercase">
                  {op.name}
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link
            to="/almoxarifado"
            className="inline-flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-5 py-3 text-sm font-semibold uppercase tracking-wide text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            <Warehouse className="h-4 w-4" />
            Almoxarifado
          </Link>
          <Link
            to="/admin"
            className="inline-flex items-center gap-2 rounded-md border border-accent/40 bg-accent/10 px-5 py-3 text-sm font-semibold uppercase tracking-wide text-accent hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <Shield className="h-4 w-4" />
            Acesso do Administrador
          </Link>
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          PIN padrão dos operadores: <span className="font-mono text-foreground">1234</span> · Admin: <span className="font-mono text-foreground">9999</span> · Altere depois no painel
        </p>
      </main>
    </div>
  );
}
