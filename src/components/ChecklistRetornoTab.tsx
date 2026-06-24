import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { FileDown, Plus, Trash2, Camera, Save, FolderOpen, Mail, X, Search, Send } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { RENTAL_LIFT_LOGO_B64 } from "@/lib/assets/rental-lift-logo-b64";
import { SignaturePad } from "@/components/SignaturePad";

const ITENS_PADRAO: { nome: string; desc: string }[] = [
  { nome: "PINTURA", desc: "Verificar estado" },
  { nome: "BANCO DO OPERADOR", desc: "Verificar integridade" },
  { nome: "GIROFLEX", desc: "Verificar integridade" },
  { nome: "BLUESPOT", desc: "Verificar integridade (quando existente)" },
  { nome: "RETROVISOR", desc: "Verificar integridade" },
  { nome: "EXTINTOR", desc: "Verificar lacre" },
  { nome: "FARÓIS E LANTERNAS", desc: "Verificar integridade" },
  { nome: "BATERIA", desc: "Verificar estado de conservação" },
  { nome: "PNEUS", desc: "Verificar integridade" },
];

type Status = "" | "OK" | "CORRIGIR" | "CORRIGIDO";
type Item = { nome: string; desc: string; status: Status };
type Foto = { name: string; dataUrl: string };

const STATUS_OPTS: Status[] = ["", "OK", "CORRIGIR", "CORRIGIDO"];
const STORAGE_KEY = "checklist-retorno-drafts";
const SUBJECT = "CHECKLIST DE RETORNO";

