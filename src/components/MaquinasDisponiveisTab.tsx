import { useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listMaquinas,
  createMaquina,
  updateMaquina,
  deleteMaquina,
  type MaquinaRow,
} from "@/lib/maquinas.functions";
import { fileToCompressedJpegDataUrl } from "@/lib/imageCompress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  ChevronLeft,
  ChevronRight,
  ImageOff,
  X,
  Forklift,
  BatteryCharging,
  Fuel,
  Truck,
  PackageOpen,
  ArrowLeft,
  Camera,
  Upload,
  ClipboardList,
  Check,
} from "lucide-react";
import { toast } from "sonner";

const TIPOS = [
  "GLP 1.8 TON",
  "GLP 2.5 TON",
  "GLP 3.5 TON",
  "GLP 3.8 TON",
  "GLP 4 TON",
  "GLP 7 TON",
  "LITIO 1.8 TON",
  "LITIO 2.5 TON",
  "LITIO 3 TON",
  "LITIO 3.5 TON",
  "LITIO 3.8 TON",
  "RETRÁTIL",
  "TRANSPALETEIRA",
  "PALETEIRA COM TORRE",
] as const;

function tileIcon(tipo: string) {
  if (tipo.startsWith("GLP")) return Fuel;
  if (tipo.startsWith("LITIO")) return BatteryCharging;
  if (tipo === "RETRÁTIL") return Forklift;
  if (tipo === "TRANSPALETEIRA") return Truck;
  return PackageOpen;
}

type NovaFoto = { dataUrl: string; name?: string };

type FormState = {
  id?: string;
  tipo: string;
  frota: string;
  modelo: string;
  marca: string;
  anoFabricacao: string;
  status: "disponivel" | "reservada";
  condicao: "nova" | "usada";
  observacoes: string;
  fotosExistentes: string[];
  fotosExistentesUrls: string[];
  novasFotos: NovaFoto[];
};

const emptyForm = (tipo: string): FormState => ({
  tipo,
  frota: "",
  modelo: "",
  marca: "",
  anoFabricacao: "",
  status: "disponivel",
  condicao: "usada",
  observacoes: "",
  fotosExistentes: [],
  fotosExistentesUrls: [],
  novasFotos: [],
});

function Galeria({
  urls,
  onOpen,
}: {
  urls: string[];
  onOpen?: (index: number) => void;
}) {
  const [i, setI] = useState(0);
  if (!urls.length) {
    return (
      <div className="flex h-40 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <ImageOff className="h-6 w-6" />
      </div>
    );
  }
  const idx = Math.min(i, urls.length - 1);
  return (
    <div className="relative h-40 overflow-hidden rounded-md bg-muted">
      <button
        type="button"
        onClick={() => onOpen?.(idx)}
        className="block h-40 w-full cursor-zoom-in"
        aria-label="Ampliar foto"
      >
        <img
          src={urls[idx]}
          alt="Foto da máquina"
          loading="lazy"
          className="h-40 w-full object-cover"
        />
      </button>
      {urls.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => setI((v) => (v - 1 + urls.length) % urls.length)}
            className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-1"
            aria-label="Foto anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setI((v) => (v + 1) % urls.length)}
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-1"
            aria-label="Próxima foto"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <span className="absolute bottom-1 right-2 rounded bg-background/80 px-1.5 text-xs">
            {idx + 1}/{urls.length}
          </span>
        </>
      )}
    </div>
  );
}

