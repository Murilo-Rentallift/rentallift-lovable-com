import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  analyzeAndSaveMeeting,
  deleteMeeting,
  getMeeting,
  listMeetings,
} from "@/lib/meetings.functions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Mic, MicOff, Trash2, Loader2, FileText } from "lucide-react";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/reunioes")({
  head: () => ({
    meta: [
      { title: "Reuniões — Transcrição e Resumo com IA" },
      { name: "description", content: "Grave, transcreva e resuma reuniões automaticamente." },
    ],
  }),
  component: ReunioesPage,
});

function isChrome(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // Chrome (não Edge, não Opera, não Brave-detect nesse nível)
  const isChromeUA = /Chrome\//.test(ua) && !/Edg\//.test(ua) && !/OPR\//.test(ua);
  const hasSR = "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
  return isChromeUA && hasSR;
}

function ReunioesPage() {
  const chromeOk = typeof window !== "undefined" ? isChrome() : false;

  const fetchList = useServerFn(listMeetings);
  const analyzeFn = useServerFn(analyzeAndSaveMeeting);
  const delFn = useServerFn(deleteMeeting);
  const openFn = useServerFn(getMeeting);
  const qc = useQueryClient();

  const { data: meetings, isLoading } = useQuery({
    queryKey: ["meetings"],
    queryFn: () => fetchList(),
  });

  // Recording state
  const [recording, setRecording] = useState(false);
  const [finalText, setFinalText] = useState("");
  const [interim, setInterim] = useState("");
  const [title, setTitle] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const wantRunningRef = useRef(false);

  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any | null>(null);

  useEffect(() => {
    return () => {
      wantRunningRef.current = false;
      try {
        recognitionRef.current?.stop();
      } catch {}
    };
  }, []);

  const startRecording = () => {
    setErr(null);
    if (!chromeOk) return;
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (event: any) => {
      let interimStr = "";
      let finalAdd = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        const t = r[0]?.transcript ?? "";
        if (r.isFinal) finalAdd += t + " ";
        else interimStr += t;
      }
      if (finalAdd) setFinalText((prev) => (prev + finalAdd).replace(/\s+/g, " "));
      setInterim(interimStr);
    };

    rec.onerror = (e: any) => {
      if (e?.error === "no-speech" || e?.error === "aborted") return;
      setErr(`Erro no reconhecimento: ${e?.error ?? "desconhecido"}`);
    };

    rec.onend = () => {
      // Auto-restart while user wants it running (Chrome corta após silêncio)
      if (wantRunningRef.current) {
        try {
          rec.start();
        } catch {}
      } else {
        setRecording(false);
      }
    };

    recognitionRef.current = rec;
    wantRunningRef.current = true;
    try {
      rec.start();
      setRecording(true);
      if (!title) {
        const now = new Date();
        setTitle(
          `Reunião ${now.toLocaleDateString("pt-BR")} ${now.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })}`,
        );
      }
    } catch (e: any) {
      setErr(`Não foi possível iniciar: ${e?.message ?? e}`);
    }
  };

  const stopRecording = async () => {
    wantRunningRef.current = false;
    try {
      recognitionRef.current?.stop();
    } catch {}
    setRecording(false);

    const fullText = (finalText + " " + interim).trim();
    setInterim("");
    if (!fullText) {
      setErr("Nenhum texto foi transcrito.");
      return;
    }

    setAnalyzing(true);
    setErr(null);
    try {
      await analyzeFn({
        data: {
          title: title || `Reunião ${new Date().toLocaleString("pt-BR")}`,
          transcript: fullText,
        },
      });
      setFinalText("");
      setTitle("");
      qc.invalidateQueries({ queryKey: ["meetings"] });
    } catch (e: any) {
      setErr(e?.message ?? "Falha ao analisar reunião.");
    } finally {
      setAnalyzing(false);
    }
  };

  const openDetail = async (id: string) => {
    setOpenId(id);
    setDetail(null);
    try {
      const d = await openFn({ data: { id } });
      setDetail(d);
    } catch (e: any) {
      setErr(e?.message ?? "Falha ao abrir reunião.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta reunião?")) return;
    await delFn({ data: { id } });
    qc.invalidateQueries({ queryKey: ["meetings"] });
    if (openId === id) setOpenId(null);
  };

  const liveText = useMemo(() => (finalText + " " + interim).trim(), [finalText, interim]);

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="hazard-stripe h-2" />
        <div className="mx-auto max-w-6xl px-6 py-5 flex items-center gap-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
          <Logo className="h-10 w-auto" />
          <div>
            <h1 className="font-display text-2xl font-bold uppercase tracking-wide">Reuniões</h1>
            <p className="text-xs text-muted-foreground">
              Transcrição ao vivo + resumo automático com IA
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8 space-y-8">
        {/* Recording panel */}
        <section className="rounded-lg border border-border bg-card p-6 shadow-lg">
          <h2 className="font-display text-lg font-bold uppercase mb-4">Nova reunião</h2>

          {!chromeOk && (
            <div className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
              Este recurso funciona apenas no <strong>Google Chrome</strong>. Por favor, abra esta
              página pelo Chrome para gravar a reunião.
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-xs font-mono uppercase text-muted-foreground">Título</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Reunião de planejamento semanal"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                disabled={analyzing}
              />
            </div>

            <div className="flex flex-wrap gap-3">
              {!recording ? (
                <Button
                  onClick={startRecording}
                  disabled={!chromeOk || analyzing}
                  size="lg"
                  className="gap-2"
                >
                  <Mic className="h-4 w-4" /> Iniciar Reunião
                </Button>
              ) : (
                <Button
                  onClick={stopRecording}
                  variant="destructive"
                  size="lg"
                  className="gap-2"
                  disabled={analyzing}
                >
                  <MicOff className="h-4 w-4" /> Finalizar Reunião
                </Button>
              )}
              {analyzing && (
                <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Analisando com IA...
                </div>
              )}
              {recording && (
                <div className="inline-flex items-center gap-2 text-sm text-red-400">
                  <span className="inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  Gravando…
                </div>
              )}
            </div>

            {err && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive-foreground">
                {err}
              </div>
            )}

            <div>
              <label className="text-xs font-mono uppercase text-muted-foreground">
                Transcrição ao vivo
              </label>
              <div className="mt-1 min-h-40 max-h-96 overflow-y-auto rounded-md border border-input bg-background/60 p-3 text-sm whitespace-pre-wrap">
                {liveText || (
                  <span className="text-muted-foreground italic">
                    A transcrição aparecerá aqui enquanto você fala.
                  </span>
                )}
                {interim && <span className="text-muted-foreground"> {interim}</span>}
              </div>
            </div>
          </div>
        </section>

        {/* History */}
        <section>
          <h2 className="font-display text-lg font-bold uppercase mb-4">Histórico</h2>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Carregando…</div>
          ) : !meetings?.length ? (
            <div className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
              Nenhuma reunião registrada ainda.
            </div>
          ) : (
            <ul className="grid gap-3">
              {meetings.map((m: any) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border bg-card p-4"
                >
                  <button
                    className="flex-1 text-left"
                    onClick={() => openDetail(m.id)}
                  >
                    <div className="font-semibold">{m.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(m.created_at).toLocaleString("pt-BR")}
                    </div>
                    {m.summary && (
                      <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {m.summary}
                      </div>
                    )}
                  </button>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => openDetail(m.id)}>
                      <FileText className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(m.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <Dialog open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detail?.title ?? "Reunião"}</DialogTitle>
          </DialogHeader>
          {!detail ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto h-5 w-5 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4 text-sm">
              <div className="text-xs text-muted-foreground">
                {new Date(detail.created_at).toLocaleString("pt-BR")}
              </div>

              <section>
                <h3 className="font-semibold uppercase text-xs text-muted-foreground mb-1">
                  Resumo geral
                </h3>
                <p className="whitespace-pre-wrap">{detail.summary || "—"}</p>
              </section>

              <section>
                <h3 className="font-semibold uppercase text-xs text-muted-foreground mb-1">
                  Pontos críticos
                </h3>
                {detail.critical_points?.length ? (
                  <ul className="list-disc pl-5 space-y-1">
                    {detail.critical_points.map((p: string, i: number) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">Nenhum</p>
                )}
              </section>

              <section>
                <h3 className="font-semibold uppercase text-xs text-muted-foreground mb-1">
                  Decisões tomadas
                </h3>
                {detail.decisions?.length ? (
                  <ul className="list-disc pl-5 space-y-1">
                    {detail.decisions.map((p: string, i: number) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">Nenhuma</p>
                )}
              </section>

              <section>
                <h3 className="font-semibold uppercase text-xs text-muted-foreground mb-1">
                  To-do list
                </h3>
                {detail.todos?.length ? (
                  <ul className="space-y-1">
                    {detail.todos.map((t: any, i: number) => (
                      <li key={i} className="rounded border border-border p-2">
                        <div>{t.action}</div>
                        {t.responsible && (
                          <div className="text-xs text-muted-foreground">
                            Responsável: {t.responsible}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">Nenhum</p>
                )}
              </section>

              <section>
                <h3 className="font-semibold uppercase text-xs text-muted-foreground mb-1">
                  Transcrição completa
                </h3>
                <div className="max-h-60 overflow-y-auto rounded border border-border bg-background/60 p-2 whitespace-pre-wrap text-xs">
                  {detail.transcript}
                </div>
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
