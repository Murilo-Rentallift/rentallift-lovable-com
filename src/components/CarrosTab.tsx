import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  ArrowLeft,
  Camera,
  Car,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  History,
  Loader2,
  Pencil,
  RotateCcw,
  Search,
  ShieldCheck,
  Plus,
  Wrench,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SignaturePad } from "@/components/SignaturePad";
import { fileToCompressedJpegDataUrl } from "@/lib/imageCompress";
import { RENTAL_LIFT_LOGO_B64 } from "@/lib/assets/rental-lift-logo-b64";
import {
  carrosListFrota,
  carrosGetVeiculo,
  carrosUpdateCondutor,
  carrosSaveChecklist,
  carrosRetirar,
  carrosDevolver,
  carrosResolvePendencia,
  carrosResolveSolicitacao,
  carrosSendChecklistEmail,
  carrosSendAlertaManutencao,
} from "@/lib/carros.functions";

const ITENS_CHECKLIST = [
  "CINTO SEGURANÇA",
  "RETROVISORES",
  "LATARIA",
  "PNEUS TRASEIROS",
  "PNEUS DIANTEIROS",
  "ESTEPE",
  "NIVEIS OLEO",
  "MANGUEIRAS",
  "FAROIS",
  "LUZ RÉ",
  "LUZ FREIO",
  "SETAS",
  "ALARME",
  "FREIO PÉ",
  "FREIO MÃO",
  "VAZAMENTO OLEO",
  "VAZAMENTO ÁGUA",
  "EXTINTOR",
];

// Itens com lógica invertida: "SIM" significa que HÁ vazamento (problema)
const ITENS_INVERTIDOS = new Set(["VAZAMENTO OLEO", "VAZAMENTO ÁGUA"]);

function respostaProblema(item: string, resposta: "sim" | "nao" | null) {
  if (!resposta) return false;
  return ITENS_INVERTIDOS.has(item) ? resposta === "sim" : resposta === "nao";
}

const STATUS_META: Record<string, { label: string; dot: string; text: string }> = {
  disponivel: { label: "Disponível", dot: "bg-emerald-500", text: "text-emerald-600" },
  pendencia: { label: "Disponível com pendência", dot: "bg-amber-500", text: "text-amber-600" },
  manutencao: { label: "Precisa manutenção", dot: "bg-red-500", text: "text-red-600" },
};

type ItemState = {
  item: string;
  resposta: "sim" | "nao" | null;
  obs: string;
  fotos: { dataUrl: string }[];
};