function Lightbox({
  urls,
  index,
  onIndex,
  onClose,
}: {
  urls: string[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const idx = Math.min(index, urls.length - 1);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl border-border/60 bg-background/95 p-3">
        <DialogHeader className="sr-only">
          <DialogTitle>Visualizador de fotos</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <img
            src={urls[idx]}
            alt={`Foto ${idx + 1}`}
            className="max-h-[75vh] w-full rounded-md object-contain"
          />
          {urls.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => onIndex((idx - 1 + urls.length) % urls.length)}
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 hover:bg-background"
                aria-label="Foto anterior"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => onIndex((idx + 1) % urls.length)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 hover:bg-background"
                aria-label="Próxima foto"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded bg-background/80 px-2 py-0.5 text-xs">
                {idx + 1}/{urls.length}
              </span>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function MaquinasDisponiveisTab() {
  const qc = useQueryClient();
  const list = useServerFn(listMaquinas);
  const create = useServerFn(createMaquina);
  const update = useServerFn(updateMaquina);
  const remove = useServerFn(deleteMaquina);

  const [busca, setBusca] = useState("");
  const [tipoAtivo, setTipoAtivo] = useState<string | null>(null);
  const [condicaoFiltro, setCondicaoFiltro] = useState<"nova" | "usada">("usada");
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null);
  const [pendForm, setPendForm] = useState<
    Record<string, { tipo: string; condicao: "" | "nova" | "usada"; status: "disponivel" | "reservada" }>
  >({});
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  const { data: maquinas = [], isLoading } = useQuery({
    queryKey: ["maquinas-disponibilidade"],
    queryFn: () => list(),
  });

  const pendentes = useMemo(
    () => maquinas.filter((m: MaquinaRow) => m.status === "pendente"),
    [maquinas],
  );

  const termo = busca.trim().toLowerCase();
  const filtradas = useMemo(() => {
    const base = maquinas.filter((m: MaquinaRow) => m.status !== "pendente");
    return termo
      ? base.filter((m: MaquinaRow) =>
          [m.modelo, m.marca, m.frota, m.tipo, m.observacoes ?? ""]
            .join(" ")
            .toLowerCase()
            .includes(termo),
        )
      : base;
  }, [maquinas, termo]);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["maquinas-disponibilidade"] });

  const delMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Máquina excluída");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pendState = (id: string) =>
    pendForm[id] ?? { tipo: "", condicao: "" as const, status: "disponivel" as const };

  const setPend = (id: string, patch: Partial<ReturnType<typeof pendState>>) =>
    setPendForm((s) => ({ ...s, [id]: { ...pendState(id), ...patch } }));

  const confirmarPendente = async (m: MaquinaRow) => {
    const st = pendState(m.id);
    if (!st.tipo) {
      toast.error("Selecione o tipo da máquina");
      return;
    }
    if (!st.condicao) {
      toast.error("Selecione a condição (Nova ou Usada)");
      return;
    }
    setConfirmandoId(m.id);
    try {
      await update({
        data: {
          id: m.id,
          tipo: st.tipo,
          frota: m.frota,
          modelo: m.modelo,
          marca: m.marca,
          anoFabricacao: m.ano_fabricacao ?? null,
          status: st.status,
          condicao: st.condicao,
          observacoes: m.observacoes ?? null,
          fotosExistentes: m.fotos,
          novasFotos: [],
        },
      });
      toast.success("Máquina classificada e adicionada");
      setPendForm((s) => {
        const { [m.id]: _drop, ...rest } = s;
        return rest;
      });
      invalidate();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setConfirmandoId(null);
    }
  };


  const onPickFiles = async (files: FileList | null) => {
    if (!files?.length || !form) return;
    try {
      const novas: NovaFoto[] = [];
      for (const f of Array.from(files)) {
        const dataUrl = await fileToCompressedJpegDataUrl(f, {
          maxWidth: 1280,
          maxHeight: 1280,
          quality: 0.75,
        });
        novas.push({ dataUrl, name: f.name });
      }
      setForm((s) => (s ? { ...s, novasFotos: [...s.novasFotos, ...novas] } : s));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
      if (camRef.current) camRef.current.value = "";
    }
  };

  const salvar = async () => {
    if (!form) return;
    if (!form.frota.trim() && !form.modelo.trim()) {
      toast.error("Informe ao menos frota ou modelo");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        tipo: form.tipo,
        frota: form.frota,
        modelo: form.modelo,
        marca: form.marca,
        anoFabricacao: form.anoFabricacao ? Number(form.anoFabricacao) : null,
        status: form.status,
        condicao: form.condicao,
        observacoes: form.observacoes || null,
        fotosExistentes: form.fotosExistentes,
        novasFotos: form.novasFotos,
      };
      if (form.id) await update({ data: { ...payload, id: form.id } });
      else await create({ data: payload });
      toast.success(form.id ? "Máquina atualizada" : "Máquina cadastrada");
      setForm(null);
      invalidate();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const abrirEdicao = (m: MaquinaRow) =>
    setForm({
      id: m.id,
      tipo: m.tipo,
      frota: m.frota,
      modelo: m.modelo,
      marca: m.marca,
      anoFabricacao: m.ano_fabricacao ? String(m.ano_fabricacao) : "",
      status: m.status === "reservada" ? "reservada" : "disponivel",
      condicao: m.condicao === "nova" ? "nova" : "usada",
      observacoes: m.observacoes ?? "",
      fotosExistentes: m.fotos,
      fotosExistentesUrls: m.fotosUrls,
      novasFotos: [],
    });

  const renderLista = (tipo: string) => {
    const doTipo = filtradas.filter((m: MaquinaRow) => m.tipo === tipo);
    const disponiveis = doTipo.filter((m) => m.status === "disponivel").length;
    const novasCount = doTipo.filter((m) => m.condicao === "nova").length;
    const usadasCount = doTipo.length - novasCount;
    const daCondicao = doTipo.filter((m) =>
      condicaoFiltro === "nova" ? m.condicao === "nova" : m.condicao !== "nova",
    );
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium">
            {tipo} —{" "}
            <span className="text-muted-foreground">
              {disponiveis} disponíveis / {doTipo.length} total
            </span>
          </p>
          <Button size="sm" onClick={() => setForm(emptyForm(tipo))}>
            <Plus className="h-4 w-4" /> Adicionar Máquina
          </Button>
        </div>

        <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1">
          {([
            ["nova", `Novas (${novasCount})`],
            ["usada", `Usadas (${usadasCount})`],
          ] as const).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setCondicaoFiltro(v)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                condicaoFiltro === v
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : daCondicao.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma máquina {condicaoFiltro === "nova" ? "nova" : "usada"} cadastrada{" "}
            {termo ? "para esta busca" : "neste tipo"}.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {daCondicao.map((m) => (
              <Card key={m.id} className="overflow-hidden">
                <Galeria
                  urls={m.fotosUrls.filter(Boolean)}
                  onOpen={(index) =>
                    setLightbox({ urls: m.fotosUrls.filter(Boolean), index })
                  }
                />
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">Frota {m.frota || "—"}</p>
                      <p className="text-sm text-muted-foreground">
                        {m.modelo || "—"} · {m.marca || "—"}
                      </p>
                      {m.ano_fabricacao && (
                        <p className="text-xs text-muted-foreground">
                          Ano {m.ano_fabricacao}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Badge
                        className={
                          m.status === "reservada"
                            ? "bg-yellow-500/15 text-yellow-500 hover:bg-yellow-500/15"
                            : "bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/15"
                        }
                      >
                        {m.status === "reservada" ? "Reservada" : "Disponível"}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={
                          m.condicao === "nova"
                            ? "border-sky-500/50 bg-sky-500/10 text-sky-500"
                            : "border-muted-foreground/40 bg-muted text-muted-foreground"
                        }
                      >
                        {m.condicao === "nova" ? "Nova" : "Usada"}
                      </Badge>
                    </div>
                  </div>

                  {m.observacoes && (
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {m.observacoes}
                    </p>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" onClick={() => abrirEdicao(m)}>
                      <Pencil className="h-4 w-4" /> Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm("Excluir esta máquina?")) delMut.mutate(m.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" /> Excluir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por modelo, marca ou frota (todos os tipos)"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {termo && (
        <p className="text-xs text-muted-foreground">
          {filtradas.length} resultado(s) em todos os tipos.
        </p>
      )}

      {pendentes.length > 0 && (
        <section className="space-y-4 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2">
            <Badge className="bg-amber-500/20 text-amber-500 hover:bg-amber-500/20">
              <ClipboardList className="mr-1 h-3.5 w-3.5" />
              {pendentes.length} máquina(s) aguardando classificação
            </Badge>
            <span className="text-xs text-muted-foreground">
              Vindas dos checklists da Oficina — escolha Tipo e Condição para confirmar.
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {pendentes.map((m: MaquinaRow) => {
              const st = pendState(m.id);
              const urls = m.fotosUrls.filter(Boolean);
              return (
                <Card key={m.id} className="overflow-hidden border-amber-500/30">
                  <Galeria urls={urls} onOpen={(index) => setLightbox({ urls, index })} />
                  <CardContent className="space-y-3 p-4">
                    <div>
                      <p className="font-semibold">Frota {m.frota || "—"}</p>
                      <p className="text-sm text-muted-foreground">
                        {m.modelo || "—"} · {m.marca || "—"}
                      </p>
                    </div>
                    {m.observacoes && (
                      <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                        {m.observacoes}
                      </p>
                    )}

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Tipo *</Label>
                        <Select
                          value={st.tipo}
                          onValueChange={(v) => setPend(m.id, { tipo: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {TIPOS.map((t) => (
                              <SelectItem key={t} value={t}>
                                {t}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Condição *</Label>
                        <Select
                          value={st.condicao}
                          onValueChange={(v) =>
                            setPend(m.id, { condicao: v as "nova" | "usada" })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="nova">Nova</SelectItem>
                            <SelectItem value="usada">Usada</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Status</Label>
                        <Select
                          value={st.status}
                          onValueChange={(v) =>
                            setPend(m.id, { status: v as "disponivel" | "reservada" })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="disponivel">Disponível</SelectItem>
                            <SelectItem value="reservada">Reservada</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => confirmarPendente(m)}
                        disabled={confirmandoId === m.id}
                      >
                        <Check className="h-4 w-4" />
                        {confirmandoId === m.id ? "Confirmando..." : "Confirmar e adicionar"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm("Descartar esta máquina pendente?")) delMut.mutate(m.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" /> Descartar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => abrirEdicao(m)}>
                        <Pencil className="h-4 w-4" /> Editar dados
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}



      {tipoAtivo ? (
        <div className="space-y-4">
          <Button variant="ghost" size="sm" onClick={() => setTipoAtivo(null)}>
            <ArrowLeft className="h-4 w-4" /> Voltar aos tipos
          </Button>
          {renderLista(tipoAtivo)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {TIPOS.map((t) => {
            const doTipo = filtradas.filter((m: MaquinaRow) => m.tipo === t);
            const disp = doTipo.filter((m) => m.status === "disponivel").length;
            const Icon = tileIcon(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTipoAtivo(t)}
                className="group relative overflow-hidden rounded-xl border border-border/60 bg-card/60 p-4 text-left backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:border-primary hover:shadow-[0_0_28px_-6px_var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 opacity-60 transition-opacity group-hover:opacity-100" />
                <div className="relative space-y-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-primary/40 bg-primary/10 text-primary transition-transform group-hover:scale-105">
                    <Icon className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-semibold leading-tight tracking-wide">{t}</p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold text-primary">{disp} disponíveis</span> /{" "}
                    {doTipo.length} total
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar Máquina" : "Adicionar Máquina"}</DialogTitle>
          </DialogHeader>
          {form && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select
                    value={form.tipo}
                    onValueChange={(v) => setForm({ ...form, tipo: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Nº de Frota</Label>
                  <Input
                    value={form.frota}
                    onChange={(e) => setForm({ ...form, frota: e.target.value })}
                    placeholder="Ex: 1024"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Modelo</Label>
                  <Input
                    value={form.modelo}
                    onChange={(e) => setForm({ ...form, modelo: e.target.value })}
                    placeholder="Ex: H25T"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Marca</Label>
                  <Input
                    value={form.marca}
                    onChange={(e) => setForm({ ...form, marca: e.target.value })}
                    placeholder="Ex: Hyster"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ano de fabricação (opcional)</Label>
                  <Input
                    inputMode="numeric"
                    value={form.anoFabricacao}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        anoFabricacao: e.target.value.replace(/\D/g, "").slice(0, 4),
                      })
                    }
                    placeholder="Ex: 2021"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) =>
                      setForm({ ...form, status: v as FormState["status"] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="disponivel">Disponível</SelectItem>
                      <SelectItem value="reservada">Reservada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Condição</Label>
                  <Select
                    value={form.condicao}
                    onValueChange={(v) =>
                      setForm({ ...form, condicao: v as FormState["condicao"] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nova">Nova</SelectItem>
                      <SelectItem value="usada">Usada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  rows={3}
                  value={form.observacoes}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                  placeholder="Informações adicionais"
                />
              </div>

              <div className="space-y-2">
                <Label>Fotos</Label>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => onPickFiles(e.target.files)}
                />
                <input
                  ref={camRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  className="hidden"
                  onChange={(e) => onPickFiles(e.target.files)}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" /> Escolher arquivo
                  </Button>
                  <Button type="button" onClick={() => camRef.current?.click()}>
                    <Camera className="h-4 w-4" /> Tirar foto agora
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {form.fotosExistentesUrls.map((url, i) => (
                    <div key={form.fotosExistentes[i]} className="relative">
                      <img
                        src={url}
                        alt="Foto salva"
                        className="h-20 w-20 rounded object-cover"
                      />
                      <button
                        type="button"
                        aria-label="Remover foto"
                        onClick={() =>
                          setForm({
                            ...form,
                            fotosExistentes: form.fotosExistentes.filter((_, j) => j !== i),
                            fotosExistentesUrls: form.fotosExistentesUrls.filter(
                              (_, j) => j !== i,
                            ),
                          })
                        }
                        className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {form.novasFotos.map((f, i) => (
                    <div key={`nova-${i}`} className="relative">
                      <img
                        src={f.dataUrl}
                        alt="Nova foto"
                        className="h-20 w-20 rounded object-cover"
                      />
                      <button
                        type="button"
                        aria-label="Remover foto"
                        onClick={() =>
                          setForm({
                            ...form,
                            novasFotos: form.novasFotos.filter((_, j) => j !== i),
                          })
                        }
                        className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {lightbox && lightbox.urls.length > 0 && (
        <Lightbox
          urls={lightbox.urls}
          index={lightbox.index}
          onIndex={(i) => setLightbox((s) => (s ? { ...s, index: i } : s))}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
