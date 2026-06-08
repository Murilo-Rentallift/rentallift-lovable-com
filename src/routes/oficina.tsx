import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  oficinaLogin,
  oficinaCreateRequest,
  oficinaListRequests,
  oficinaListWorkshopItems,
  oficinaCreateWorkshopItem,
  oficinaUpdateWorkshopItem,
  oficinaDeleteWorkshopItem,
  oficinaListToolLoans,
  oficinaCreateToolLoan,
  oficinaUpdateToolLoan,
  oficinaReturnToolLoan,
  oficinaDeleteToolLoan,
} from "@/lib/app.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft,
  Lock,
  Wrench,
  Send,
  Plus,
  Trash2,
  Package,
  HardHat,
  ClipboardList,
  AlertTriangle,
  Check,
} from "lucide-react";
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

const WORKSHOP_STATUSES = [
  { value: "aguardando_orcamento", label: "Aguardando Orçamento" },
  { value: "orcamento_aguardando_aprovacao", label: "Orçamento Aguardando Aprovação" },
  { value: "aprovado", label: "Aprovado" },
] as const;

type Line = { partName: string; quantity: number; code: string };
type TabKey = "requisicao" | "itens" | "saida";

function OficinaPage() {
  const doLogin = useServerFn(oficinaLogin);
  const [pin, setPin] = useState("");
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<TabKey>("requisicao");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await doLogin({ data: { pin } });
      setAuthed(true);
    } catch (e: any) {
      toast.error(e.message || "Falha ao entrar");
    } finally {
      setLoading(false);
    }
  }

  if (!authed) {
    return (
      <div className="min-h-screen grid place-items-center px-4">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-card p-6 shadow-xl"
        >
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
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center gap-3">
          <Link to="/" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <Logo className="h-10 w-auto" />
          <div>
            <h1 className="font-display text-xl md:text-2xl font-bold uppercase flex items-center gap-2">
              <Wrench className="h-5 w-5" /> Oficina
            </h1>
            <p className="text-xs text-muted-foreground">Gestão da oficina</p>
          </div>
        </div>
        <nav className="mx-auto max-w-5xl px-6 pb-3 flex flex-wrap gap-2">
          <TabBtn active={tab === "requisicao"} onClick={() => setTab("requisicao")} icon={<ClipboardList className="h-4 w-4" />}>
            Requisição de Peças
          </TabBtn>
          <TabBtn active={tab === "itens"} onClick={() => setTab("itens")} icon={<Package className="h-4 w-4" />}>
            Peças e Ferramentas
          </TabBtn>
          <TabBtn active={tab === "saida"} onClick={() => setTab("saida")} icon={<HardHat className="h-4 w-4" />}>
            Saída para Técnicos
          </TabBtn>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        {tab === "requisicao" && <RequisicaoTab pin={pin} />}
        {tab === "itens" && <ItensTab pin={pin} />}
        {tab === "saida" && <SaidaTab pin={pin} />}
      </main>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold uppercase tracking-wider transition-colors ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "border-border text-muted-foreground hover:text-foreground hover:bg-card"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

// ============================================================
// Tab 1: Requisição de Peças (existing flow)
// ============================================================
function RequisicaoTab({ pin }: { pin: string }) {
  const create = useServerFn(oficinaCreateRequest);
  const listMine = useServerFn(oficinaListRequests);

  const [requesterName, setRequesterName] = useState("");
  const [lines, setLines] = useState<Line[]>([{ partName: "", quantity: 1, code: "" }]);
  const [submitting, setSubmitting] = useState(false);
  const [requests, setRequests] = useState<ReqGroup[]>([]);

  async function refresh() {
    try {
      const res = await listMine({ data: { pin } });
      setRequests(res.requests as ReqGroup[]);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addLine() {
    setLines((p) => [...p, { partName: "", quantity: 1, code: "" }]);
  }
  function removeLine(idx: number) {
    setLines((p) => p.filter((_, i) => i !== idx));
  }
  function updateLine(idx: number, patch: Partial<Line>) {
    setLines((p) => p.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
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
      toast.success(`Requisição com ${validItems.length} peça(s) enviada`);
      setLines([{ partName: "", quantity: 1, code: "" }]);
      await refresh();
    } catch (e: any) {
      toast.error(e.message || "Falha ao enviar");
    } finally {
      setSubmitting(false);
    }
  }

  const totalItems = requests.reduce((acc, r) => acc + r.items.length, 0);

  return (
    <>
      <form onSubmit={handleCreate} className="rounded-lg border border-border bg-card p-5 space-y-4">
        <h2 className="font-display text-sm uppercase tracking-wider text-muted-foreground">Nova requisição</h2>
        <div className="space-y-1">
          <Label htmlFor="who">Solicitante</Label>
          <Input
            id="who"
            value={requesterName}
            onChange={(e) => setRequesterName(e.target.value)}
            placeholder="Nome de quem solicitou"
            maxLength={100}
          />
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
                <Input value={line.partName} onChange={(e) => updateLine(idx, { partName: e.target.value })} placeholder="Nome da peça" maxLength={200} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Qtd</Label>
                <Input
                  type="number"
                  min={1}
                  max={9999}
                  value={line.quantity}
                  onChange={(e) =>
                    updateLine(idx, { quantity: Math.max(1, Math.min(9999, parseInt(e.target.value, 10) || 1)) })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Código</Label>
                <Input value={line.code} onChange={(e) => updateLine(idx, { code: e.target.value })} placeholder="Código da peça" maxLength={100} />
              </div>
              <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => removeLine(idx)} disabled={lines.length === 1}>
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
          <span className="text-xs text-muted-foreground">
            {requests.length} {requests.length === 1 ? "requisição" : "requisições"} · {totalItems} {totalItems === 1 ? "item" : "itens"}
          </span>
        </div>
        {requests.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma requisição registrada ainda.</p>
        ) : (
          <ul className="divide-y divide-border">
            {requests.map((r) => {
              const dominantStatus = r.items[0]?.status ?? "pendente";
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
    </>
  );
}

// ============================================================
// Tab 2: Peças e Ferramentas (workshop_items)
// ============================================================
type WorkshopItem = {
  id: string;
  name: string;
  supplier: string;
  status: string;
  deadline_days: number;
  approved_at: string | null;
  created_at: string;
};

function ItensTab({ pin }: { pin: string }) {
  const list = useServerFn(oficinaListWorkshopItems);
  const create = useServerFn(oficinaCreateWorkshopItem);
  const del = useServerFn(oficinaDeleteWorkshopItem);

  const [items, setItems] = useState<WorkshopItem[]>([]);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const r = await list({ data: { pin } });
      setItems(r.items as WorkshopItem[]);
    } catch (e: any) {
      toast.error(e.message || "Falha ao carregar");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAdd() {
    try {
      await create({ data: { pin } });
      await refresh();
    } catch (e: any) {
      toast.error(e.message || "Falha ao adicionar");
    }
  }

  async function handleDelete(itemId: string) {
    if (!confirm("Excluir este item?")) return;
    try {
      await del({ data: { pin, itemId } });
      setItems((prev) => prev.filter((i) => i.id !== itemId));
    } catch (e: any) {
      toast.error(e.message || "Falha ao excluir");
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="font-display text-sm uppercase tracking-wider">Peças e Ferramentas</h2>
          <p className="text-xs text-muted-foreground">Controle de compras e orçamentos</p>
        </div>
        <Button onClick={handleAdd} size="sm" className="gap-1">
          <Plus className="h-3.5 w-3.5" /> Adicionar item
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">Item</th>
              <th className="text-left px-3 py-2">Fornecedor</th>
              <th className="text-left px-3 py-2 w-[260px]">Status</th>
              <th className="text-left px-3 py-2 w-[100px]">Prazo (dias)</th>
              <th className="text-left px-3 py-2 w-[160px]">Decorrido</th>
              <th className="px-3 py-2 w-[48px]"></th>
            </tr>
          </thead>
          <tbody>
            {loading && items.length === 0 ? (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Carregando...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nenhum item registrado. Clique em "Adicionar item".</td></tr>
            ) : (
              items.map((item) => (
                <WorkshopItemRow key={item.id} item={item} pin={pin} onChanged={refresh} onDelete={() => handleDelete(item.id)} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function WorkshopItemRow({
  item,
  pin,
  onChanged,
  onDelete,
}: {
  item: WorkshopItem;
  pin: string;
  onChanged: () => void;
  onDelete: () => void;
}) {
  const update = useServerFn(oficinaUpdateWorkshopItem);
  const [name, setName] = useState(item.name);
  const [supplier, setSupplier] = useState(item.supplier);
  const [deadline, setDeadline] = useState(item.deadline_days);
  const [status, setStatus] = useState(item.status);

  useEffect(() => {
    setName(item.name);
    setSupplier(item.supplier);
    setDeadline(item.deadline_days);
    setStatus(item.status);
  }, [item.id, item.name, item.supplier, item.deadline_days, item.status]);

  async function patch(p: Parameters<typeof update>[0]["data"]) {
    try {
      await update({ data: p });
    } catch (e: any) {
      toast.error(e.message || "Falha ao salvar");
    }
  }

  const daysElapsed = useMemo(() => {
    if (status !== "aprovado" || !item.approved_at) return null;
    const start = new Date(item.approved_at).getTime();
    const diff = Date.now() - start;
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  }, [status, item.approved_at]);

  const isLate = daysElapsed !== null && deadline > 0 && daysElapsed > deadline;

  return (
    <tr className="border-t border-border hover:bg-muted/20">
      <td className="px-3 py-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name !== item.name && patch({ pin, itemId: item.id, name })}
          placeholder="Nome do item"
          className="h-8"
        />
      </td>
      <td className="px-3 py-2">
        <Input
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
          onBlur={() => supplier !== item.supplier && patch({ pin, itemId: item.id, supplier })}
          placeholder="Fornecedor"
          className="h-8"
        />
      </td>
      <td className="px-3 py-2">
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            patch({ pin, itemId: item.id, status: v }).then(onChanged);
          }}
        >
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WORKSHOP_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="px-3 py-2">
        <Input
          type="number"
          min={0}
          max={3650}
          value={deadline}
          onChange={(e) => setDeadline(Math.max(0, parseInt(e.target.value, 10) || 0))}
          onBlur={() => deadline !== item.deadline_days && patch({ pin, itemId: item.id, deadlineDays: deadline })}
          className="h-8"
        />
      </td>
      <td className="px-3 py-2">
        {daysElapsed === null ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm">{daysElapsed} {daysElapsed === 1 ? "dia" : "dias"}</span>
            {isLate && (
              <span className="inline-flex items-center gap-1 rounded border border-red-500/40 bg-red-500/20 px-2 py-0.5 text-xs font-bold uppercase text-red-400">
                <AlertTriangle className="h-3 w-3" /> Atrasado
              </span>
            )}
          </div>
        )}
      </td>
      <td className="px-3 py-2">
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </td>
    </tr>
  );
}

// ============================================================
// Tab 3: Saída para Técnicos (tool_loans)
// ============================================================
type ToolLoan = {
  id: string;
  tool_name: string;
  technician_name: string;
  checkout_date: string;
  returned_at: string | null;
  created_at: string;
};

function SaidaTab({ pin }: { pin: string }) {
  const list = useServerFn(oficinaListToolLoans);
  const create = useServerFn(oficinaCreateToolLoan);
  const ret = useServerFn(oficinaReturnToolLoan);
  const del = useServerFn(oficinaDeleteToolLoan);

  const [loans, setLoans] = useState<ToolLoan[]>([]);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const r = await list({ data: { pin } });
      setLoans(r.loans as ToolLoan[]);
    } catch (e: any) {
      toast.error(e.message || "Falha ao carregar");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAdd() {
    try {
      await create({ data: { pin } });
      await refresh();
    } catch (e: any) {
      toast.error(e.message || "Falha ao adicionar");
    }
  }

  async function handleReturn(loanId: string) {
    try {
      await ret({ data: { pin, loanId } });
      toast.success("Marcado como devolvido");
      setLoans((prev) => prev.filter((l) => l.id !== loanId));
    } catch (e: any) {
      toast.error(e.message || "Falha");
    }
  }

  async function handleDelete(loanId: string) {
    if (!confirm("Excluir este registro?")) return;
    try {
      await del({ data: { pin, loanId } });
      setLoans((prev) => prev.filter((l) => l.id !== loanId));
    } catch (e: any) {
      toast.error(e.message || "Falha");
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="font-display text-sm uppercase tracking-wider">Saída para Técnicos</h2>
          <p className="text-xs text-muted-foreground">Empréstimos de ferramentas</p>
        </div>
        <Button onClick={handleAdd} size="sm" className="gap-1">
          <Plus className="h-3.5 w-3.5" /> Novo empréstimo
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">Ferramenta</th>
              <th className="text-left px-3 py-2">Técnico</th>
              <th className="text-left px-3 py-2 w-[160px]">Data de saída</th>
              <th className="text-left px-3 py-2 w-[220px]">Dias com técnico</th>
              <th className="px-3 py-2 w-[180px]"></th>
            </tr>
          </thead>
          <tbody>
            {loading && loans.length === 0 ? (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Carregando...</td></tr>
            ) : loans.length === 0 ? (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nenhum empréstimo ativo.</td></tr>
            ) : (
              loans.map((loan) => (
                <ToolLoanRow
                  key={loan.id}
                  loan={loan}
                  pin={pin}
                  onReturn={() => handleReturn(loan.id)}
                  onDelete={() => handleDelete(loan.id)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function daysSince(dateStr: string): number {
  // checkout_date is YYYY-MM-DD; compute calendar diff in local time
  const [y, m, d] = dateStr.split("-").map((n) => parseInt(n, 10));
  const start = new Date(y, (m || 1) - 1, d || 1);
  const today = new Date();
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = t0.getTime() - start.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function ToolLoanRow({
  loan,
  pin,
  onReturn,
  onDelete,
}: {
  loan: ToolLoan;
  pin: string;
  onReturn: () => void;
  onDelete: () => void;
}) {
  const update = useServerFn(oficinaUpdateToolLoan);
  const [toolName, setToolName] = useState(loan.tool_name);
  const [tech, setTech] = useState(loan.technician_name);
  const [checkoutDate, setCheckoutDate] = useState(loan.checkout_date);

  useEffect(() => {
    setToolName(loan.tool_name);
    setTech(loan.technician_name);
    setCheckoutDate(loan.checkout_date);
  }, [loan.id, loan.tool_name, loan.technician_name, loan.checkout_date]);

  async function patch(p: Parameters<typeof update>[0]["data"]) {
    try {
      await update({ data: p });
    } catch (e: any) {
      toast.error(e.message || "Falha ao salvar");
    }
  }

  const days = daysSince(checkoutDate);
  const overdue = days > 2;

  return (
    <tr className={`border-t border-border ${overdue ? "bg-red-500/10 hover:bg-red-500/15" : "hover:bg-muted/20"}`}>
      <td className="px-3 py-2">
        <Input
          value={toolName}
          onChange={(e) => setToolName(e.target.value)}
          onBlur={() => toolName !== loan.tool_name && patch({ pin, loanId: loan.id, toolName })}
          placeholder="Nome da ferramenta"
          className="h-8"
        />
      </td>
      <td className="px-3 py-2">
        <Input
          value={tech}
          onChange={(e) => setTech(e.target.value)}
          onBlur={() => tech !== loan.technician_name && patch({ pin, loanId: loan.id, technicianName: tech })}
          placeholder="Nome do técnico"
          className="h-8"
        />
      </td>
      <td className="px-3 py-2">
        <Input
          type="date"
          value={checkoutDate}
          onChange={(e) => setCheckoutDate(e.target.value)}
          onBlur={() => checkoutDate !== loan.checkout_date && patch({ pin, loanId: loan.id, checkoutDate })}
          className="h-8"
        />
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${overdue ? "text-red-400" : ""}`}>
            {days} {days === 1 ? "dia" : "dias"}
          </span>
          {overdue && (
            <span className="inline-flex items-center gap-1 rounded border border-red-500/40 bg-red-500/20 px-2 py-0.5 text-xs font-bold uppercase text-red-400">
              <AlertTriangle className="h-3 w-3" /> Solicitar devolução
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center justify-end gap-1">
          <Button variant="outline" size="sm" className="h-8 gap-1" onClick={onReturn}>
            <Check className="h-3.5 w-3.5" /> Devolvido
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
