import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { oficinaLogin, oficinaCreateRequest, oficinaListRequests } from "@/lib/app.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Lock, Wrench, Send, Plus, Trash2 } from "lucide-react";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/oficina")({
  head: () => ({ meta: [{ title: "Oficina — Requisição de Peças" }] }),
  component: OficinaPage,
});

type ReqItem = {
  id: string;
  part_name: string;
  quantity: number;
  code: string;
  status: string;
};

type ReqGroup = {
  group_id: string;
  requester_name: string;
  created_at: string;
  items: ReqItem[];
};

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pendente: { label: "Pendente", cls: "bg-accent/20 text-accent border-accent/40" },
  separado: { label: "Separado", cls: "bg-blue-500/20 text-blue-400 border-blue-500/40" },
  em_falta: { label: "Em falta", cls: "bg-red-500/20 text-red-400 border-red-500/40" },
  entregue: { label: "Entregue", cls: "bg-green-500/20 text-green-500 border-green-500/40" },
};

type Line = { partName: string; quantity: number; code: string };

function OficinaPage() {
  const doLogin = useServerFn(oficinaLogin);
  const create = useServerFn(oficinaCreateRequest);
  const listMine = useServerFn(oficinaListRequests);

  const [pin, setPin] = useState("");
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);

  const [requesterName, setRequesterName] = useState("");
  const [lines, setLines] = useState<Line[]>([{ partName: "", quantity: 1, code: "" }]);
  const [submitting, setSubmitting] = useState(false);

  const [requests, setRequests] = useState<ReqGroup[]>([]);

  async function refresh(currentPin: string) {
    try {
      const res = await listMine({ data: { pin: currentPin } });
      setRequests(res.requests as ReqGroup[]);
    } catch {
      // ignore
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await doLogin({ data: { pin } });
      setAuthed(true);
      await refresh(pin);
    } catch (e: any) {
      toast.error(e.message || "Falha ao entrar");
    } finally {
      setLoading(false);
    }
  }

  function addLine() {
    setLines((prev) => [...prev, { partName: "", quantity: 1, code: "" }]);
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateLine(idx: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!requesterName.trim()) {
      toast.error("Preencha o nome do solicitante");
      return;
    }
    const validItems = lines.filter((l) => l.partName.trim());
    if (validItems.length === 0) {
      toast.error("Adicione pelo menos uma peça");
      return;
    }
    setSubmitting(true);
    try {
      await create({
        data: {
          pin,
          requesterName: requesterName.trim(),
          items: validItems.map((l) => ({
            partName: l.partName.trim(),
            quantity: l.quantity,
            code: l.code.trim(),
          })),
        },
      });
      toast.success(`Requisição com ${validItems.length} peça(s) enviada ao almoxarifado`);
      setLines([{ partName: "", quantity: 1, code: "" }]);
      await refresh(pin);
    } catch (e: any) {
      toast.error(e.message || "Falha ao enviar");
    } finally {
      setSubmitting(false);
    }
  }

  if (!authed) {
    return (
      <div className="min-h-screen grid place-items-center px-4">
        <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-card p-6 shadow-xl">
          <div className="flex items-center gap-3">
            <Logo className="h-10 w-auto" />
            <div>
              <h1 className="font-display text-xl font-bold uppercase">Oficina</h1>
              <p className="text-xs text-muted-foreground">Acesso restrito</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pin">PIN da Oficina</Label>
            <Input
              id="pin"
              type="password"
              inputMode="numeric"
              maxLength={8}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="••••"
              autoFocus
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading || pin.length < 4}>
            <Lock className="h-4 w-4 mr-2" />
            {loading ? "Entrando..." : "Entrar"}
          </Button>
          <Link to="/" className="block text-center text-xs text-muted-foreground hover:text-foreground">
            ← Voltar
          </Link>
        </form>
      </div>
    );
  }

  const totalItems = requests.reduce((acc, r) => acc + r.items.length, 0);

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="hazard-stripe h-2" />
        <div className="mx-auto max-w-4xl px-6 py-4 flex items-center gap-3">
          <Link to="/" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <Logo className="h-10 w-auto" />
          <div>
            <h1 className="font-display text-xl md:text-2xl font-bold uppercase flex items-center gap-2">
              <Wrench className="h-5 w-5" /> Oficina
            </h1>
            <p className="text-xs text-muted-foreground">Requisição de peças ao almoxarifado</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8 space-y-6">
        <form onSubmit={handleCreate} className="rounded-lg border border-border bg-card p-5 space-y-4">
          <h2 className="font-display text-sm uppercase tracking-wider text-muted-foreground">Nova requisição</h2>
          <div className="space-y-1">
            <Label htmlFor="who">Solicitante</Label>
            <Input id="who" value={requesterName} onChange={(e) => setRequesterName(e.target.value)} placeholder="Nome de quem solicitou" maxLength={100} />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Peças</Label>
              <Button type="button" variant="outline" size="sm" onClick={addLine} className="gap-1">
                <Plus className="h-3.5 w-3.5" /> Adicionar peça
              </Button>
            </div>
            {lines.map((line, idx) => (
              <div key={idx} className="grid gap-2 md:grid-cols-[1fr_100px_1fr_auto] items-end border border-border rounded-md p-3">
                <div className="space-y-1">
                  <Label className="text-xs">Peça</Label>
                  <Input
                    value={line.partName}
                    onChange={(e) => updateLine(idx, { partName: e.target.value })}
                    placeholder="Nome da peça"
                    maxLength={200}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Qtd</Label>
                  <Input
                    type="number"
                    min={1}
                    max={9999}
                    value={line.quantity}
                    onChange={(e) => updateLine(idx, { quantity: Math.max(1, Math.min(9999, parseInt(e.target.value, 10) || 1)) })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Código</Label>
                  <Input
                    value={line.code}
                    onChange={(e) => updateLine(idx, { code: e.target.value })}
                    placeholder="Código da peça"
                    maxLength={100}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  onClick={() => removeLine(idx)}
                  disabled={lines.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <Button type="submit" disabled={submitting} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Send className="h-4 w-4 mr-2" />
            {submitting ? "Enviando..." : `Enviar ${lines.filter((l) => l.partName.trim()).length || ""} peça(s) para o almoxarifado`}
          </Button>
        </form>

        <section className="rounded-lg border border-border bg-card">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="font-display text-sm uppercase tracking-wider">Minhas requisições</h2>
            <span className="text-xs text-muted-foreground">{requests.length} {requests.length === 1 ? "requisição" : "requisições"} · {totalItems} {totalItems === 1 ? "item" : "itens"}</span>
          </div>
          {requests.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma requisição registrada ainda.</p>
          ) : (
            <ul className="divide-y divide-border">
              {requests.map((r) => {
                const allStatus = r.items.map((i) => i.status);
                const dominantStatus = allStatus[0] ?? "pendente";
                const st = STATUS_LABELS[dominantStatus] ?? STATUS_LABELS.pendente;
                return (
                  <li key={r.group_id} className="px-4 py-4 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium">{r.requester_name}</div>
                      <span className={`rounded border px-2 py-1 text-xs uppercase font-semibold ${st.cls}`}>{st.label}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</div>
                    <ul className="mt-2 space-y-1 pl-3 border-l-2 border-border">
                      {r.items.map((item) => (
                        <li key={item.id} className="text-sm">
                          {item.part_name} <span className="text-muted-foreground">× {item.quantity}</span>
                          {item.code ? <span className="text-muted-foreground ml-1">· cód. {item.code}</span> : null}
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
