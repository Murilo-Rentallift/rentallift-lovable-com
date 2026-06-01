import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { getOperatorDay, togglePart } from "@/lib/app.functions";
import { ArrowLeft, Calendar, CheckCircle2, Circle, Package } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/operador/$id")({
  head: () => ({ meta: [{ title: "Meu Dia — Operador" }] }),
  component: OperadorPage,
});

const PIN_KEY = (id: string) => `op_pin_${id}`;
function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

function OperadorPage() {
  const { id } = Route.useParams();
  const [pin, setPin] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [error, setError] = useState("");
  const [date, setDate] = useState(todayISO());

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(PIN_KEY(id)) : null;
    if (stored) setPin(stored);
  }, [id]);

  const fetchDay = useServerFn(getOperatorDay);

  const { data, isLoading, isError, error: qErr, refetch } = useQuery({
    queryKey: ["op-day", id, date, pin],
    enabled: !!pin,
    queryFn: () => fetchDay({ data: { operatorId: id, pin: pin!, date } }),
    retry: false,
  });

  useEffect(() => {
    if (isError) {
      // Bad PIN: clear it
      localStorage.removeItem(PIN_KEY(id));
      setPin(null);
      setError((qErr as Error)?.message || "Erro");
    }
  }, [isError, qErr, id]);

  if (!pin) {
    return (
      <PinScreen
        onSubmit={(p) => {
          setError("");
          setPinInput("");
          localStorage.setItem(PIN_KEY(id), p);
          setPin(p);
        }}
        error={error}
        pinInput={pinInput}
        setPinInput={setPinInput}
      />
    );
  }

  return <DayView id={id} pin={pin} date={date} setDate={setDate} data={data} isLoading={isLoading} refetch={refetch} onLogout={() => {
    localStorage.removeItem(PIN_KEY(id));
    setPin(null);
  }} />;
}

function PinScreen({
  onSubmit, error, pinInput, setPinInput,
}: { onSubmit: (pin: string) => void; error: string; pinInput: string; setPinInput: (v: string) => void }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border bg-card/50">
        <div className="hazard-stripe h-2" />
        <div className="mx-auto max-w-2xl px-6 py-4 flex items-center gap-3">
          <Link to="/" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-5 w-5" /></Link>
          <span className="font-display uppercase tracking-wide">Acesso do Operador</span>
        </div>
      </header>
      <main className="flex-1 grid place-items-center px-6 py-12">
        <form
          onSubmit={(e) => { e.preventDefault(); if (/^\d{4,8}$/.test(pinInput)) onSubmit(pinInput); }}
          className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-xl"
        >
          <h2 className="font-display text-xl font-bold uppercase mb-1">Digite seu PIN</h2>
          <p className="text-sm text-muted-foreground mb-5">PIN padrão: 1234</p>
          <input
            type="password"
            inputMode="numeric"
            autoFocus
            maxLength={8}
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
            className="w-full rounded-md border border-input bg-background px-4 py-4 text-center font-mono text-3xl tracking-[0.5em] text-foreground focus:border-primary focus:outline-none"
            placeholder="••••"
          />
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={pinInput.length < 4}
            className="mt-5 w-full rounded-md bg-accent px-4 py-3 font-semibold uppercase tracking-wide text-accent-foreground disabled:opacity-40 hover:brightness-110 transition"
          >
            Entrar
          </button>
        </form>
      </main>
    </div>
  );
}

function DayView({
  id, pin, date, setDate, data, isLoading, refetch, onLogout,
}: {
  id: string; pin: string; date: string; setDate: (d: string) => void;
  data: Awaited<ReturnType<typeof getOperatorDay>> | undefined;
  isLoading: boolean; refetch: () => void; onLogout: () => void;
}) {
  const qc = useQueryClient();
  const toggleFn = useServerFn(togglePart);
  const m = useMutation({
    mutationFn: (vars: { partId: string; checked: boolean }) =>
      toggleFn({ data: { operatorId: id, pin, partId: vars.partId, checked: vars.checked } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["op-day", id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const dateLabel = new Date(date + "T12:00").toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long",
  });

  return (
    <div className="min-h-screen pb-20">
      <header className="border-b border-border bg-card/70 backdrop-blur sticky top-0 z-10">
        <div className="hazard-stripe h-2" />
        <div className="mx-auto max-w-2xl px-6 py-4 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <Logo className="h-8 w-auto" />
          <button onClick={onLogout} className="text-xs uppercase text-muted-foreground hover:text-foreground">
            Sair
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-6 space-y-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span className="capitalize">{dateLabel}</span>
            </div>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono"
            />
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold uppercase">
            Olá, {data?.operator.name || "..."}
          </h1>
        </div>

        {/* Tasks list (ordered) */}
        <section className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="bg-primary/15 border-b border-primary/30 px-5 py-3 flex items-center justify-between">
            <h2 className="font-display text-sm font-bold uppercase tracking-wider text-primary">
              Ordem de Atendimento
            </h2>
            <span className="text-xs text-muted-foreground">
              {data?.tasks?.length ?? 0} atendimento(s)
            </span>
          </div>
          {isLoading ? (
            <div className="p-5"><div className="h-20 rounded bg-muted/50 animate-pulse" /></div>
          ) : (data?.tasks?.length ?? 0) === 0 && !data?.schedule?.task?.trim() ? (
            <p className="p-5 text-muted-foreground italic">Nenhum atendimento cadastrado para esta data.</p>
          ) : (
            <ol className="divide-y divide-border">
              {/* Legacy single task fallback */}
              {(data?.tasks?.length ?? 0) === 0 && data?.schedule?.task?.trim() && (
                <li className="p-5">
                  <p className="whitespace-pre-wrap text-lg leading-relaxed">{data.schedule.task}</p>
                </li>
              )}
              {data?.tasks?.map((t, i) => (
                <li key={t.id} className="p-5 flex gap-4">
                  <div className="flex-shrink-0 h-10 w-10 rounded-full bg-accent text-accent-foreground font-display font-bold grid place-items-center text-lg">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display text-lg font-bold uppercase leading-tight">{t.title}</h3>
                    {t.description?.trim() && (
                      <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed">
                        {t.description}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* Parts checklist */}
        <section className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="bg-accent/15 border-b border-accent/30 px-5 py-3 flex items-center gap-2">
            <Package className="h-4 w-4 text-accent" />
            <h2 className="font-display text-sm font-bold uppercase tracking-wider text-accent">
              Peças ({data?.parts.length ?? 0})
            </h2>
          </div>
          <ul className="divide-y divide-border">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <li key={i} className="h-14 bg-muted/30 animate-pulse" />
              ))
            ) : data?.parts.length === 0 ? (
              <li className="px-5 py-6 text-center text-muted-foreground italic">
                Nenhuma peça na lista.
              </li>
            ) : (
              data?.parts.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => m.mutate({ partId: p.id, checked: !p.checked })}
                    disabled={m.isPending}
                    className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-muted/30 transition-colors"
                  >
                    {p.checked ? (
                      <CheckCircle2 className="h-6 w-6 text-accent flex-shrink-0" />
                    ) : (
                      <Circle className="h-6 w-6 text-muted-foreground flex-shrink-0" />
                    )}
                    <span className={`flex-1 ${p.checked ? "line-through text-muted-foreground" : "text-foreground"}`}>
                      {p.name}
                    </span>
                    <span className="text-sm font-mono text-muted-foreground">×{p.quantity}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </section>
      </main>
    </div>
  );
}
