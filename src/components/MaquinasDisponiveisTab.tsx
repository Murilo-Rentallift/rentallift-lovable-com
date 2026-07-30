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
  "LITIO 3.5 TON",
  "LITIO 3.8 TON",
  "RETRÁTIL",
  "TRANSPALETEIRA",
  "PALETEIRA COM TORRE",
] as const;

type NovaFoto = { dataUrl: string; name?: string };

type FormState = {
  id?: string;
  tipo: string;
  frota: string;
  modelo: string;
  marca: string;
  anoFabricacao: string;
  status: "disponivel" | "reservada";
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
  observacoes: "",
  fotosExistentes: [],
  fotosExistentesUrls: [],
  novasFotos: [],
});

function Galeria({ urls }: { urls: string[] }) {
  const [i, setI] = useState(0);
  if (!urls.length) {
    return (
      <div className="flex h-40 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <ImageOff className="h-6 w-6" />
      </div>
    );
  }
  return (
    <div className="relative h-40 overflow-hidden rounded-md bg-muted">
      <img
        src={urls[Math.min(i, urls.length - 1)]}
        alt="Foto da máquina"
        loading="lazy"
        className="h-40 w-full object-cover"
      />
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
            {Math.min(i, urls.length - 1) + 1}/{urls.length}
          </span>
        </>
      )}
    </div>
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
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  const { data: maquinas = [], isLoading } = useQuery({
    queryKey: ["maquinas-disponibilidade"],
    queryFn: () => list(),
  });

  const termo = busca.trim().toLowerCase();
  const filtradas = useMemo(
    () =>
      termo
        ? maquinas.filter((m: MaquinaRow) =>
            [m.modelo, m.marca, m.frota, m.tipo, m.observacoes ?? ""]
              .join(" ")
              .toLowerCase()
              .includes(termo),
          )
        : maquinas,
    [maquinas, termo],
  );

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
      observacoes: m.observacoes ?? "",
      fotosExistentes: m.fotos,
      fotosExistentesUrls: m.fotosUrls,
      novasFotos: [],
    });

  const renderLista = (tipo: string) => {
    const doTipo = filtradas.filter((m: MaquinaRow) => m.tipo === tipo);
    const disponiveis = doTipo.filter((m) => m.status === "disponivel").length;
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

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : doTipo.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma máquina cadastrada {termo ? "para esta busca" : "neste tipo"}.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {doTipo.map((m) => (
              <Card key={m.id} className="overflow-hidden">
                <Galeria urls={m.fotosUrls.filter(Boolean)} />
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
                    <Badge
                      className={
                        m.status === "reservada"
                          ? "bg-yellow-500/15 text-yellow-500 hover:bg-yellow-500/15"
                          : "bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/15"
                      }
                    >
                      {m.status === "reservada" ? "Reservada" : "Disponível"}
                    </Badge>
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

      <Tabs value={tipoAtivo} onValueChange={setTipoAtivo} className="space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start gap-1">
          {TIPOS.map((t) => {
            const n = filtradas.filter((m: MaquinaRow) => m.tipo === t).length;
            return (
              <TabsTrigger key={t} value={t} className="text-xs">
                {t}
                <span className="ml-1 text-muted-foreground">({n})</span>
              </TabsTrigger>
            );
          })}
        </TabsList>
        {TIPOS.map((t) => (
          <TabsContent key={t} value={t}>
            {renderLista(t)}
          </TabsContent>
        ))}
      </Tabs>

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
                <Input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => onPickFiles(e.target.files)}
                />
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
    </div>
  );
}
