import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { oficinaLogin, oficinaCreateRequest, oficinaListRequests } from "@/lib/app.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Lock, Wrench, Send } from "lucide-react";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/oficina")({
  head: () => ({ meta: [{ title: "Oficina — Requisição de Peças" }] }),
  component: OficinaPage,
});

type Req = {
  id: string;
  requester_name: string;
  part_name: string;
  quantity: number;
  code: string;
  status: string;
  created_at: string;
};

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pendente: { label: "Pendente", cls: "bg-accent/20 text-accent border-accent/40" },
  separado: { label: "Separado", cls: "bg-blue-500/20 text-blue-400 border-blue-500/40" },
  em_falta: { label: "Em falta", cls: "bg-red-500/20 text-red-400 border-red-500/40" },
  entregue: { label: "Entregue", cls: "bg-green-500/20 text-green-500 border-green-500/40" },
};

function OficinaPage() {
  const doLogin = useServerFn(oficinaLogin);
  const create = useServerFn(oficinaCreateRequest);
  const listMine = useServerFn(oficinaListRequests);

  const [pin, setPin] = useState("");
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);

  const [requesterName, setRequesterName] = useState("");
  const [partName, setPartName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [requests, setRequests] = useState<Req[]>([]);

  async function refresh(currentPin: string) {
    try {
      const res = await listMine({ data: { pin: currentPin } });
      setRequests(res.requests as Req[]);
    } catch (e: any) {
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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!requesterName.trim() || !partName.trim()) {
      toast.error("Preencha solicitante e peça");
      return;
    }
    setSubmitting(true);
    try {
      await create({
        data: { pin, requesterName: requesterName.trim(), partName: partName.trim(), quantity, code: code.trim() },
      });
      toast.success("Requisição enviada ao almoxarifado");
      setPartName("");
      setQuantity(1);
      setCode("");
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
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="who">Solicitante</Label>
              <Input id="who" value={requesterName} onChange={(e) => setRequesterName(e.target.value)} placeholder="Nome de quem solicitou" maxLength={100} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="part">Peça</Label>
              <Input id="part" value={partName} onChange={(e) => setPartName(e.target.value)} placeholder="Nome da peça" maxLength={200} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="qty">Quantidade</Label>
              <Input
                id="qty"
                type="number"
                min={1}
                max={9999}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Math.min(9999, parseInt(e.target.value, 10) || 1)))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="code">Código</Label>
              <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Código da peça" maxLength={100} />
            </div>
          </div>
          <Button type="submit" disabled={submitting} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Send className="h-4 w-4 mr-2" />
            {submitting ? "Enviando..." : "Enviar para o almoxarifado"}
          </Button>
        </form>

        <section className="rounded-lg border border-border bg-card">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="font-display text-sm uppercase tracking-wider">Minhas requisições</h2>
            <span className="text-xs text-muted-foreground">{requests.length} {requests.length === 1 ? "item" : "itens"}</span>
          </div>
          {requests.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma requisição registrada ainda.</p>
          ) : (
            <ul className="divide-y divide-border">
              {requests.map((r) => {
                const st = STATUS_LABELS[r.status] ?? STATUS_LABELS.pendente;
                return (
                  <li key={r.id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium">{r.part_name} <span className="text-muted-foreground">× {r.quantity}</span></div>
                      <div className="text-xs text-muted-foreground">
                        {r.requester_name}{r.code ? ` · cód. ${r.code}` : ""} · {new Date(r.created_at).toLocaleString("pt-BR")}
                      </div>
                    </div>
                    <span className={`rounded border px-2 py-1 text-xs uppercase font-semibold ${st.cls}`}>{st.label}</span>
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