function fmtDate(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}
function fmtDateTime(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function RetiradasTable({ retiradas }: { retiradas: any[] }) {
  if (!retiradas.length)
    return <p className="mt-3 text-sm text-muted-foreground">Nenhuma retirada registrada.</p>;
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-muted-foreground">
          <tr>
            <th className="p-2">Quem pegou</th>
            <th className="p-2">Destino/Motivo</th>
            <th className="p-2">Saída</th>
            <th className="p-2">KM saída</th>
            <th className="p-2">Retorno</th>
            <th className="p-2">KM retorno</th>
            <th className="p-2">Observação</th>
          </tr>
        </thead>
        <tbody>
          {retiradas.map((r) => (
            <tr key={r.id} className="border-t border-border">
              <td className="p-2">{r.retirado_por}</td>
              <td className="p-2">{r.destino_motivo || "—"}</td>
              <td className="p-2">{fmtDateTime(r.data_saida)}</td>
              <td className="p-2">{r.km_saida ?? "—"}</td>
              <td className="p-2">{r.data_retorno ? fmtDateTime(r.data_retorno) : "Em uso"}</td>
              <td className="p-2">{r.km_retorno ?? "—"}</td>
              <td className="p-2">
                {r.observacao_devolucao ? (
                  <span className="text-red-600">
                    {r.observacao_devolucao} (gerou manutenção)
                  </span>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReservaHistoricoCard({ pin, veiculo }: { pin: string; veiculo: any }) {
  const getVeiculo = useServerFn(carrosGetVeiculo);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [retiradas, setRetiradas] = useState<any[] | null>(null);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !retiradas) {
      setLoading(true);
      try {
        const r: any = await getVeiculo({ data: { pin, id: veiculo.id } });
        setRetiradas(r.retiradas ?? []);
      } catch (e: any) {
        toast.error(e.message || "Falha ao carregar histórico");
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <button
        type="button"
        onClick={() => void toggle()}
        className="flex w-full items-center justify-between text-left"
      >
        <span>
          <span className="block text-base font-bold tracking-wide">{veiculo.placa}</span>
          <span className="block text-sm text-muted-foreground">
            {veiculo.veiculo} • Frota {veiculo.numero_frota}
            {veiculo.emUso ? ` • Em uso (${veiculo.emUso.retirado_por})` : ""}
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open &&
        (loading ? (
          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando histórico...
          </div>
        ) : (
          <RetiradasTable retiradas={retiradas ?? []} />
        ))}
    </div>
  );
}

export function CarrosTab({ pin }: { pin: string }) {

  const listFrota = useServerFn(carrosListFrota);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [qFrota, setQFrota] = useState("");
  const [qCondutor, setQCondutor] = useState("todos");
  const [histOpen, setHistOpen] = useState(false);
  const reservas = useMemo(
    () =>
      rows.filter((r) => (r.condutor_atual ?? "").trim().toUpperCase().startsWith("RESERVA")),
    [rows],
  );


  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await listFrota({ data: { pin } });
      setRows(r as any[]);
    } catch (e: any) {
      toast.error(e.message || "Falha ao carregar frota");
    } finally {
      setLoading(false);
    }
  }, [listFrota, pin]);

  useEffect(() => {
    void load();
  }, [load]);

  const condutores = useMemo(
    () => Array.from(new Set(rows.map((r) => r.condutor_atual).filter(Boolean))).sort(),
    [rows],
  );

  const filtered = rows.filter((r) => {
    const okFrota =
      !qFrota.trim() ||
      r.numero_frota.includes(qFrota.trim()) ||
      r.placa.toLowerCase().includes(qFrota.trim().toLowerCase());
    const okCond = qCondutor === "todos" || r.condutor_atual === qCondutor;
    return okFrota && okCond;
  });

  const tudoEmDia = rows.length > 0 && rows.every((r) => r.status !== "manutencao");

  if (selected) {
    return (
      <VeiculoDetalhe
        pin={pin}
        id={selected}
        onBack={() => {
          setSelected(null);
          void load();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Car className="h-5 w-5" /> Frota de Carros
        </h2>
        {tudoEmDia && (
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-600">
            <ShieldCheck className="h-4 w-4" /> Frota 100% em dia
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar por frota ou placa"
            value={qFrota}
            onChange={(e) => setQFrota(e.target.value)}
          />
        </div>
        <Select value={qCondutor} onValueChange={setQCondutor}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Condutor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os condutores</SelectItem>
            {condutores.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <button
        type="button"
        onClick={() => setHistOpen(true)}
        className="flex w-full items-center justify-between rounded-xl border border-border bg-card p-4 text-left transition hover:border-primary/60 hover:shadow-md"
      >
        <span className="flex items-center gap-2 font-semibold">
          <History className="h-5 w-5" /> Histórico de Uso
        </span>
        <span className="text-sm text-muted-foreground">Ver por veículo reserva</span>
      </button>

      <Dialog open={histOpen} onOpenChange={setHistOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" /> Histórico de Uso — Veículos Reserva
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {reservas.map((v) => (
              <ReservaHistoricoCard key={v.id} pin={pin} veiculo={v} />
            ))}
            {!reservas.length && (
              <p className="text-sm text-muted-foreground">
                Nenhum veículo reserva cadastrado.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>



      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando frota...
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((v) => {
            const meta = STATUS_META[v.status] ?? STATUS_META.disponivel;
            return (
              <button
                key={v.id}
                onClick={() => setSelected(v.id)}
                className="rounded-xl border border-border bg-card p-4 text-left transition hover:border-primary/60 hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-lg font-bold tracking-wide">{v.placa}</div>
                    <div className="text-sm text-muted-foreground">
                      {v.veiculo} • Frota {v.numero_frota}
                    </div>
                  </div>
                  <span className={`mt-1 h-3 w-3 rounded-full ${meta.dot}`} />
                </div>
                <div className={`mt-2 text-xs font-medium ${meta.text}`}>{meta.label}</div>
                <div className="mt-2 text-sm">
                  Condutor: <span className="font-medium">{v.condutor_atual || "—"}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Último checklist: {fmtDate(v.ultimoChecklist)}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {v.pendenciasAbertas > 0 && (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-600">
                      {v.pendenciasAbertas} pendência(s)
                    </span>
                  )}
                  {v.manutencoesAbertas > 0 && (
                    <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs text-red-600">
                      {v.manutencoesAbertas} manutenção(ões)
                    </span>
                  )}
                  {v.emUso && (
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">
                      Em uso — {v.emUso.retirado_por}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
          {!filtered.length && (
            <p className="text-sm text-muted-foreground">Nenhum veículo encontrado.</p>
          )}
        </div>
      )}
    </div>
  );
}

function VeiculoDetalhe({
  pin,
  id,
  onBack,
}: {
  pin: string;
  id: string;
  onBack: () => void;
}) {
  const getVeiculo = useServerFn(carrosGetVeiculo);
  const updCondutor = useServerFn(carrosUpdateCondutor);
  const resolvePend = useServerFn(carrosResolvePendencia);
  const resolveSol = useServerFn(carrosResolveSolicitacao);
  const retirar = useServerFn(carrosRetirar);
  const devolver = useServerFn(carrosDevolver);
  const alerta = useServerFn(carrosSendAlertaManutencao);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editCondutor, setEditCondutor] = useState(false);
  const [condutorTmp, setCondutorTmp] = useState("");
  const [verHistorico, setVerHistorico] = useState(false);

  const [checklistOpen, setChecklistOpen] = useState(false);
  const [verChecklist, setVerChecklist] = useState<any | null>(null);

  const [retiradaOpen, setRetiradaOpen] = useState(false);
  const [rPor, setRPor] = useState("");
  const [rDestino, setRDestino] = useState("");
  const [rKm, setRKm] = useState("");
  const [devolucaoOpen, setDevolucaoOpen] = useState(false);
  const [dKm, setDKm] = useState("");
  const [dObs, setDObs] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getVeiculo({ data: { pin, id } });
      setData(r);
      setCondutorTmp((r as any).veiculo.condutor_atual);
    } catch (e: any) {
      toast.error(e.message || "Falha ao carregar veículo");
    } finally {
      setLoading(false);
    }
  }, [getVeiculo, pin, id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading || !data) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
      </div>
    );
  }

  const v = data.veiculo;
  const meta = STATUS_META[v.status] ?? STATUS_META.disponivel;
  const emUso = (data.retiradas as any[]).find((r) => !r.data_retorno) ?? null;
  const pendenciasAbertas = (data.pendencias as any[]).filter((p) => p.status === "aberta");
  const solicitacoesAbertas = (data.solicitacoes as any[]).filter((s) => s.status === "aberta");
  const label = `${v.veiculo} — Frota ${v.numero_frota} — ${v.placa}`;

  async function salvarCondutor() {
    try {
      await updCondutor({ data: { pin, id, condutor: condutorTmp } });
      setEditCondutor(false);
      toast.success("Condutor atualizado");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Falha ao salvar condutor");
    }
  }

  async function confirmarRetirada() {
    if (!rPor.trim()) return toast.error("Informe quem está retirando");
    setBusy(true);
    try {
      await retirar({
        data: {
          pin,
          veiculoId: id,
          retiradoPor: rPor,
          destinoMotivo: rDestino,
          kmSaida: rKm ? Number(rKm) : null,
        },
      });
      setRetiradaOpen(false);
      setRPor("");
      setRDestino("");
      setRKm("");
      toast.success("Veículo retirado");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Falha ao registrar retirada");
    } finally {
      setBusy(false);
    }
  }

  async function confirmarDevolucao() {
    if (!emUso) return;
    setBusy(true);
    try {
      const res: any = await devolver({
        data: {
          pin,
          retiradaId: emUso.id,
          kmRetorno: dKm ? Number(dKm) : null,
          observacao: dObs,
        },
      });
      setDevolucaoOpen(false);
      setDKm("");
      const obs = dObs;
      setDObs("");
      toast.success("Devolução registrada");
      if (res?.solicitacaoId) {
        try {
          await alerta({
            data: {
              pin,
              veiculoLabel: label,
              origem: "Devolução de reserva",
              descricao: obs,
              extraRecipients: [],
            },
          });
          toast.success("Alerta de manutenção enviado");
        } catch (e: any) {
          toast.error(e.message || "Falha ao enviar alerta de manutenção");
        }
      }
      await load();
    } catch (e: any) {
      toast.error(e.message || "Falha ao registrar devolução");
    } finally {
      setBusy(false);
    }
  }

  if (checklistOpen) {
    return (
      <ChecklistFlow
        pin={pin}
        veiculo={v}
        onCancel={() => setChecklistOpen(false)}
        onDone={async () => {
          setChecklistOpen(false);
          await load();
        }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> Voltar para a frota
      </Button>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-2xl font-bold tracking-wide">{v.placa}</div>
            <div className="text-sm text-muted-foreground">
              {v.veiculo} • Frota {v.numero_frota}
            </div>
            <div className="mt-2 flex items-center gap-2 text-sm">
              <span>Condutor:</span>
              {editCondutor ? (
                <>
                  <Input
                    className="h-8 w-48"
                    value={condutorTmp}
                    onChange={(e) => setCondutorTmp(e.target.value)}
                  />
                  <Button size="sm" onClick={salvarCondutor}>
                    Salvar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditCondutor(false);
                      setCondutorTmp(v.condutor_atual);
                    }}
                  >
                    Cancelar
                  </Button>
                </>
              ) : (
                <>
                  <span className="font-medium">{v.condutor_atual || "—"}</span>
                  <Button size="icon" variant="ghost" onClick={() => setEditCondutor(true)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium ${meta.text}`}
            >
              <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} /> {meta.label}
            </span>
            <Button onClick={() => setChecklistOpen(true)} className="gap-2">
              <ClipboardCheck className="h-4 w-4" /> Novo Checklist
            </Button>
            {emUso ? (
              <Button variant="secondary" className="gap-2" onClick={() => setDevolucaoOpen(true)}>
                <RotateCcw className="h-4 w-4" /> Devolver veículo
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setRetiradaOpen(true)}>
                Registrar Saída
              </Button>
            )}
          </div>
        </div>
        {emUso && (
          <div className="mt-3 rounded-lg bg-primary/10 p-3 text-sm">
            <strong>Em uso</strong> por {emUso.retirado_por} — {emUso.destino_motivo || "sem destino informado"} • desde{" "}
            {fmtDateTime(emUso.data_saida)} • KM saída: {emUso.km_saida ?? "—"}
          </div>
        )}
      </div>

      <section className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-3 font-semibold">Pendências em aberto</h3>
        {!pendenciasAbertas.length && !solicitacoesAbertas.length ? (
          <p className="text-sm text-muted-foreground">Nenhuma pendência em aberto.</p>
        ) : (
          <div className="space-y-2">
            {pendenciasAbertas.map((p: any) => (
              <div
                key={p.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium">{p.item}</div>
                  <div className="text-sm text-muted-foreground">{p.descricao || "—"}</div>
                  <div className="text-xs text-muted-foreground">{fmtDateTime(p.created_at)}</div>
                  {!!p.fotosUrls?.filter(Boolean).length && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {p.fotosUrls.filter(Boolean).map((u: string, i: number) => (
                        <a key={i} href={u} target="_blank" rel="noreferrer">
                          <img src={u} alt={`Foto da pendência ${p.item}`} className="h-16 w-16 rounded object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await resolvePend({ data: { pin, id: p.id } });
                    toast.success("Pendência resolvida");
                    await load();
                  }}
                >
                  Marcar como resolvido
                </Button>
              </div>
            ))}
            {solicitacoesAbertas.map((s: any) => (
              <div
                key={s.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/5 p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Wrench className="h-4 w-4" /> Solicitação de manutenção (
                    {s.origem === "checklist" ? "checklist" : "devolução de reserva"})
                  </div>
                  <div className="text-sm text-muted-foreground">{s.descricao}</div>
                  <div className="text-xs text-muted-foreground">{fmtDateTime(s.created_at)}</div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await resolveSol({ data: { pin, id: s.id } });
                    toast.success("Solicitação resolvida");
                    await load();
                  }}
                >
                  Marcar como resolvido
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-3 font-semibold">Histórico de Checklists</h3>
        {!data.checklists.length ? (
          <p className="text-sm text-muted-foreground">Nenhum checklist registrado.</p>
        ) : (
          <ul className="space-y-2">
            {data.checklists.map((c: any) => {
              const m = STATUS_META[c.status_final] ?? STATUS_META.disponivel;
              return (
                <li key={c.id}>
                  <button
                    onClick={() => setVerChecklist(c)}
                    className="flex w-full items-center justify-between rounded-lg border border-border p-3 text-left text-sm hover:border-primary/60"
                  >
                    <span>
                      {fmtDate(c.data)} • {c.vistoriador || "sem vistoriador"} • condutor {c.condutor || "—"}
                    </span>
                    <span className={`flex items-center gap-2 ${m.text}`}>
                      <span className={`h-2.5 w-2.5 rounded-full ${m.dot}`} /> {m.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <button
          type="button"
          onClick={() => setVerHistorico((s) => !s)}
          className="flex w-full items-center justify-between text-left font-semibold"
        >
          <span className="flex items-center gap-2">
            <History className="h-4 w-4" /> Histórico de Uso (Reservas)
          </span>
          <ChevronDown
            className={`h-4 w-4 transition ${verHistorico ? "rotate-180" : ""}`}
          />
        </button>
        {verHistorico && <RetiradasTable retiradas={data.retiradas as any[]} />}
      </section>


      {!!data.historicoCondutores.length && (
        <section className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 font-semibold">Trocas de condutor</h3>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {data.historicoCondutores.map((h: any) => (
              <li key={h.id}>
                {fmtDateTime(h.created_at)} — {h.condutor_anterior || "—"} → {h.condutor_novo}
              </li>
            ))}
          </ul>
        </section>
      )}

      <Dialog open={retiradaOpen} onOpenChange={setRetiradaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Retirar veículo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Retirado por</Label>
              <Input value={rPor} onChange={(e) => setRPor(e.target.value)} />
            </div>
            <div>
              <Label>Destino / Motivo</Label>
              <Input value={rDestino} onChange={(e) => setRDestino(e.target.value)} />
            </div>
            <div>
              <Label>KM de saída</Label>
              <Input type="number" value={rKm} onChange={(e) => setRKm(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={confirmarRetirada} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar retirada
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={devolucaoOpen} onOpenChange={setDevolucaoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Devolver veículo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>KM de retorno</Label>
              <Input type="number" value={dKm} onChange={(e) => setDKm(e.target.value)} />
            </div>
            <div>
              <Label>Observação de devolução (opcional)</Label>
              <Textarea
                rows={4}
                value={dObs}
                onChange={(e) => setDObs(e.target.value)}
                placeholder="Se preenchida, gera solicitação de manutenção e alerta por e-mail"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={confirmarDevolucao} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar devolução
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!verChecklist} onOpenChange={(o) => !o && setVerChecklist(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Checklist de {fmtDate(verChecklist?.data)}</DialogTitle>
          </DialogHeader>
          {verChecklist && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>Frota: {verChecklist.frota}</div>
                <div>Placa: {verChecklist.placa}</div>
                <div>Condutor: {verChecklist.condutor}</div>
                <div>Vistoriador: {verChecklist.vistoriador}</div>
                <div>Líder: {verChecklist.lider}</div>
                <div>Status: {STATUS_META[verChecklist.status_final]?.label}</div>
              </div>
              <ul className="divide-y divide-border rounded-lg border border-border">
                {(verChecklist.itens as any[]).map((i, idx) => (
                  <li key={idx} className="flex items-start justify-between gap-3 p-2">
                    <span>{i.item}</span>
                    <span className={respostaProblema(i.item, i.resposta) ? "text-red-600" : "text-emerald-600"}>
                      {i.resposta ? i.resposta.toUpperCase() : "—"}
                      {i.obs ? ` — ${i.obs}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
              <div>
                <strong>Observação manutenção corretiva:</strong>{" "}
                {verChecklist.obs_manutencao || "—"}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ChecklistFlow({
  pin,
  veiculo,
  onCancel,
  onDone,
}: {
  pin: string;
  veiculo: any;
  onCancel: () => void;
  onDone: () => void;
}) {
  const save = useServerFn(carrosSaveChecklist);
  const sendEmail = useServerFn(carrosSendChecklistEmail);
  const alerta = useServerFn(carrosSendAlertaManutencao);

  const [frota, setFrota] = useState(veiculo.numero_frota);
  const [placa, setPlaca] = useState(veiculo.placa);
  const [condutor, setCondutor] = useState(veiculo.condutor_atual);
  const [dataCk, setDataCk] = useState(new Date().toISOString().slice(0, 10));
  const [vistoriador, setVistoriador] = useState("");
  const [lider, setLider] = useState("");
  const [obsManutencao, setObsManutencao] = useState("");
  const [statusFinal, setStatusFinal] = useState<"disponivel" | "pendencia" | "manutencao">(
    "disponivel",
  );
  const [assVistoriador, setAssVistoriador] = useState("");
  const [assLider, setAssLider] = useState("");
  const [assCondutor, setAssCondutor] = useState("");
  const [extraEmails, setExtraEmails] = useState("");
  const [destinoAtivo, setDestinoAtivo] = useState(false);
  const [destino, setDestino] = useState("");
  const [idx, setIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const fotosGeraisRef = useRef<HTMLInputElement>(null);
  const [fotosGerais, setFotosGerais] = useState<{ dataUrl: string }[]>([]);

  async function addFotosGerais(files: FileList | null) {
    if (!files?.length) return;
    const novas: { dataUrl: string }[] = [];
    for (const f of Array.from(files)) {
      novas.push({ dataUrl: await fileToCompressedJpegDataUrl(f, { maxWidth: 1000, quality: 0.7 }) });
    }
    setFotosGerais((prev) => [...prev, ...novas]);
  }


  const [itens, setItens] = useState<ItemState[]>(
    ITENS_CHECKLIST.map((item) => ({ item, resposta: null, obs: "", fotos: [] })),
  );

  const respondidos = itens.filter((i) => i.resposta).length;
  const atual = itens[idx];

  function setAtual(patch: Partial<ItemState>) {
    setItens((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  async function addFotos(files: FileList | null) {
    if (!files?.length) return;
    const novas: { dataUrl: string }[] = [];
    for (const f of Array.from(files)) {
      novas.push({ dataUrl: await fileToCompressedJpegDataUrl(f, { maxWidth: 1000, quality: 0.7 }) });
    }
    setAtual({ fotos: [...atual.fotos, ...novas] });
  }

  function gerarPDF(): { doc: jsPDF; fileName: string } {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    const logo = `data:image/png;base64,${RENTAL_LIFT_LOGO_B64}`;
    try {
      doc.addImage(logo, "PNG", 12, 8, 32, 14);
      doc.addImage(logo, "PNG", W - 44, 8, 32, 14);
    } catch {
      /* logo opcional */
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("CHECK LIST VEICULOS FROTA", W / 2, 17, { align: "center" });

    doc.setFontSize(10);
    autoTable(doc, {
      startY: 26,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 2 },
      body: [
        [
          { content: `FROTA: ${frota}`, styles: { fontStyle: "bold" as const } },
          { content: `PLACA: ${placa}`, styles: { fontStyle: "bold" as const } },
          { content: `CONDUTOR: ${condutor}`, styles: { fontStyle: "bold" as const } },
          { content: `DATA: ${dataCk.split("-").reverse().join("/")}`, styles: { fontStyle: "bold" as const } },
        ],
        ...(destino.trim()
          ? [[{ content: `DESTINO/MOTIVO: ${destino.trim()}`, colSpan: 4, styles: { fontStyle: "bold" as const } }]]
          : []),
      ] as any,
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 4,
      theme: "grid",
      head: [["ITEM VERIFICADO", "SIM", "NÃO"]],
      headStyles: { fillColor: [180, 0, 0], textColor: 255, halign: "center" },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: { 1: { halign: "center", cellWidth: 22 }, 2: { halign: "center", cellWidth: 22 } },
      body: itens.map((i) => [
        i.item,
        i.resposta === "sim" ? "X" : "",
        i.resposta === "nao" ? "X" : "",
      ]),
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 4,
      theme: "grid",
      head: [["OBSERVAÇÃO MANUTENÇÃO CORRETIVA (QUEIXA CONDUTOR)"]],
      headStyles: { fillColor: [180, 0, 0], textColor: 255 },
      styles: { fontSize: 9, cellPadding: 3, minCellHeight: 24 },
      body: [[obsManutencao || ""]],
    });

    const sigY = (doc as any).lastAutoTable.finalY + 8;
    const colW = (W - 24) / 3;
    const sigs: [string, string][] = [
      ["VISTORIADOR", assVistoriador],
      ["LIDER", assLider],
      ["CONDUTOR", assCondutor],
    ];
    sigs.forEach(([nome, img], i) => {
      const x = 12 + i * colW;
      if (img) {
        try {
          doc.addImage(img, "PNG", x + 4, sigY, colW - 12, 18);
        } catch {
          /* assinatura opcional */
        }
      }
      doc.setDrawColor(120);
      doc.line(x + 2, sigY + 20, x + colW - 6, sigY + 20);
      doc.setFontSize(8);
      doc.text(nome, x + 2, sigY + 24);
    });

    autoTable(doc, {
      startY: sigY + 28,
      theme: "grid",
      head: [["AÇÕES TOMADAS"]],
      headStyles: { fillColor: [180, 0, 0], textColor: 255 },
      styles: { fontSize: 9, cellPadding: 3, minCellHeight: 22 },
      body: [[""]],
    });

    if (fotosGerais.length) {
      doc.addPage();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("FOTOS GERAIS DO VEÍCULO", W / 2, 16, { align: "center" });
      const cols = 2;
      const imgW = (W - 24 - 8) / cols;
      const imgH = imgW * 0.72;
      let x = 12;
      let y = 24;
      fotosGerais.forEach((f, i) => {
        if (y + imgH > doc.internal.pageSize.getHeight() - 12) {
          doc.addPage();
          y = 20;
          x = 12;
        }
        try {
          doc.addImage(f.dataUrl, "JPEG", x, y, imgW, imgH);
        } catch {
          /* foto opcional */
        }
        if ((i + 1) % cols === 0) {
          x = 12;
          y += imgH + 6;
        } else {
          x += imgW + 8;
        }
      });
    }

    const fileName = `checklist-veiculo-${placa}-${dataCk}.pdf`;

    return { doc, fileName };
  }

  async function finalizar() {
    if (!vistoriador.trim()) return toast.error("Informe o vistoriador");
    const naoRespondidos = itens.filter((i) => !i.resposta);
    if (naoRespondidos.length) return toast.error("Responda todos os 18 itens");
    const semObs = itens.find((i) => respostaProblema(i.item, i.resposta) && !i.obs.trim());
    if (semObs) return toast.error(`Observação obrigatória no item ${semObs.item}`);

    setBusy(true);
    try {
      const res: any = await save({
        data: {
          pin,
          veiculoId: veiculo.id,
          frota,
          placa,
          condutor,
          data: dataCk,
          vistoriador,
          lider,
          obsManutencao,
          statusFinal,
          assinaturas: {
            vistoriador: assVistoriador,
            lider: assLider,
            condutor: assCondutor,
          },
          itens: itens.map((i) => ({
            item: i.item,
            resposta: i.resposta,
            obs: i.obs,
            fotos: i.fotos,
          })),
          fotosGerais,

        },
      });

      const { doc, fileName } = gerarPDF();
      doc.save(fileName);
      const pdfBase64 = doc.output("datauristring").split(",")[1];
      try {
        await sendEmail({
          data: {
            pin,
            fileName,
            pdfBase64,
            body: [
              "Checklist de veículo finalizado.",
              "",
              `Veículo: ${veiculo.veiculo} — Frota ${frota} — Placa ${placa}`,
              `Condutor: ${condutor}`,
              `Vistoriador: ${vistoriador}`,
              ...(destino.trim() ? [`Destino/Motivo: ${destino.trim()}`] : []),
              `Status final: ${STATUS_META[statusFinal].label}`,
            ].join("\n"),
          },
        });
        toast.success("PDF gerado e enviado por e-mail");
      } catch (e: any) {
        toast.error(e.message || "PDF gerado, mas falha no envio do e-mail");
      }

      if (res?.solicitacaoId) {
        const extras = extraEmails
          .split(/[,;\s]+/)
          .map((s) => s.trim())
          .filter(Boolean);
        try {
          await alerta({
            data: {
              pin,
              veiculoLabel: `${veiculo.veiculo} — Frota ${frota} — ${placa}`,
              origem: "Checklist",
              descricao:
                [obsManutencao, ...itens.filter((i) => respostaProblema(i.item, i.resposta)).map((i) => `${i.item}: ${i.obs}`)]
                  .filter(Boolean)
                  .join(" | ") || "Checklist com necessidade de manutenção",
              extraRecipients: extras,
            },
          });
          toast.success("Alerta de manutenção enviado");
        } catch (e: any) {
          toast.error(e.message || "Falha ao enviar alerta de manutenção");
        }
      }

      onDone();
    } catch (e: any) {
      toast.error(e.message || "Falha ao salvar checklist");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onCancel} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> Cancelar checklist
      </Button>

      <div className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-3">
        <div>
          <Label>Frota</Label>
          <Input value={frota} onChange={(e) => setFrota(e.target.value)} />
        </div>
        <div>
          <Label>Placa</Label>
          <Input value={placa} onChange={(e) => setPlaca(e.target.value)} />
        </div>
        <div>
          <Label>Condutor</Label>
          <Input value={condutor} onChange={(e) => setCondutor(e.target.value)} />
        </div>
        <div>
          <Label>Data</Label>
          <Input type="date" value={dataCk} onChange={(e) => setDataCk(e.target.value)} />
        </div>
        <div>
          <Label>Vistoriador</Label>
          <Input value={vistoriador} onChange={(e) => setVistoriador(e.target.value)} />
        </div>
        <div>
          <Label>Líder</Label>
          <Input value={lider} onChange={(e) => setLider(e.target.value)} />
        </div>
        {destinoAtivo && (
          <div className="sm:col-span-3">
            <div className="flex items-center justify-between">
              <Label>Destino / Motivo da saída</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDestinoAtivo(false);
                  setDestino("");
                }}
              >
                Remover
              </Button>
            </div>
            <Input
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
              placeholder="Ex.: Obra Cliente X — entrega de peças"
            />
          </div>
        )}
        {!destinoAtivo && (
          <div className="sm:col-span-3">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setDestinoAtivo(true)}>
              <Plus className="h-4 w-4" /> Adicionar destino
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium">
            Item {idx + 1} de {ITENS_CHECKLIST.length}
          </span>
          <span className="text-muted-foreground">
            {respondidos}/{ITENS_CHECKLIST.length} respondidos
          </span>
        </div>
        <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${(respondidos / ITENS_CHECKLIST.length) * 100}%` }}
          />
        </div>

        <div className="text-center">
          <div className="text-xl font-bold">{atual.item}</div>
          <div className="mt-4 flex justify-center gap-3">
            <Button
              variant={
                atual.resposta === "sim"
                  ? ITENS_INVERTIDOS.has(atual.item)
                    ? "destructive"
                    : "default"
                  : "outline"
              }
              onClick={() => {
                setAtual({ resposta: "sim" });
                if (ITENS_INVERTIDOS.has(atual.item)) {
                  setTimeout(() => fileRef.current?.click(), 100);
                }
              }}
            >
              SIM
            </Button>
            <Button
              variant={
                atual.resposta === "nao"
                  ? ITENS_INVERTIDOS.has(atual.item)
                    ? "default"
                    : "destructive"
                  : "outline"
              }
              onClick={() => {
                setAtual({ resposta: "nao" });
                if (!ITENS_INVERTIDOS.has(atual.item)) {
                  setTimeout(() => fileRef.current?.click(), 100);
                }
              }}
            >
              NÃO
            </Button>
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={(e) => {
            void addFotos(e.target.files);
            e.target.value = "";
          }}
        />

        {respostaProblema(atual.item, atual.resposta) && (
          <div className="mt-4 space-y-3">
            <div>
              <Label>Observação (obrigatória)</Label>
              <Textarea
                rows={3}
                value={atual.obs}
                onChange={(e) => setAtual({ obs: e.target.value })}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => fileRef.current?.click()}>
                <Camera className="h-4 w-4" /> Adicionar foto
              </Button>
              {atual.fotos.map((f, i) => (
                <img key={i} src={f.dataUrl} alt={`Foto ${i + 1} do item ${atual.item}`} className="h-14 w-14 rounded object-cover" />
              ))}
            </div>
          </div>
        )}


        <div className="mt-5 flex flex-wrap justify-center gap-1">
          {itens.map((it, i) => (
            <button
              key={it.item}
              onClick={() => setIdx(i)}
              title={it.item}
              className={`h-7 w-7 rounded text-xs font-medium ${
                i === idx
                  ? "bg-primary text-primary-foreground"
                  : respostaProblema(it.item, it.resposta)
                    ? "bg-red-500/20 text-red-600"
                    : it.resposta
                      ? "bg-emerald-500/20 text-emerald-600"
                      : "bg-muted text-muted-foreground"
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>

        <div className="mt-4 flex justify-between">
          <Button variant="outline" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>
            Anterior
          </Button>
          <Button
            variant="outline"
            onClick={() => setIdx((i) => Math.min(ITENS_CHECKLIST.length - 1, i + 1))}
            disabled={idx === ITENS_CHECKLIST.length - 1}
          >
            Próximo
          </Button>
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-border bg-card p-4">
        <div>
          <Label>Observação Manutenção Corretiva (Queixa Condutor)</Label>
          <Textarea rows={4} value={obsManutencao} onChange={(e) => setObsManutencao(e.target.value)} />
        </div>

        <div>
          <Label>Status final do veículo</Label>
          <Select value={statusFinal} onValueChange={(v) => setStatusFinal(v as any)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="disponivel">Disponível (verde)</SelectItem>
              <SelectItem value="pendencia">Disponível com pendência (amarelo)</SelectItem>
              <SelectItem value="manutencao">Precisa manutenção (vermelho)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {statusFinal === "manutencao" && (
          <div>
            <Label>E-mails adicionais para o alerta de manutenção (opcional)</Label>
            <Input
              value={extraEmails}
              onChange={(e) => setExtraEmails(e.target.value)}
              placeholder="email1@empresa.com, email2@empresa.com"
            />
          </div>
        )}

        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <Label className="text-base">Fotos do veículo</Label>
              <p className="text-xs text-muted-foreground">
                Fotos gerais do estado do veículo (opcional, várias fotos).
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => fotosGeraisRef.current?.click()}
            >
              <Camera className="h-4 w-4" /> Adicionar fotos
            </Button>
          </div>
          <input
            ref={fotosGeraisRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              void addFotosGerais(e.target.files);
              e.target.value = "";
            }}
          />
          {!!fotosGerais.length && (
            <div className="mt-3 flex flex-wrap gap-2">
              {fotosGerais.map((f, i) => (
                <div key={i} className="relative">
                  <img
                    src={f.dataUrl}
                    alt={`Foto geral ${i + 1} do veículo`}
                    className="h-20 w-20 rounded object-cover"
                  />
                  <button
                    type="button"
                    aria-label={`Remover foto ${i + 1}`}
                    onClick={() => setFotosGerais((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute -right-1 -top-1 rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>


        <div className="grid gap-4 sm:grid-cols-3">
          <SignaturePad label="Vistoriador" value={assVistoriador} onChange={setAssVistoriador} />
          <SignaturePad label="Líder" value={assLider} onChange={setAssLider} />
          <SignaturePad label="Condutor" value={assCondutor} onChange={setAssCondutor} />
        </div>

        <Button onClick={finalizar} disabled={busy} className="w-full gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Finalizar checklist, gerar PDF e enviar por e-mail
        </Button>
      </div>
    </div>
  );
}
