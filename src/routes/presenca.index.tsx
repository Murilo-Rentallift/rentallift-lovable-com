import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Eraser, Loader2, Plus, Send, UserX, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SignaturePad } from "@/components/SignaturePad";
import { PresencaHeader } from "@/components/PresencaHeader";
import { savePresenca } from "@/lib/presenca.functions";

export const Route = createFileRoute("/presenca/")({
  head: () => ({
    meta: [
      { title: "Lista de Presença — Reunião de Segunda" },
      { name: "description", content: "Lista de presença com assinaturas no iPad para a reunião de planejamento semanal." },
      { property: "og:title", content: "Lista de Presença — Reunião de Segunda" },
      { property: "og:description", content: "Assinaturas da reunião de planejamento semanal com envio ao RH." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PresencaPage,
});

const ASSUNTO = "Planejamento semanal";
const PADRAO = ["Evandro Rosolen", "Rildo Lavardi", "William Dalgesso", "Murilo Rosolen", "Lucas Pinelli"];

type Row = { key: number; nome: string; sig: string; ausente: boolean; padKey: number };

let seq = 0;
const makeRows = (): Row[] => PADRAO.map((nome) => ({ key: ++seq, nome, sig: "", ausente: false, padKey: 0 }));

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const toBR = (iso: string) => iso.split("-").reverse().join("/");

function PresencaPage() {
  const save = useServerFn(savePresenca);
  const qc = useQueryClient();
  const [rows, setRows] = useState<Row[]>(() => makeRows());
  const [iso, setIso] = useState("");
  const [adding, setAdding] = useState(false);
  const [novo, setNovo] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => setIso(todayISO()), []);

  const upd = (key: number, patch: Partial<Row>) => setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  const assinados = rows.filter((r) => !r.ausente && r.sig).length;
  const ausentes = rows.filter((r) => r.ausente).length;
  const pend = rows.filter((r) => !r.ausente && !r.sig);
  const ready = pend.length === 0 && assinados > 0 && !!iso;

  async function gerar() {
    if (!ready) return;
    setBusy(true);
    try {
      const { buildPresencaPdf } = await import("@/lib/presencaPdf");
      const presentes = rows.filter((r) => !r.ausente && r.sig);
      const doc = await buildPresencaPdf({
        dataBR: toBR(iso),
        assunto: ASSUNTO,
        rows: presentes.map((r) => ({ nome: r.nome, assinatura: r.sig })),
      });
      const fileName = `Lista_Presenca_${iso}.pdf`;
      doc.save(fileName);
      const dataUri = doc.output("datauristring");
      const pdfBase64 = dataUri.slice(dataUri.indexOf(",") + 1);
      let ordem = 0;
      const res = await save({
        data: {
          data: iso,
          assunto: ASSUNTO,
          participantes: rows.map((r) => ({
            nome: r.nome,
            status: r.ausente ? ("ausente" as const) : ("assinado" as const),
            ordem: r.ausente ? 0 : ++ordem,
          })),
          pdfBase64,
        },
      });
      qc.invalidateQueries({ queryKey: ["presenca"] });
      if (res.emailOk) {
        toast.success("PDF gerado, salvo no histórico e enviado para o RH");
      } else {
        toast.error(`PDF salvo no histórico, mas o e-mail falhou. Use "Reenviar" no histórico. ${res.emailError ?? ""}`, { duration: 12000 });
      }
      setRows(makeRows());
      setAdding(false);
      setNovo("");
    } catch (e) {
      toast.error(`Erro: ${e instanceof Error ? e.message : String(e)}`, { duration: 12000 });
    } finally {
      setBusy(false);
    }
  }

  function adicionar() {
    const n = novo.trim();
    if (!n) return;
    setRows((r) => [...r, { key: ++seq, nome: n, sig: "", ausente: false, padKey: 0 }]);
    setNovo("");
    setAdding(false);
  }

  return (
    <div className="min-h-screen bg-background">
      <PresencaHeader />
      <main className="mx-auto max-w-6xl px-4 md:px-6 py-6 space-y-6">
        <section className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Data · automática</span>
            <Input readOnly value={iso ? toBR(iso) : ""} className="h-12 font-mono text-lg" />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Assunto</span>
            <Input readOnly value={ASSUNTO} className="h-12 text-lg" />
          </label>
        </section>

        <section className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="hidden md:grid grid-cols-[3rem_14rem_1fr_9rem] gap-3 border-b border-border px-4 py-3 font-display text-xs uppercase tracking-wider text-muted-foreground">
            <span>Nº</span><span>Nome</span><span>Assinatura</span><span>Ações</span>
          </div>
          {rows.map((r, i) => (
            <div
              key={r.key}
              className="grid grid-cols-[2.5rem_1fr] md:grid-cols-[3rem_14rem_1fr_9rem] gap-3 items-center border-b border-border px-4 py-3"
            >
              <span className="font-mono text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
              <span className={`font-display text-lg uppercase ${r.ausente ? "line-through text-muted-foreground/60" : ""}`}>{r.nome}</span>
              <div className="col-span-2 md:col-span-1">
                {r.ausente ? (
                  <div className="flex h-24 items-center justify-center rounded-md border border-dashed border-destructive/50 bg-destructive/10 text-sm font-semibold text-destructive">
                    AUSENTE — não aparece no PDF
                  </div>
                ) : (
                  <div className={`relative rounded-md border-2 ${r.sig ? "border-primary" : "border-transparent"}`}>
                    <SignaturePad
                      key={`${r.key}-${r.padKey}`}
                      value=""
                      onChange={(v) => upd(r.key, { sig: v })}
                      ink="#10223f"
                      background="#f4f6f9"
                      placeholder=""
                      hideClear
                      baseline
                      canvasClassName="h-24"
                    />
                    {r.sig && (
                      <span className="absolute top-1.5 right-1.5 inline-flex items-center gap-1 rounded-full bg-success px-2 py-0.5 text-xs font-bold text-success-foreground">
                        <CheckCircle2 className="h-3 w-3" /> Assinado
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="col-span-2 md:col-span-1 flex gap-2 md:flex-col">
                {!r.ausente && (
                  <Button variant="outline" className="min-h-11 flex-1" onClick={() => upd(r.key, { sig: "", padKey: r.padKey + 1 })}>
                    <Eraser className="h-4 w-4 mr-1" /> Limpar
                  </Button>
                )}
                {r.ausente ? (
                  <Button variant="outline" className="min-h-11 flex-1" onClick={() => upd(r.key, { ausente: false, padKey: r.padKey + 1 })}>
                    <Undo2 className="h-4 w-4 mr-1" /> Desfazer
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="min-h-11 flex-1 border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20"
                    onClick={() => upd(r.key, { ausente: true, sig: "" })}
                  >
                    <UserX className="h-4 w-4 mr-1" /> Ausente
                  </Button>
                )}
              </div>
            </div>
          ))}
          <div className="p-4">
            {adding ? (
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  autoFocus
                  value={novo}
                  onChange={(e) => setNovo(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && adicionar()}
                  placeholder="Nome do participante"
                  className="h-11"
                  maxLength={120}
                />
                <Button className="min-h-11" onClick={adicionar} disabled={!novo.trim()}>Adicionar</Button>
                <Button variant="ghost" className="min-h-11" onClick={() => { setAdding(false); setNovo(""); }}>Cancelar</Button>
              </div>
            ) : (
              <button
                onClick={() => setAdding(true)}
                className="w-full min-h-12 rounded-md border-2 border-dashed border-border font-display uppercase tracking-wide text-muted-foreground hover:border-primary hover:text-foreground inline-flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" /> Adicionar participante
              </button>
            )}
          </div>
        </section>

        <section className="flex flex-col md:flex-row md:items-center gap-4 rounded-lg border border-border bg-card p-4">
          <div className="flex-1">
            <p className="font-display text-lg">
              {assinados} de {rows.length} assinaram · {ausentes} ausente{ausentes === 1 ? "" : "s"} · {pend.length} pendente{pend.length === 1 ? "" : "s"}
            </p>
            {pend.length > 0 && (
              <p className="text-sm text-accent">Falta assinar ou marcar ausente: {pend.map((p) => p.nome).join(", ")}</p>
            )}
          </div>
          <Button size="lg" className="min-h-12 font-display uppercase tracking-wide" disabled={!ready || busy} onClick={gerar}>
            {busy ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Send className="h-5 w-5 mr-2" />}
            Gerar PDF e enviar
          </Button>
        </section>
      </main>
    </div>
  );
}
