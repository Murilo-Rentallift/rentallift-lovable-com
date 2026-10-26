import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { FileText, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PresencaHeader } from "@/components/PresencaHeader";
import { getPresencaPdf, listPresenca, resendPresenca } from "@/lib/presenca.functions";

export const Route = createFileRoute("/presenca/historico")({
  head: () => ({
    meta: [
      { title: "Histórico — Lista de Presença" },
      { name: "description", content: "Histórico das listas de presença assinadas nas reuniões de segunda." },
      { property: "og:title", content: "Histórico — Lista de Presença" },
      { property: "og:description", content: "Listas de presença salvas, com PDF e reenvio ao RH." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HistoricoPage,
});

const toBR = (iso: string) => iso.split("-").reverse().join("/");

function HistoricoPage() {
  const list = useServerFn(listPresenca);
  const pdf = useServerFn(getPresencaPdf);
  const resend = useServerFn(resendPresenca);
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ["presenca"], queryFn: () => list() });

  async function ver(id: string) {
    const w = window.open("", "_blank");
    setBusy(`ver-${id}`);
    try {
      const { base64 } = await pdf({ data: { id } });
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      if (w) w.location.href = url;
      else window.location.href = url;
    } catch (e) {
      w?.close();
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function reenviar(id: string) {
    setBusy(`env-${id}`);
    try {
      await resend({ data: { id } });
      toast.success("Reenviado para o RH");
      qc.invalidateQueries({ queryKey: ["presenca"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e), { duration: 12000 });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <PresencaHeader back="/presenca" showHistory={false} />
      <main className="mx-auto max-w-6xl px-4 md:px-6 py-6 space-y-3">
        {isLoading && <p className="text-muted-foreground">Carregando…</p>}
        {!isLoading && !data?.length && <p className="text-muted-foreground">Nenhuma lista salva ainda.</p>}
        {data?.map((l) => {
          const pres = l.participantes.filter((p) => p.status === "assinado").length;
          const aus = l.participantes.filter((p) => p.status === "ausente").map((p) => p.nome);
          return (
            <div key={l.id} className="flex flex-col md:flex-row md:items-center gap-4 rounded-lg border border-border bg-card p-4">
              <div className="flex-1 space-y-1">
                <p className="font-display text-2xl font-bold">{toBR(l.data)}</p>
                <p className="text-sm">{l.assunto}</p>
                <p className="text-sm text-muted-foreground">
                  {pres} presente{pres === 1 ? "" : "s"} · ausente(s): {aus.length ? aus.join(", ") : "nenhum"}
                </p>
                {l.email_enviado_em ? (
                  <span className="inline-block rounded-full bg-success px-2 py-0.5 text-xs font-bold text-success-foreground">
                    Enviado para rh@rentallift.com
                  </span>
                ) : (
                  <span className="inline-block rounded-full bg-destructive/20 px-2 py-0.5 text-xs font-bold text-destructive">Não enviado</span>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="min-h-11" onClick={() => ver(l.id)} disabled={!!busy}>
                  {busy === `ver-${l.id}` ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileText className="h-4 w-4 mr-1" />} Ver PDF
                </Button>
                <Button className="min-h-11" onClick={() => reenviar(l.id)} disabled={!!busy}>
                  {busy === `env-${l.id}` ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />} Reenviar
                </Button>
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
}
