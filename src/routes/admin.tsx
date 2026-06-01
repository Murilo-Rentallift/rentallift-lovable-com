import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  adminAddPart, adminChangePin, adminDeletePart, adminGetDay,
  adminLogin, adminSaveTask, adminUpdateOperator,
} from "@/lib/app.functions";
import { ArrowLeft, Plus, Save, Settings, Trash2, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Programação Diária" }] }),
  component: AdminPage,
});

const PIN_KEY = "admin_pin";
function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

function AdminPage() {
  const [pin, setPin] = useState<string | null>(null);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? sessionStorage.getItem(PIN_KEY) : null;
    if (stored) setPin(stored);
  }, []);

  if (!pin) return <AdminLogin onLogged={(p) => { sessionStorage.setItem(PIN_KEY, p); setPin(p); }} />;
  return <AdminDashboard pin={pin} onLogout={() => { sessionStorage.removeItem(PIN_KEY); setPin(null); }} />;
}

function AdminLogin({ onLogged }: { onLogged: (pin: string) => void }) {
  const [pinInput, setPinInput] = useState("");
  const [err, setErr] = useState("");
  const loginFn = useServerFn(adminLogin);
  const m = useMutation({
    mutationFn: (p: string) => loginFn({ data: { pin: p } }),
    onSuccess: (_d, p) => onLogged(p),
    onError: (e: Error) => setErr(e.message),
  });

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border bg-card/50">
        <div className="hazard-stripe h-2" />
        <div className="mx-auto max-w-2xl px-6 py-4 flex items-center gap-3">
          <Link to="/" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-5 w-5" /></Link>
          <span className="font-display uppercase tracking-wide">Administrador</span>
        </div>
      </header>
      <main className="flex-1 grid place-items-center px-6 py-12">
        <form
          onSubmit={(e) => { e.preventDefault(); setErr(""); if (/^\d{4,8}$/.test(pinInput)) m.mutate(pinInput); }}
          className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-xl"
        >
          <h2 className="font-display text-xl font-bold uppercase mb-1">PIN do Admin</h2>
          <p className="text-sm text-muted-foreground mb-5">Padrão: 9999</p>
          <input
            type="password" inputMode="numeric" autoFocus maxLength={8}
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
            className="w-full rounded-md border border-input bg-background px-4 py-4 text-center font-mono text-3xl tracking-[0.5em] focus:border-primary focus:outline-none"
            placeholder="••••"
          />
          {err && <p className="mt-3 text-sm text-destructive">{err}</p>}
          <button
            type="submit"
            disabled={pinInput.length < 4 || m.isPending}
            className="mt-5 w-full rounded-md bg-accent px-4 py-3 font-semibold uppercase tracking-wide text-accent-foreground disabled:opacity-40 hover:brightness-110 transition"
          >
            {m.isPending ? "Verificando..." : "Entrar"}
          </button>
        </form>
      </main>
    </div>
  );
}

function AdminDashboard({ pin, onLogout }: { pin: string; onLogout: () => void }) {
  const [date, setDate] = useState(todayISO());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const qc = useQueryClient();

  const getDay = useServerFn(adminGetDay);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-day", date, pin],
    queryFn: () => getDay({ data: { pin, date } }),
    retry: false,
  });

  useEffect(() => {
    if (error) {
      toast.error((error as Error).message);
      onLogout();
    }
  }, [error, onLogout]);

  return (
    <div className="min-h-screen pb-20">
      <header className="border-b border-border bg-card/70 backdrop-blur sticky top-0 z-10">
        <div className="hazard-stripe h-2" />
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-5 w-5" /></Link>
            <h1 className="font-display text-xl font-bold uppercase">Painel do Admin</h1>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
            />
            <button
              onClick={() => setSettingsOpen(true)}
              className="rounded-md border border-border bg-card p-2 hover:bg-muted transition"
              title="Configurações"
            >
              <Settings className="h-4 w-4" />
            </button>
            <button onClick={onLogout} className="text-xs uppercase text-muted-foreground hover:text-foreground px-2">
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-6 space-y-4">
        {isLoading && (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-44 rounded-lg bg-card/50 animate-pulse" />
            ))}
          </div>
        )}

        {data?.operators.map((op) => {
          const schedule = data.schedules.find((s) => s.operator_id === op.id);
          const parts = schedule ? data.parts.filter((p) => p.schedule_id === schedule.id) : [];
          return (
            <OperatorCard
              key={op.id}
              pin={pin}
              date={date}
              operator={op}
              task={schedule?.task ?? ""}
              parts={parts}
              onChange={() => qc.invalidateQueries({ queryKey: ["admin-day", date, pin] })}
            />
          );
        })}
      </main>

      {settingsOpen && data && (
        <SettingsModal
          pin={pin}
          operators={data.operators}
          onClose={() => setSettingsOpen(false)}
          onChange={() => qc.invalidateQueries({ queryKey: ["admin-day", date, pin] })}
        />
      )}
    </div>
  );
}

