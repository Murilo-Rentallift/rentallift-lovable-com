import { Link } from "@tanstack/react-router";
import { ArrowLeft, History } from "lucide-react";
import { Logo } from "@/components/Logo";

export function PresencaHeader({ back = "/", showHistory = true }: { back?: "/" | "/presenca"; showHistory?: boolean }) {
  return (
    <header className="border-b border-border bg-card/60">
      <div className="hazard-stripe h-2" />
      <div className="mx-auto max-w-6xl px-6 py-5 flex items-center gap-4">
        <Link to={back} className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <Logo className="h-10 w-auto" />
        <div className="flex-1">
          <h1 className="font-display text-2xl font-bold uppercase tracking-wide">Lista de Presença</h1>
          <p className="text-xs text-muted-foreground">Reunião de segunda — cada um assina ao lado do próprio nome</p>
        </div>
        {showHistory && (
          <Link
            to="/presenca/historico"
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-4 font-display text-sm uppercase tracking-wide hover:border-primary"
          >
            <History className="h-4 w-4" /> Histórico
          </Link>
        )}
      </div>
    </header>
  );
}