type Draft = {
  id: string;
  savedAt: string;
  data: string;
  frota: string;
  horimetro: string;
  cliente: string;
  extintorTipo: "" | "COMUM" | "PÓ ABC";
  extintorKg: string;
  bateriaMarca: string;
  bateriaAmp: string;
  obs: string;
  vistoriador: string;
  lider: string;
  gerente: string;
  vistoriadorSig: string;
  liderSig: string;
  gerenteSig: string;
  itens: Item[];
  fotos: Foto[];
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function loadDrafts(): Draft[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function saveDrafts(list: Draft[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    toast.error("Falha ao salvar (armazenamento cheio?)");
  }
}

export function ChecklistRetornoTab() {
  const [draftId, setDraftId] = useState<string>(() => crypto.randomUUID());
  const [data, setData] = useState("");
  const [frota, setFrota] = useState("");
  const [horimetro, setHorimetro] = useState("");
  const [cliente, setCliente] = useState("");
  const [extintorTipo, setExtintorTipo] = useState<"" | "COMUM" | "PÓ ABC">("");
  const [extintorKg, setExtintorKg] = useState("");
  const [bateriaMarca, setBateriaMarca] = useState("");
  const [bateriaAmp, setBateriaAmp] = useState("");
  const [obs, setObs] = useState("");
  const [vistoriador, setVistoriador] = useState("");
  const [lider, setLider] = useState("");
  const [gerente, setGerente] = useState("");
  const [vistoriadorSig, setVistoriadorSig] = useState("");
  const [liderSig, setLiderSig] = useState("");
  const [gerenteSig, setGerenteSig] = useState("");
  const [itens, setItens] = useState<Item[]>(
    ITENS_PADRAO.map((n) => ({ ...n, status: "" })),
  );
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [gerando, setGerando] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewEmail, setPreviewEmail] = useState("");
  const [previewBody, setPreviewBody] = useState("");
  const [previewSubject] = useState(SUBJECT);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewPdfBase64, setPreviewPdfBase64] = useState<string>("");
  const [previewFileName, setPreviewFileName] = useState<string>("");
  const [previewEnviando, setPreviewEnviando] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [showDrafts, setShowDrafts] = useState(false);
  const [sigKey, setSigKey] = useState(0);
  const [filtroMes, setFiltroMes] = useState("");
  const [filtroFrota, setFiltroFrota] = useState("");

  useEffect(() => {
    setDrafts(loadDrafts());
  }, []);

  const meses = [
    { value: "01", label: "Janeiro" }, { value: "02", label: "Fevereiro" },
    { value: "03", label: "Março" }, { value: "04", label: "Abril" },
    { value: "05", label: "Maio" }, { value: "06", label: "Junho" },
    { value: "07", label: "Julho" }, { value: "08", label: "Agosto" },
    { value: "09", label: "Setembro" }, { value: "10", label: "Outubro" },
    { value: "11", label: "Novembro" }, { value: "12", label: "Dezembro" },
  ];

  const filteredDrafts = useMemo(() => {
    return drafts.filter((d) => {
      let okMes = true;
      if (filtroMes) {
        const src = d.data || d.savedAt;
        okMes = src ? src.slice(5, 7) === filtroMes : false;
      }
      let okFrota = true;
      if (filtroFrota.trim()) {
        okFrota = d.frota.toLowerCase().includes(filtroFrota.trim().toLowerCase());
      }
      return okMes && okFrota;
    });
  }, [drafts, filtroMes, filtroFrota]);

  function updateItem(i: number, patch: Partial<Item>) {
    setItens((p) => p.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function addItem() {
    setItens((p) => [...p, { nome: "", desc: "", status: "" }]);
  }
  function removeItem(i: number) {
    setItens((p) => p.filter((_, idx) => idx !== i));
  }

  async function handleFotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    try {
      const novas = await Promise.all(
        files.map(async (f) => ({ name: f.name, dataUrl: await fileToDataUrl(f) })),
      );
      setFotos((p) => [...p, ...novas]);
      e.target.value = "";
    } catch {
      toast.error("Falha ao ler imagem");
    }
  }

  function removerFoto(i: number) {
    setFotos((p) => p.filter((_, idx) => idx !== i));
  }

  function currentDraft(): Draft {
    return {
      id: draftId,
      savedAt: new Date().toISOString(),
      data, frota, horimetro, cliente,
      extintorTipo, extintorKg, bateriaMarca, bateriaAmp,
      obs, vistoriador, lider, gerente,
      vistoriadorSig, liderSig, gerenteSig,
      itens, fotos,
    };
  }

  function salvarRascunho() {
    const d = currentDraft();
    const list = loadDrafts();
    const idx = list.findIndex((x) => x.id === d.id);
    if (idx >= 0) list[idx] = d;
    else list.unshift(d);
    saveDrafts(list);
    setDrafts(list);
    toast.success("Checklist salvo");
  }

  function novoChecklist() {
    setDraftId(crypto.randomUUID());
    setData(""); setFrota(""); setHorimetro(""); setCliente("");
    setExtintorTipo(""); setExtintorKg(""); setBateriaMarca(""); setBateriaAmp("");
    setObs(""); setVistoriador(""); setLider(""); setGerente("");
    setVistoriadorSig(""); setLiderSig(""); setGerenteSig("");
    setItens(ITENS_PADRAO.map((n) => ({ ...n, status: "" })));
    setFotos([]);
    setSigKey((k) => k + 1);
    toast.info("Novo checklist iniciado");
  }

  function carregarDraft(d: Draft) {
    setDraftId(d.id);
    setData(d.data); setFrota(d.frota); setHorimetro(d.horimetro); setCliente(d.cliente);
    setExtintorTipo(d.extintorTipo); setExtintorKg(d.extintorKg);
    setBateriaMarca(d.bateriaMarca); setBateriaAmp(d.bateriaAmp);
    setObs(d.obs); setVistoriador(d.vistoriador); setLider(d.lider); setGerente(d.gerente);
    setVistoriadorSig(d.vistoriadorSig || ""); setLiderSig(d.liderSig || ""); setGerenteSig(d.gerenteSig || "");
    setItens(d.itens?.length ? d.itens : ITENS_PADRAO.map((n) => ({ ...n, status: "" })));
    setFotos(d.fotos || []);
    setSigKey((k) => k + 1);
    setShowDrafts(false);
    toast.success("Checklist carregado");
  }

  function excluirDraft(id: string) {
    const list = loadDrafts().filter((x) => x.id !== id);
    saveDrafts(list);
    setDrafts(list);
  }

  async function buildPdf(): Promise<jsPDF> {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const M = 10;
    const contentW = W - M * 2;

    const headerH = 18;
    const logoW = 28;
    const logoH = logoW / (550 / 279);
    try {
      doc.addImage(
        `data:image/png;base64,${RENTAL_LIFT_LOGO_B64}`,
        "PNG",
        M + (45 - logoW) / 2,
        M + (headerH - logoH) / 2,
        logoW,
        logoH,
      );
    } catch { /* ignore */ }
    doc.setLineWidth(0.3);
    doc.rect(M, M, contentW, headerH);
    doc.line(M + 45, M, M + 45, M + headerH);
    const metaX = W - M - 45;
    doc.line(metaX, M, metaX, M + headerH);

    const titleCenterX = (M + 45 + metaX) / 2;
    const titleMaxW = metaX - (M + 45) - 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    const titleLines = doc.splitTextToSize("CHECK LIST DE LIBERAÇÃO DE EQUIPAMENTO - OFICINA", titleMaxW);
    doc.text(titleLines, titleCenterX, M + 7, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("RETORNO DE EQUIPAMENTOS", titleCenterX, M + 14, { align: "center" });

    doc.setFontSize(8);
    doc.text("F.MA-002", metaX + 2, M + 5);
    doc.text("Revisão: 01", metaX + 2, M + 10);
    doc.text("Data da revisão: 23/06/2026", metaX + 2, M + 15);

    let y = M + headerH;

    autoTable(doc, {
      startY: y,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.2, textColor: [0, 0, 0] },
      body: [
        [
          { content: "DATA", styles: { fillColor: [217, 217, 217], fontStyle: "bold", cellWidth: 22 } },
          { content: data || "", styles: { cellWidth: 45 } },
          { content: "FROTA", styles: { fillColor: [217, 217, 217], fontStyle: "bold", cellWidth: 22 } },
          { content: frota || "", styles: { cellWidth: 35 } },
          { content: "HORÍMETRO", styles: { fillColor: [217, 217, 217], fontStyle: "bold", cellWidth: 28 } },
          { content: horimetro || "", styles: { cellWidth: "auto" } },
        ],
        [
          { content: "CLIENTE", styles: { fillColor: [217, 217, 217], fontStyle: "bold" } },
          { content: cliente || "", colSpan: 5 },
        ],
      ],
      margin: { left: M, right: M },
    });
    y = (doc as any).lastAutoTable.finalY;

    const rows = itens.map((it) => {
      let label = it.nome;
      if (/extintor/i.test(it.nome)) {
        label =
          `EXTINTOR - PÓ ABC - QUILOS ${extintorKg || "_________"}\n` +
          "Verificar lacre";
      } else if (/bateria/i.test(it.nome)) {
        label =
          `BATERIA - MARCA ${bateriaMarca || "______________________________"}   AMPERAGEM ${bateriaAmp || "______________"}\n` +
          "Verificar estado de conservação";
      } else if (it.desc) {
        label = `${it.nome}: ${it.desc}`;
      }
      return [
        label,
        it.status === "OK" ? "X" : "",
        it.status === "CORRIGIR" ? "X" : "",
        it.status === "CORRIGIDO" ? "X" : "",
      ];
    });

    autoTable(doc, {
      startY: y,
      theme: "grid",
      head: [["ITENS A VERIFICAR", "OK", "CORRIGIR", "CORRIGIDO"]],
      body: rows,
      styles: { fontSize: 9, cellPadding: 1.6, lineColor: [0, 0, 0], lineWidth: 0.2, textColor: [0, 0, 0] },
      headStyles: { fillColor: [217, 217, 217], textColor: [0, 0, 0], halign: "center", fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: "auto" },
        1: { cellWidth: 18, halign: "center" },
        2: { cellWidth: 22, halign: "center" },
        3: { cellWidth: 24, halign: "center" },
      },
      margin: { left: M, right: M },
    });
    y = (doc as any).lastAutoTable.finalY;

    autoTable(doc, {
      startY: y,
      theme: "grid",
      body: [
        [
          { content: "OBSERVAÇÕES:", styles: { fillColor: [217, 217, 217], fontStyle: "bold", cellWidth: 32 } },
          { content: obs || "", styles: { minCellHeight: 20 } },
        ],
      ],
      styles: { fontSize: 9, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.2, textColor: [0, 0, 0] },
      margin: { left: M, right: M },
    });
    y = (doc as any).lastAutoTable.finalY;

    // REGISTROS FOTOGRAFICOS + fotos antes das assinaturas
    autoTable(doc, {
      startY: y,
      theme: "grid",
      body: [[{ content: "REGISTROS FOTOGRAFICOS", styles: { fillColor: [217, 217, 217], fontStyle: "bold", halign: "center" } }]],
      styles: { fontSize: 9, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.2, textColor: [0, 0, 0] },
      margin: { left: M, right: M },
    });
    y = (doc as any).lastAutoTable.finalY;

    if (fotos.length) {
      const cols = 2;
      const gap = 4;
      const cellW = (contentW - gap * (cols - 1)) / cols;
      const cellH = 55;
      const sigBlockH = 32;
      for (let i = 0; i < fotos.length; i++) {
        const col = i % cols;
        if (col === 0) {
          if (y + cellH + sigBlockH > H - M) {
            doc.addPage();
            y = M;
          } else if (i > 0) {
            y += cellH + gap;
          } else {
            y += 2;
          }
        }
        const x = M + col * (cellW + gap);
        try {
          doc.addImage(fotos[i].dataUrl, "JPEG", x, y, cellW, cellH, undefined, "FAST");
        } catch {
          try { doc.addImage(fotos[i].dataUrl, "PNG", x, y, cellW, cellH, undefined, "FAST"); } catch { /* skip */ }
        }
      }
      y += cellH + gap;
    } else {
      y += 2;
    }

    const sigBoxH = 28;
    const colW = contentW / 3;
    if (y + sigBoxH > H - M) {
      doc.addPage();
      y = M;
    }
    const sigY = y;
    doc.setLineWidth(0.2);
    doc.rect(M, sigY, contentW, sigBoxH);
    doc.line(M + colW, sigY, M + colW, sigY + sigBoxH);
    doc.line(M + colW * 2, sigY, M + colW * 2, sigY + sigBoxH);
    const headStripH = 5;
    doc.setFillColor(217, 217, 217);
    doc.rect(M, sigY, contentW, headStripH, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("VISTORIADOR", M + colW / 2, sigY + 3.5, { align: "center" });
    doc.text("LÍDER MANUTENÇÃO", M + colW + colW / 2, sigY + 3.5, { align: "center" });
    doc.text("GERENTE MANUTENÇÃO", M + colW * 2 + colW / 2, sigY + 3.5, { align: "center" });
    const sigs = [vistoriadorSig, liderSig, gerenteSig];
    const names = [vistoriador, lider, gerente];
    sigs.forEach((sig, i) => {
      const cx = M + colW * i + 2;
      const cy = sigY + headStripH + 1;
      const cw = colW - 4;
      const ch = sigBoxH - headStripH - 6;
      if (sig) {
        try { doc.addImage(sig, "PNG", cx, cy, cw, ch); } catch { /* skip */ }
      }
      if (names[i]) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text(names[i], M + colW * i + colW / 2, sigY + sigBoxH - 1.5, { align: "center" });
      }
    });

    return doc;
  }

  function pdfFileName() {
    return `checklist-retorno${frota ? "-" + frota : ""}${data ? "-" + data : ""}.pdf`;
  }

  async function gerarPDF(autoPrint = false) {
    setGerando(true);
    try {
      const doc = await buildPdf();
      if (autoPrint) {
        doc.autoPrint();
        const url = doc.output("bloburl");
        window.open(url, "_blank");
      } else {
        doc.save(pdfFileName());
      }
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar PDF");
    } finally {
      setGerando(false);
    }
  }

  async function enviarPorEmail() {
    setGerando(true);
    try {
      const doc = await buildPdf();
      const fileName = pdfFileName();
      const body = `Segue em anexo o checklist de retorno.${cliente ? "\nCliente: " + cliente : ""}${frota ? "\nFrota: " + frota : ""}${data ? "\nData: " + data : ""}`;

      const dataUri = doc.output("datauristring");
      const pdfBase64 = dataUri.split(",")[1];

      toast.loading("Enviando email...", { id: "send-email-ret" });
      const { sendChecklistEmail } = await import("@/lib/email.functions");
      const result = await sendChecklistEmail({
        data: { body, fileName, pdfBase64, subject: SUBJECT },
      });
      toast.success(`Email enviado para ${result.recipients.length} destinatário(s)`, { id: "send-email-ret" });
    } catch (e: any) {
      toast.error(e?.message || "Erro ao enviar por email", { id: "send-email-ret" });
    } finally {
      setGerando(false);
    }
  }

  async function abrirPreviewCliente() {
    setPreviewLoading(true);
    setPreviewOpen(true);
    try {
      const doc = await buildPdf();
      const fileName = pdfFileName();
      const body = `Segue em anexo o checklist de retorno.${cliente ? "\nCliente: " + cliente : ""}${frota ? "\nFrota: " + frota : ""}${data ? "\nData: " + data : ""}`;
      const dataUri = doc.output("datauristring");
      const pdfBase64 = dataUri.split(",")[1];
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl);
      setPreviewPdfUrl(url);
      setPreviewPdfBase64(pdfBase64);
      setPreviewFileName(fileName);
      setPreviewBody(body);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar pré-visualização");
      setPreviewOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function confirmarEnvioCliente() {
    const trimmed = previewEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error("Email do cliente inválido");
      return;
    }
    setPreviewEnviando(true);
    try {
      toast.loading("Enviando email...", { id: "send-email-client-ret" });
      const { sendChecklistEmail } = await import("@/lib/email.functions");
      const result = await sendChecklistEmail({
        data: { body: previewBody, fileName: previewFileName, pdfBase64: previewPdfBase64, clientEmail: trimmed, subject: SUBJECT },
      });
      toast.success(`Email enviado para ${result.recipients.length} destinatário(s)`, { id: "send-email-client-ret" });
      setPreviewOpen(false);
      if (previewPdfUrl) {
        URL.revokeObjectURL(previewPdfUrl);
        setPreviewPdfUrl(null);
      }
    } catch (e: any) {
      toast.error(e?.message || "Erro ao enviar por email", { id: "send-email-client-ret" });
    } finally {
      setPreviewEnviando(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={salvarRascunho}>
          <Save className="h-4 w-4 mr-1" /> Salvar
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowDrafts((v) => !v)}>
          <FolderOpen className="h-4 w-4 mr-1" /> Salvos ({drafts.length})
        </Button>
        <Button variant="ghost" size="sm" onClick={novoChecklist}>
          <Plus className="h-4 w-4 mr-1" /> Novo
        </Button>
      </div>

      {showDrafts && (
        <section className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h3 className="font-medium">Checklists salvos</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Mês</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={filtroMes}
                onChange={(e) => setFiltroMes(e.target.value)}
              >
                <option value="">Todos os meses</option>
                {meses.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Frota</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={filtroFrota}
                  onChange={(e) => setFiltroFrota(e.target.value)}
                  placeholder="Número da frota"
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          {drafts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum checklist salvo ainda.</p>
          ) : filteredDrafts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum resultado para os filtros selecionados.</p>
          ) : (
            <ul className="divide-y divide-border">
              {filteredDrafts.map((d) => (
                <li key={d.id} className="py-2 flex items-center justify-between gap-2">
                  <div className="text-sm">
                    <div className="font-medium">
                      {d.data || "Sem data"} {d.frota ? "· Frota " + d.frota : ""} {d.cliente ? "· " + d.cliente : ""}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Salvo em {new Date(d.savedAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => carregarDraft(d)}>Abrir</Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => excluirDraft(d.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="rounded-lg border border-border bg-card p-5 space-y-4">
        <h2 className="font-display text-lg font-bold uppercase">Dados do equipamento</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>Data</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Frota</Label>
            <Input value={frota} onChange={(e) => setFrota(e.target.value)} placeholder="Ex: 1234" />
          </div>
          <div className="space-y-1.5">
            <Label>Horímetro</Label>
            <Input value={horimetro} onChange={(e) => setHorimetro(e.target.value)} placeholder="Ex: 5230 h" />
          </div>
          <div className="space-y-1.5 md:col-span-3">
            <Label>Cliente</Label>
            <Input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Nome do cliente" />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5 space-y-4">
        <h2 className="font-display text-lg font-bold uppercase">Detalhes adicionais</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Extintor — Quilos (Pó ABC)</Label>
            <Input value={extintorKg} onChange={(e) => setExtintorKg(e.target.value)} placeholder="Ex: 4" />
          </div>
          <div className="space-y-1.5">
            <Label>Bateria — Marca</Label>
            <Input value={bateriaMarca} onChange={(e) => setBateriaMarca(e.target.value)} placeholder="Ex: Moura" />
          </div>
          <div className="space-y-1.5">
            <Label>Bateria — Amperagem</Label>
            <Input value={bateriaAmp} onChange={(e) => setBateriaAmp(e.target.value)} placeholder="Ex: 150" />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold uppercase">Itens a verificar</h2>
          <Button variant="outline" size="sm" onClick={addItem}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar item
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-2 w-56">Item</th>
                <th className="py-2 pr-2">Descrição</th>
                <th className="py-2 pr-2 w-40">Status</th>
                <th className="py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {itens.map((it, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="py-2 pr-2">
                    <Input value={it.nome} onChange={(e) => updateItem(i, { nome: e.target.value })} className="h-9" />
                  </td>
                  <td className="py-2 pr-2">
                    <Input value={it.desc} onChange={(e) => updateItem(i, { desc: e.target.value })} className="h-9" />
                  </td>
                  <td className="py-2 pr-2">
                    <select
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={it.status}
                      onChange={(e) => updateItem(i, { status: e.target.value as Status })}
                    >
                      {STATUS_OPTS.map((s) => (
                        <option key={s} value={s}>{s || "—"}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeItem(i)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5 space-y-4">
        <h2 className="font-display text-lg font-bold uppercase">Observações</h2>
        <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={4} placeholder="Observações..." />
      </section>

      <section className="rounded-lg border border-border bg-card p-5 space-y-4">
        <h2 className="font-display text-lg font-bold uppercase">Responsáveis</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <div className="space-y-1.5">
              <Label>Vistoriador</Label>
              <Input value={vistoriador} onChange={(e) => setVistoriador(e.target.value)} placeholder="Nome" />
            </div>
            <SignaturePad key={"v" + sigKey} label="Assinatura" value={vistoriadorSig} onChange={setVistoriadorSig} />
          </div>
          <div className="space-y-2">
            <div className="space-y-1.5">
              <Label>Líder manutenção</Label>
              <Input value={lider} onChange={(e) => setLider(e.target.value)} placeholder="Nome" />
            </div>
            <SignaturePad key={"l" + sigKey} label="Assinatura" value={liderSig} onChange={setLiderSig} />
          </div>
          <div className="space-y-2">
            <div className="space-y-1.5">
              <Label>Gerente manutenção</Label>
              <Input value={gerente} onChange={(e) => setGerente(e.target.value)} placeholder="Nome" />
            </div>
            <SignaturePad key={"g" + sigKey} label="Assinatura" value={gerenteSig} onChange={setGerenteSig} />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold uppercase">Registros fotográficos</h2>
          <label className="inline-flex">
            <input type="file" accept="image/*" multiple className="hidden" onChange={handleFotos} />
            <span className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 h-9 text-sm cursor-pointer hover:bg-accent">
              <Camera className="h-4 w-4" /> Adicionar fotos
            </span>
          </label>
        </div>
        {fotos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma foto adicionada.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {fotos.map((f, i) => (
              <div key={i} className="relative rounded-md overflow-hidden border border-border bg-background">
                <img src={f.dataUrl} alt={f.name} className="w-full h-32 object-cover" />
                <button
                  type="button"
                  onClick={() => removerFoto(i)}
                  className="absolute top-1 right-1 rounded-md bg-black/70 text-white p-1 hover:bg-destructive"
                  aria-label="Remover foto"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="flex flex-wrap gap-2 justify-end">
        <Button variant="outline" onClick={salvarRascunho}>
          <Save className="h-4 w-4 mr-2" /> Salvar
        </Button>
        <Button variant="outline" onClick={() => gerarPDF(true)} disabled={gerando}>
          <FileDown className="h-4 w-4 mr-2" /> Imprimir
        </Button>
        <Button variant="outline" onClick={() => gerarPDF(false)} disabled={gerando}>
          <FileDown className="h-4 w-4 mr-2" /> {gerando ? "Gerando..." : "Gerar PDF"}
        </Button>
        <Button onClick={enviarPorEmail} disabled={gerando}>
          <Mail className="h-4 w-4 mr-2" /> Enviar por email
        </Button>
        <Button variant="secondary" onClick={abrirPreviewCliente} disabled={gerando}>
          <Mail className="h-4 w-4 mr-2" /> Enviar para o cliente
        </Button>
      </div>

      <Dialog
        open={previewOpen}
        onOpenChange={(o) => {
          setPreviewOpen(o);
          if (!o && previewPdfUrl) {
            URL.revokeObjectURL(previewPdfUrl);
            setPreviewPdfUrl(null);
          }
        }}
      >
        <DialogContent className="max-w-5xl w-[95vw] max-h-[92vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Pré-visualização do envio</DialogTitle>
            <DialogDescription>
              Revise o email e o PDF antes de confirmar o envio ao cliente.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0 overflow-auto">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Email do cliente</Label>
                <Input
                  type="email"
                  value={previewEmail}
                  onChange={(e) => setPreviewEmail(e.target.value)}
                  placeholder="cliente@exemplo.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Assunto</Label>
                <Input value={previewSubject} disabled />
              </div>
              <div className="space-y-1.5">
                <Label>Mensagem</Label>
                <Textarea
                  rows={8}
                  value={previewBody}
                  onChange={(e) => setPreviewBody(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Anexo: {previewFileName || "checklist.pdf"}
              </p>
            </div>

            <div className="space-y-2 min-h-[400px] flex flex-col">
              <Label>Pré-visualização do PDF</Label>
              <div className="flex-1 rounded-md border border-border bg-muted overflow-hidden min-h-[400px]">
                {previewLoading ? (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                    Gerando PDF...
                  </div>
                ) : previewPdfUrl ? (
                  <iframe
                    src={previewPdfUrl}
                    title="Pré-visualização do checklist"
                    className="w-full h-full min-h-[400px]"
                  />
                ) : null}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)} disabled={previewEnviando}>
              Cancelar
            </Button>
            <Button onClick={confirmarEnvioCliente} disabled={previewEnviando || previewLoading || !previewPdfBase64}>
              <Send className="h-4 w-4 mr-2" />
              {previewEnviando ? "Enviando..." : "Confirmar envio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
