import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  adminAddPart, adminAddTask, adminChangePin, adminChangeAlmoxPin, adminDeletePart, adminDeleteTask,
  adminEditPart, adminEditTask, adminGetDay, adminLogin, adminMoveTask,
  adminSaveTask, adminUpdateOperator,
  adminListMaintenanceReturns, adminAddMaintenanceReturn, adminUpdateMaintenanceReturn, adminDeleteMaintenanceReturn,
  adminListAttendedCalls, adminAddAttendedCall, adminUpdateAttendedCall, adminDeleteAttendedCall,
} from "@/lib/app.functions";
import { ArrowDown, ArrowLeft, ArrowUp, CalendarDays, Check, ClipboardList, BookCheck, Clock, Pencil, Plus, Save, Settings, Trash2, Wrench, X } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";

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
  const [tab, setTab] = useState<"operadores" | "chamados" | "agenda">("operadores");
  const qc = useQueryClient();

  const getDay = useServerFn(adminGetDay);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-day", date, pin],
    queryFn: () => getDay({ data: { pin, date } }),
    retry: false,
    enabled: tab === "operadores",
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
            <Logo className="h-9 w-auto" />
            <h1 className="font-display text-xl font-bold uppercase">Painel do Admin</h1>
          </div>
          <div className="flex items-center gap-2">
            {(tab === "operadores" || tab === "agenda") && (
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
              />
            )}
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
        <div className="mx-auto max-w-5xl px-6 pb-3 flex gap-2">
          <button
            onClick={() => setTab("operadores")}
            className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold uppercase tracking-wide transition border ${
              tab === "operadores"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <ClipboardList className="h-4 w-4" />
            Operadores
          </button>
          <button
            onClick={() => setTab("chamados")}
            className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold uppercase tracking-wide transition border ${
              tab === "chamados"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <Wrench className="h-4 w-4" />
            Retorno de Manutenções
          </button>
          <button
            onClick={() => setTab("agenda")}
            className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold uppercase tracking-wide transition border ${
              tab === "agenda"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <BookCheck className="h-4 w-4" />
            Agenda do dia
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-6 space-y-4">
        {tab === "chamados" ? (
          <PendingCallsCalendar pin={pin} />
        ) : tab === "agenda" ? (
          <AttendedCallsAgenda pin={pin} date={date} />
        ) : (
          <>
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
              const tasks = schedule ? (data.tasks ?? []).filter((t) => t.schedule_id === schedule.id) : [];
              return (
                <OperatorCard
                  key={op.id}
                  pin={pin}
                  date={date}
                  operator={op}
                  legacyTask={schedule?.task ?? ""}
                  tasks={tasks}
                  parts={parts}
                  onChange={() => qc.invalidateQueries({ queryKey: ["admin-day", date, pin] })}
                />
              );
            })}
          </>
        )}
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
  pin, date, operator, legacyTask, tasks, parts, onChange,
}: {
  pin: string; date: string;
  operator: { id: string; name: string; position: number };
  legacyTask: string;
  tasks: Array<{ id: string; position: number; title: string; description: string }>;
  parts: Array<{ id: string; name: string; quantity: number; checked: boolean }>;
  onChange: () => void;
}) {
  const saveFn = useServerFn(adminSaveTask);
  const addTaskFn = useServerFn(adminAddTask);
  const editTaskFn = useServerFn(adminEditTask);
  const delTaskFn = useServerFn(adminDeleteTask);
  const moveTaskFn = useServerFn(adminMoveTask);
  const addFn = useServerFn(adminAddPart);
  const delFn = useServerFn(adminDeletePart);
  const editFn = useServerFn(adminEditPart);

  // New task draft
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const addTask = useMutation({
    mutationFn: () => addTaskFn({ data: { pin, operatorId: operator.id, date, title: newTitle.trim(), description: newDesc.trim() } }),
    onSuccess: () => { setNewTitle(""); setNewDesc(""); toast.success("Atendimento adicionado"); onChange(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delTask = useMutation({
    mutationFn: (taskId: string) => delTaskFn({ data: { pin, taskId } }),
    onSuccess: () => onChange(),
    onError: (e: Error) => toast.error(e.message),
  });
  const moveTask = useMutation({
    mutationFn: (v: { taskId: string; direction: "up" | "down" }) => moveTaskFn({ data: { pin, ...v } }),
    onSuccess: () => onChange(),
    onError: (e: Error) => toast.error(e.message),
  });

  // Migrate legacy single-task field on first add
  async function migrateLegacyIfNeeded() {
    if (legacyTask.trim() && tasks.length === 0) {
      await saveFn({ data: { pin, operatorId: operator.id, date, task: "" } });
    }
  }

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

  return (
    <section className="rounded-lg border border-border bg-card overflow-hidden shadow-lg">
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border bg-primary/10">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-muted-foreground">#{String(operator.position).padStart(2, "0")}</span>
          <h3 className="font-display text-lg font-bold uppercase">{operator.name}</h3>
        </div>
        <span className="text-xs text-muted-foreground">
          {tasks.length} atend. · {parts.length} peça(s)
        </span>
      </div>

      <div className="grid md:grid-cols-2 gap-0 md:divide-x divide-border">
        {/* Tasks (ordered) */}
        <div className="p-4 space-y-3">
          <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Atendimentos do dia (na ordem)
          </label>

          {legacyTask.trim() && tasks.length === 0 && (
            <div className="rounded border border-dashed border-border p-3 text-xs text-muted-foreground">
              <p className="mb-1 font-semibold">Tarefa antiga (legado):</p>
              <p className="whitespace-pre-wrap">{legacyTask}</p>
              <p className="mt-2 italic">Adicione abaixo como atendimentos separados.</p>
            </div>
          )}

          <ol className="space-y-2">
            {tasks.map((t, i) => (
              <TaskItem
                key={t.id}
                index={i}
                total={tasks.length}
                task={t}
                onDelete={() => delTask.mutate(t.id)}
                onMove={(dir) => moveTask.mutate({ taskId: t.id, direction: dir })}
                onEdit={async (title, description) => {
                  await editTaskFn({ data: { pin, taskId: t.id, title, description } });
                  toast.success("Atendimento atualizado");
                  onChange();
                }}
              />
            ))}
          </ol>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newTitle.trim()) return;
              await migrateLegacyIfNeeded();
              addTask.mutate();
            }}
            className="space-y-2 pt-2 border-t border-border"
          >
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              maxLength={200}
              placeholder="Empresa / local (ex: Acme Ltda)"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
            <textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              rows={2}
              maxLength={2000}
              placeholder="Serviço a executar (opcional)"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:border-primary focus:outline-none"
            />
            <button
              type="submit"
              disabled={!newTitle.trim() || addTask.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40 hover:brightness-110 transition"
            >
              <Plus className="h-4 w-4" />
              {addTask.isPending ? "Adicionando..." : "Adicionar atendimento"}
            </button>
          </form>
        </div>

        {/* Parts */}
        <div className="p-4 space-y-2">
          <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Peças</label>
          <ul className="space-y-1 max-h-44 overflow-y-auto">
            {parts.length === 0 && (
              <li className="text-sm text-muted-foreground italic py-2">Sem peças</li>
            )}
            {parts.map((p) => (
              <PartItem
                key={p.id}
                part={p}
                onDelete={() => delPart.mutate(p.id)}
                onEdit={async (name, quantity) => {
                  await editFn({ data: { pin, partId: p.id, name, quantity } });
                  toast.success("Peça atualizada");
                  onChange();
                }}
              />
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

function TaskItem({
  index, total, task, onDelete, onMove, onEdit,
}: {
  index: number;
  total: number;
  task: { id: string; title: string; description: string };
  onDelete: () => void;
  onMove: (direction: "up" | "down") => void;
  onEdit: (title: string, description: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [desc, setDesc] = useState(task.description);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setTitle(task.title); setDesc(task.description); }, [task.title, task.description]);

  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onEdit(title.trim(), desc);
      setEditing(false);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="rounded-md border border-border bg-muted/30 p-2">
      <div className="flex items-start gap-2">
        <div className="flex-shrink-0 h-7 w-7 rounded-full bg-accent text-accent-foreground font-display font-bold grid place-items-center text-sm">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-2">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                className="w-full rounded border border-input bg-background px-2 py-1 text-sm font-semibold focus:border-primary focus:outline-none"
                autoFocus
              />
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                rows={2}
                maxLength={2000}
                className="w-full rounded border border-input bg-background px-2 py-1 text-sm resize-none focus:border-primary focus:outline-none"
              />
            </div>
          ) : (
            <>
              <p className="font-semibold text-sm uppercase truncate">{task.title}</p>
              {task.description?.trim() && (
                <p className="mt-0.5 text-xs text-muted-foreground whitespace-pre-wrap">{task.description}</p>
              )}
            </>
          )}
        </div>
        <div className="flex flex-col gap-0.5 flex-shrink-0">
          {editing ? (
            <>
              <button onClick={save} disabled={saving || !title.trim()} className="text-primary hover:bg-primary/10 p-1 rounded disabled:opacity-40" title="Salvar">
                <Check className="h-4 w-4" />
              </button>
              <button onClick={() => { setEditing(false); setTitle(task.title); setDesc(task.description); }} className="text-muted-foreground hover:bg-muted p-1 rounded" title="Cancelar">
                <X className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <div className="flex gap-0.5">
                <button onClick={() => onMove("up")} disabled={index === 0} className="text-muted-foreground hover:text-primary disabled:opacity-30 p-1" title="Subir">
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => onMove("down")} disabled={index === total - 1} className="text-muted-foreground hover:text-primary disabled:opacity-30 p-1" title="Descer">
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex gap-0.5">
                <button onClick={() => setEditing(true)} className="text-muted-foreground hover:text-primary p-1" title="Editar">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={onDelete} className="text-muted-foreground hover:text-destructive p-1" title="Remover">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

function PartItem({
  part, onDelete, onEdit,
}: {
  part: { id: string; name: string; quantity: number; checked: boolean };
  onDelete: () => void;
  onEdit: (name: string, quantity: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(part.name);
  const [qty, setQty] = useState(part.quantity);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setName(part.name); setQty(part.quantity); }, [part.name, part.quantity]);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onEdit(name.trim(), qty);
      setEditing(false);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <li className="flex items-center gap-2 text-sm rounded bg-muted/40 px-2 py-1.5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={200}
          className="flex-1 rounded border border-input bg-background px-2 py-1 text-sm focus:border-primary focus:outline-none"
          autoFocus
        />
        <input
          type="number" min={1} max={9999}
          value={qty}
          onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
          className="w-14 rounded border border-input bg-background px-1 py-1 text-sm font-mono text-center focus:border-primary focus:outline-none"
        />
        <button
          onClick={save}
          disabled={saving || !name.trim()}
          className="text-primary hover:bg-primary/10 p-1 rounded disabled:opacity-40"
          title="Salvar"
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          onClick={() => { setEditing(false); setName(part.name); setQty(part.quantity); }}
          className="text-muted-foreground hover:bg-muted p-1 rounded"
          title="Cancelar"
        >
          <X className="h-4 w-4" />
        </button>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2 text-sm rounded bg-muted/40 px-2 py-1.5">
      <span className={`flex-1 ${part.checked ? "line-through text-muted-foreground" : ""}`}>{part.name}</span>
      <span className="font-mono text-xs text-muted-foreground">×{part.quantity}</span>
      <button
        onClick={() => setEditing(true)}
        className="text-muted-foreground hover:text-primary p-1"
        title="Editar"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={onDelete}
        className="text-muted-foreground hover:text-destructive p-1"
        title="Remover"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
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
  const chgAlmox = useServerFn(adminChangeAlmoxPin);
  const [drafts, setDrafts] = useState(() =>
    operators.map((o) => ({ id: o.id, name: o.name, pin: o.pin, position: o.position })),
  );
  const [newAdminPin, setNewAdminPin] = useState("");
  const [newAlmoxPin, setNewAlmoxPin] = useState("");


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

  const saveAlmox = useMutation({
    mutationFn: () => chgAlmox({ data: { pin, newPin: newAlmoxPin } }),
    onSuccess: () => { toast.success("PIN do almoxarifado alterado"); setNewAlmoxPin(""); },
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

          <div className="border-t border-border pt-5">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Alterar PIN do almoxarifado</h3>
            <form
              onSubmit={(e) => { e.preventDefault(); if (/^\d{4,8}$/.test(newAlmoxPin)) saveAlmox.mutate(); }}
              className="flex gap-2"
            >
              <input
                type="password"
                value={newAlmoxPin}
                onChange={(e) => setNewAlmoxPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="Novo PIN (4-8 dígitos)"
                className="flex-1 rounded border border-input bg-background px-3 py-2 text-sm font-mono focus:border-primary focus:outline-none"
              />
              <button
                type="submit"
                disabled={newAlmoxPin.length < 4 || saveAlmox.isPending}
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

// ---------- Pending calls weekly calendar (admin only) ----------
function mondayOf(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay(); // 0=Sun
  const diff = dow === 0 ? -6 : 1 - dow;
  dt.setUTCDate(dt.getUTCDate() + diff);
  return dt.toISOString().slice(0, 10);
}
function addDaysISO(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}
const WEEKDAYS_PT = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const PRIORITY_STYLES: Record<string, string> = {
  baixa: "bg-muted text-muted-foreground border-border",
  normal: "bg-accent/20 text-accent-foreground border-accent/40",
  alta: "bg-orange-500/20 text-orange-200 border-orange-500/40",
  urgente: "bg-destructive/30 text-destructive-foreground border-destructive/60",
};

function PendingCallsCalendar({ pin }: { pin: string }) {
  const qc = useQueryClient();
  const [weekStart, setWeekStart] = useState(() => mondayOf(todayISO()));
  const [addDay, setAddDay] = useState<string | null>(null);
  const [company, setCompany] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("normal");

  const endDate = addDaysISO(weekStart, 6);
  const listFn = useServerFn(adminListPendingCalls);
  const addFn = useServerFn(adminAddPendingCall);
  const delFn = useServerFn(adminDeletePendingCall);
  const statusFn = useServerFn(adminUpdatePendingCallStatus);

  const { data } = useQuery({
    queryKey: ["pending-calls", weekStart, pin],
    queryFn: () => listFn({ data: { pin, startDate: weekStart, endDate } }),
    retry: false,
  });

  const addM = useMutation({
    mutationFn: () => addFn({ data: { pin, callDate: addDay!, company: company.trim(), description: description.trim(), priority } }),
    onSuccess: () => {
      toast.success("Chamado adicionado");
      setAddDay(null); setCompany(""); setDescription(""); setPriority("normal");
      qc.invalidateQueries({ queryKey: ["pending-calls", weekStart, pin] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const delM = useMutation({
    mutationFn: (callId: string) => delFn({ data: { pin, callId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pending-calls", weekStart, pin] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const statusM = useMutation({
    mutationFn: (v: { callId: string; status: string }) => statusFn({ data: { pin, callId: v.callId, status: v.status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pending-calls", weekStart, pin] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const days = Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i));
  const callsByDay = new Map<string, NonNullable<typeof data>["calls"]>();
  (data?.calls ?? []).forEach((c) => {
    const arr = callsByDay.get(c.call_date) ?? [];
    arr.push(c);
    callsByDay.set(c.call_date, arr);
  });

  function fmtDay(iso: string) {
    const [, m, d] = iso.split("-");
    return `${d}/${m}`;
  }

  return (
    <section className="rounded-lg border border-border bg-card overflow-hidden shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-border bg-accent/10">
        <div>
          <h3 className="font-display text-lg font-bold uppercase">Próximos Chamados (sem técnico)</h3>
          <p className="text-xs text-muted-foreground">Semana de {fmtDay(weekStart)} a {fmtDay(endDate)}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekStart(addDaysISO(weekStart, -7))}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-muted transition"
          >
            ← Semana anterior
          </button>
          <button
            onClick={() => setWeekStart(mondayOf(todayISO()))}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-muted transition"
          >
            Hoje
          </button>
          <button
            onClick={() => setWeekStart(addDaysISO(weekStart, 7))}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-muted transition"
          >
            Próxima semana →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-px bg-border">
        {days.map((iso, i) => {
          const items = callsByDay.get(iso) ?? [];
          const isToday = iso === todayISO();
          return (
            <div key={iso} className={`bg-card p-3 min-h-[160px] flex flex-col ${isToday ? "ring-2 ring-inset ring-accent" : ""}`}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{WEEKDAYS_PT[i]}</p>
                  <p className="font-mono text-sm">{fmtDay(iso)}</p>
                </div>
                <button
                  onClick={() => { setAddDay(iso); setCompany(""); setDescription(""); setPriority("normal"); }}
                  className="rounded-md border border-border bg-background p-1 hover:bg-muted transition"
                  title="Adicionar chamado"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
              <div className="space-y-2 flex-1">
                {items.length === 0 && (
                  <p className="text-[11px] text-muted-foreground italic">Sem chamados</p>
                )}
                {items.map((c) => {
                  const cs = (c as any).status ?? "pendente";
                  const statusStyle =
                    cs === "atendido" ? "bg-green-500/20 text-green-300 border-green-500/40" :
                    cs === "nao_atendido" ? "bg-red-500/20 text-red-300 border-red-500/40" :
                    "bg-muted text-muted-foreground border-border";
                  return (
                    <div key={c.id} className={`rounded border px-2 py-1.5 text-xs ${PRIORITY_STYLES[c.priority] ?? PRIORITY_STYLES.normal}`}>
                      <div className="flex items-start justify-between gap-1">
                        <p className="font-semibold leading-tight break-words">{c.company}</p>
                        <button
                          onClick={() => delM.mutate(c.id)}
                          className="opacity-60 hover:opacity-100 shrink-0"
                          title="Remover"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                      {c.description && <p className="mt-1 opacity-90 whitespace-pre-wrap leading-tight">{c.description}</p>}
                      <div className="mt-1 flex items-center justify-between gap-1">
                        <p className="text-[9px] uppercase tracking-wider opacity-70">{c.priority}</p>
                        <select
                          value={cs}
                          onChange={(e) => statusM.mutate({ callId: c.id, status: e.target.value })}
                          className={`rounded border px-1 py-0.5 text-[9px] uppercase tracking-wider font-semibold focus:outline-none ${statusStyle}`}
                        >
                          <option value="pendente" className="bg-background text-foreground">Pendente</option>
                          <option value="atendido" className="bg-background text-foreground">Atendido</option>
                          <option value="nao_atendido" className="bg-background text-foreground">Não atendido</option>
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {addDay && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm grid place-items-center p-4" onClick={() => setAddDay(null)}>
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => { e.preventDefault(); if (company.trim()) addM.mutate(); }}
            className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-2xl space-y-4"
          >
            <div>
              <h4 className="font-display text-lg font-bold uppercase">Novo chamado</h4>
              <p className="text-xs text-muted-foreground">Data: {fmtDay(addDay)}</p>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Empresa / Cliente</label>
              <input
                autoFocus
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                maxLength={200}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                placeholder="Nome da empresa"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Descrição</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={1000}
                rows={3}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none resize-none"
                placeholder="Detalhes do chamado (opcional)"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Prioridade</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              >
                <option value="baixa">Baixa</option>
                <option value="normal">Normal</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setAddDay(null)} className="rounded-md border border-border bg-background px-4 py-2 text-sm hover:bg-muted transition">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!company.trim() || addM.isPending}
                className="rounded-md bg-accent px-4 py-2 text-sm font-semibold uppercase tracking-wide text-accent-foreground disabled:opacity-40 hover:brightness-110 transition"
              >
                {addM.isPending ? "Salvando..." : "Adicionar"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

// ---------- Attended calls agenda (admin only) ----------
function fmtDateLong(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });
}

function AttendedCallsAgenda({ pin, date }: { pin: string; date: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListAttendedCalls);
  const addFn = useServerFn(adminAddAttendedCall);
  const updFn = useServerFn(adminUpdateAttendedCall);
  const delFn = useServerFn(adminDeleteAttendedCall);

  const { data, isLoading } = useQuery({
    queryKey: ["attended-calls", date, pin],
    queryFn: () => listFn({ data: { pin, date } }),
    retry: false,
  });

  const [company, setCompany] = useState("");
  const [callTime, setCallTime] = useState("");
  const [technician, setTechnician] = useState("");
  const [description, setDescription] = useState("");

  const addM = useMutation({
    mutationFn: () => addFn({ data: { pin, callDate: date, callTime, company: company.trim(), description: description.trim(), technician: technician.trim() } }),
    onSuccess: () => {
      toast.success("Chamado registrado");
      setCompany(""); setCallTime(""); setTechnician(""); setDescription("");
      qc.invalidateQueries({ queryKey: ["attended-calls", date, pin] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const delM = useMutation({
    mutationFn: (callId: string) => delFn({ data: { pin, callId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attended-calls", date, pin] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const calls = data?.calls ?? [];

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-5 shadow-lg">
        <div className="flex items-center gap-2 mb-1">
          <BookCheck className="h-5 w-5 text-accent" />
          <h3 className="font-display text-lg font-bold uppercase">Agenda — Chamados atendidos</h3>
        </div>
        <p className="text-xs text-muted-foreground capitalize mb-4">{fmtDateLong(date)}</p>

        <form
          onSubmit={(e) => { e.preventDefault(); if (company.trim()) addM.mutate(); }}
          className="grid grid-cols-1 sm:grid-cols-12 gap-2"
        >
          <input
            type="time"
            value={callTime}
            onChange={(e) => setCallTime(e.target.value)}
            className="sm:col-span-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus:border-primary focus:outline-none"
          />
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            maxLength={200}
            placeholder="Empresa / cliente"
            className="sm:col-span-4 rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
          <input
            value={technician}
            onChange={(e) => setTechnician(e.target.value)}
            maxLength={100}
            placeholder="Técnico"
            className="sm:col-span-3 rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
          <button
            type="submit"
            disabled={!company.trim() || addM.isPending}
            className="sm:col-span-3 inline-flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold uppercase tracking-wide text-accent-foreground disabled:opacity-40 hover:brightness-110 transition"
          >
            <Plus className="h-4 w-4" />
            {addM.isPending ? "Salvando..." : "Registrar"}
          </button>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="Serviço executado / observações (opcional)"
            className="sm:col-span-12 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:border-primary focus:outline-none"
          />
        </form>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-lg">
        <div className="px-5 py-3 border-b border-border bg-primary/10 flex items-center justify-between">
          <h4 className="font-display text-sm font-bold uppercase tracking-wide">Registros do dia</h4>
          <span className="text-xs text-muted-foreground">{calls.length} chamado(s)</span>
        </div>
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Carregando...</div>
        ) : calls.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground italic text-center">Nenhum chamado registrado nesta data.</div>
        ) : (
          <ol className="divide-y divide-border">
            {calls.map((c: any) => (
              <AttendedCallRow
                key={c.id}
                call={c}
                onDelete={() => { if (confirm("Remover este registro?")) delM.mutate(c.id); }}
                onSave={async (v) => {
                  await updFn({ data: { pin, callId: c.id, ...v } });
                  toast.success("Atualizado");
                  qc.invalidateQueries({ queryKey: ["attended-calls", date, pin] });
                }}
              />
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function AttendedCallRow({
  call, onDelete, onSave,
}: {
  call: { id: string; call_time: string | null; company: string; description: string; technician: string };
  onDelete: () => void;
  onSave: (v: { callTime: string; company: string; description: string; technician: string }) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [callTime, setCallTime] = useState((call.call_time ?? "").slice(0, 5));
  const [company, setCompany] = useState(call.company);
  const [technician, setTechnician] = useState(call.technician);
  const [description, setDescription] = useState(call.description);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCallTime((call.call_time ?? "").slice(0, 5));
    setCompany(call.company);
    setTechnician(call.technician);
    setDescription(call.description);
  }, [call.call_time, call.company, call.technician, call.description]);

  async function save() {
    if (!company.trim()) return;
    setSaving(true);
    try {
      await onSave({ callTime, company: company.trim(), description: description.trim(), technician: technician.trim() });
      setEditing(false);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <li className="p-4 space-y-2 bg-muted/20">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
          <input
            type="time"
            value={callTime}
            onChange={(e) => setCallTime(e.target.value)}
            className="sm:col-span-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus:border-primary focus:outline-none"
          />
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            maxLength={200}
            className="sm:col-span-6 rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
          <input
            value={technician}
            onChange={(e) => setTechnician(e.target.value)}
            maxLength={100}
            placeholder="Técnico"
            className="sm:col-span-4 rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          maxLength={2000}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:border-primary focus:outline-none"
        />
        <div className="flex justify-end gap-2">
          <button onClick={() => setEditing(false)} className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted">Cancelar</button>
          <button onClick={save} disabled={saving || !company.trim()} className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold uppercase text-primary-foreground disabled:opacity-40 hover:brightness-110">
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="p-4 flex items-start gap-3 hover:bg-muted/20 transition">
      <div className="flex-shrink-0 w-16 text-center">
        <div className="inline-flex items-center gap-1 rounded-md bg-accent/20 border border-accent/40 px-2 py-1 text-xs font-mono">
          <Clock className="h-3 w-3" />
          {call.call_time ? call.call_time.slice(0, 5) : "--:--"}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm uppercase">{call.company}</p>
        {call.technician && (
          <p className="text-xs text-muted-foreground mt-0.5">Técnico: <span className="text-foreground">{call.technician}</span></p>
        )}
        {call.description && (
          <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{call.description}</p>
        )}
      </div>
      <div className="flex flex-col gap-1 flex-shrink-0">
        <button onClick={() => setEditing(true)} className="text-muted-foreground hover:text-primary p-1" title="Editar">
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button onClick={onDelete} className="text-muted-foreground hover:text-destructive p-1" title="Remover">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}