function OperatorCard({
  pin, date, operator, task, parts, onChange,
}: {
  pin: string; date: string;
  operator: { id: string; name: string; position: number };
  task: string;
  parts: Array<{ id: string; name: string; quantity: number; checked: boolean }>;
  onChange: () => void;
}) {
  const [taskDraft, setTaskDraft] = useState(task);
  useEffect(() => setTaskDraft(task), [task]);

  const saveFn = useServerFn(adminSaveTask);
  const addFn = useServerFn(adminAddPart);
  const delFn = useServerFn(adminDeletePart);

  const saveTask = useMutation({
    mutationFn: () => saveFn({ data: { pin, operatorId: operator.id, date, task: taskDraft } }),
    onSuccess: () => { toast.success("Tarefa salva"); onChange(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const [newPart, setNewPart] = useState("");
  const [newQty, setNewQty] = useState(1);
  const addPart = useMutation({
    mutationFn: () => addFn({ data: { pin, operatorId: operator.id, date, name: newPart.trim(), quantity: newQty } }),
    onSuccess: () => { setNewPart(""); setNewQty(1); onChange(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const delPart = useMutation({
    mutationFn: (partId: string) => delFn({ data: { pin, partId } }),
    onSuccess: () => onChange(),
    onError: (e: Error) => toast.error(e.message),
  });

  const dirty = taskDraft !== task;

  return (
    <section className="rounded-lg border border-border bg-card overflow-hidden shadow-lg">
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border bg-primary/10">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-muted-foreground">#{String(operator.position).padStart(2, "0")}</span>
          <h3 className="font-display text-lg font-bold uppercase">{operator.name}</h3>
        </div>
        <span className="text-xs text-muted-foreground">{parts.length} peça(s)</span>
      </div>

      <div className="grid md:grid-cols-2 gap-0 md:divide-x divide-border">
        {/* Task */}
        <div className="p-4 space-y-2">
          <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Tarefa do dia</label>
          <textarea
            value={taskDraft}
            onChange={(e) => setTaskDraft(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Ex: Manutenção preventiva GLP 2.5T - cliente Acme"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:border-primary focus:outline-none"
          />
          <button
            onClick={() => saveTask.mutate()}
            disabled={!dirty || saveTask.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40 hover:brightness-110 transition"
          >
            <Save className="h-4 w-4" />
            {saveTask.isPending ? "Salvando..." : "Salvar tarefa"}
          </button>
        </div>

        {/* Parts */}
        <div className="p-4 space-y-2">
          <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Peças</label>
          <ul className="space-y-1 max-h-44 overflow-y-auto">
            {parts.length === 0 && (
              <li className="text-sm text-muted-foreground italic py-2">Sem peças</li>
            )}
            {parts.map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-sm rounded bg-muted/40 px-2 py-1.5">
                <span className={`flex-1 ${p.checked ? "line-through text-muted-foreground" : ""}`}>{p.name}</span>
                <span className="font-mono text-xs text-muted-foreground">×{p.quantity}</span>
                <button
                  onClick={() => delPart.mutate(p.id)}
                  className="text-muted-foreground hover:text-destructive p-1"
                  title="Remover"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          <form
            onSubmit={(e) => { e.preventDefault(); if (newPart.trim()) addPart.mutate(); }}
            className="flex gap-2 pt-1"
          >
            <input
              value={newPart}
              onChange={(e) => setNewPart(e.target.value)}
              maxLength={200}
              placeholder="Nome da peça"
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
            <input
              type="number" min={1} max={9999}
              value={newQty}
              onChange={(e) => setNewQty(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-16 rounded-md border border-input bg-background px-2 py-2 text-sm font-mono text-center focus:border-primary focus:outline-none"
            />
            <button
              type="submit"
              disabled={!newPart.trim() || addPart.isPending}
              className="rounded-md bg-accent px-3 py-2 text-accent-foreground disabled:opacity-40 hover:brightness-110 transition"
            >
              <Plus className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

function SettingsModal({
  pin, operators, onClose, onChange,
}: {
  pin: string;
  operators: Array<{ id: string; name: string; pin: string; position: number }>;
  onClose: () => void;
  onChange: () => void;
}) {
  const updOp = useServerFn(adminUpdateOperator);
  const chgAdmin = useServerFn(adminChangePin);
  const [drafts, setDrafts] = useState(() =>
    operators.map((o) => ({ id: o.id, name: o.name, pin: o.pin, position: o.position })),
  );
  const [newAdminPin, setNewAdminPin] = useState("");

  const saveOp = useMutation({
    mutationFn: (d: { id: string; name: string; pin: string }) =>
      updOp({ data: { pin, operatorId: d.id, name: d.name, newPin: d.pin } }),
    onSuccess: () => { toast.success("Operador atualizado"); onChange(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveAdmin = useMutation({
    mutationFn: () => chgAdmin({ data: { pin, newPin: newAdminPin } }),
    onSuccess: () => { toast.success("PIN do admin alterado. Faça login novamente."); setNewAdminPin(""); sessionStorage.removeItem("admin_pin"); window.location.reload(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur grid place-items-center p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-lg border border-border bg-card shadow-2xl my-8">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-display text-lg font-bold uppercase">Configurações</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-5 space-y-6">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Operadores</h3>
            <ul className="space-y-2">
              {drafts.map((d, i) => (
                <li key={d.id} className="flex gap-2 items-center">
                  <span className="font-mono text-xs text-muted-foreground w-6">#{String(d.position).padStart(2, "0")}</span>
                  <input
                    value={d.name}
                    onChange={(e) => setDrafts((arr) => arr.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                    maxLength={60}
                    className="flex-1 rounded border border-input bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
                  />
                  <input
                    value={d.pin}
                    onChange={(e) => setDrafts((arr) => arr.map((x, j) => j === i ? { ...x, pin: e.target.value.replace(/\D/g, "").slice(0, 8) } : x))}
                    inputMode="numeric"
                    placeholder="PIN"
                    className="w-24 rounded border border-input bg-background px-3 py-1.5 text-sm font-mono text-center focus:border-primary focus:outline-none"
                  />
                  <button
                    onClick={() => saveOp.mutate({ id: d.id, name: d.name.trim(), pin: d.pin })}
                    disabled={!d.name.trim() || d.pin.length < 4 || saveOp.isPending}
                    className="rounded bg-primary px-3 py-1.5 text-xs font-semibold uppercase text-primary-foreground disabled:opacity-40 hover:brightness-110"
                  >
                    Salvar
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t border-border pt-5">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Alterar PIN do administrador</h3>
            <form
              onSubmit={(e) => { e.preventDefault(); if (/^\d{4,8}$/.test(newAdminPin)) saveAdmin.mutate(); }}
              className="flex gap-2"
            >
              <input
                type="password"
                value={newAdminPin}
                onChange={(e) => setNewAdminPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="Novo PIN (4-8 dígitos)"
                className="flex-1 rounded border border-input bg-background px-3 py-2 text-sm font-mono focus:border-primary focus:outline-none"
              />
              <button
                type="submit"
                disabled={newAdminPin.length < 4 || saveAdmin.isPending}
                className="rounded bg-accent px-4 py-2 text-sm font-semibold uppercase text-accent-foreground disabled:opacity-40 hover:brightness-110"
              >
                Atualizar
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
