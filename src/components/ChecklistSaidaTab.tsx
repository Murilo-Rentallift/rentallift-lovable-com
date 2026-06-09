import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { FileDown, Plus, Trash2, Camera } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { PROPOSAL_LOGOS_B64 } from "@/lib/assets/proposal-logos";

const ITENS_PADRAO: { nome: string; desc: string }[] = [
  { nome: "ÓLEO DE MOTOR", desc: "Verificar nível" },
  { nome: "ÓLEO DE TRANSMISSÃO", desc: "Verificar nível" },
  { nome: "ÓLEO HIDRAULICO", desc: "Verificar nível" },
  { nome: "FILTRO DE AR", desc: "Verificar estado" },
  { nome: "ÁGUA RADIADOR", desc: "Verificar nível" },
  { nome: "VAZAMENTOS", desc: "Verificar existência" },
  { nome: "GIROFLEX", desc: "Verificar condição e funcionamento" },
  { nome: "RETROVISORES", desc: "Verificar integridade" },
  { nome: "BIP DE RÉ", desc: "Verificar funcionamento" },
  { nome: "EXTINTOR", desc: "Verificar lacre" },
  { nome: "FAROIS E LANTERNAS", desc: "Verificar condição e funcionamento" },
  { nome: "BLUESPOT", desc: "Verificar funcionamento (quando existente)" },
  { nome: "BATERIA", desc: "Verificar estado de conservação" },
  { nome: "CORRENTES", desc: "Verificar regulagem" },
  { nome: "PINTURA", desc: "Verificar estado" },
  { nome: "ADESIVOS", desc: "Verificar presença de todos os obrigatórios" },
  { nome: "BANCO OPERADOR", desc: "Verificar estado" },
  { nome: "BUZINA", desc: "Verificar funcionamento" },
  { nome: "FREIO", desc: "Verificar funcionamento" },
  { nome: "FREIO ESTACIONAMENTO", desc: "Verificar funcionamento" },
  { nome: "RODAS", desc: "Verificar reaperto" },
  { nome: "LUBRIFICAÇÃO", desc: "Verificar se todos os pontos de lubrificação estão OK" },
];

type Status = "" | "OK" | "CORRIGIR" | "CORRIGIDO";
type Item = { nome: string; desc: string; status: Status };
type Foto = { name: string; dataUrl: string };

const STATUS_OPTS: Status[] = ["", "OK", "CORRIGIR", "CORRIGIDO"];

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export function ChecklistSaidaTab() {
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
  const [itens, setItens] = useState<Item[]>(
    ITENS_PADRAO.map((n) => ({ ...n, status: "" })),
  );
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [gerando, setGerando] = useState(false);

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

  async function gerarPDF(autoPrint = false) {
    setGerando(true);
    try {
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const W = doc.internal.pageSize.getWidth();
      const H = doc.internal.pageSize.getHeight();
      const M = 10;
      const contentW = W - M * 2;

      // ===== Cabeçalho com logos =====
      const headerH = 18;
      // Logos à esquerda
      try {
        doc.addImage(`data:image/png;base64,${PROPOSAL_LOGOS_B64}`, "PNG", M + 1, M + 1, 42, headerH - 2);
      } catch {
        // ignore
      }
      // Caixa cabeçalho
      doc.setLineWidth(0.3);
      doc.rect(M, M, contentW, headerH);
      // Linha vertical entre logo e título
      doc.line(M + 45, M, M + 45, M + headerH);
      // Linha vertical entre título e meta
      const metaX = W - M - 45;
      doc.line(metaX, M, metaX, M + headerH);

      const titleCenterX = (M + 45 + metaX) / 2;
      const titleMaxW = metaX - (M + 45) - 4;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      const titleLines = doc.splitTextToSize(
        "CHECK LIST DE LIBERAÇÃO DE EQUIPAMENTO - OFICINA",
        titleMaxW,
      );
      doc.text(titleLines, titleCenterX, M + 7, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text("SAÍDA DE EQUIPAMENTOS", titleCenterX, M + 14, { align: "center" });

      doc.setFontSize(8);
      doc.text("F.MA-003", metaX + 2, M + 5);
      doc.text("Revisão: 00", metaX + 2, M + 10);
      doc.text("Data da revisão: 03/09/2025", metaX + 2, M + 15);

      let y = M + headerH;

      // ===== Dados do equipamento =====
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

      // ===== Itens a verificar =====
      const rows = itens.map((it) => {
        let label = it.nome;
        if (/extintor/i.test(it.nome)) {
          const tComum = extintorTipo === "COMUM" ? "X" : " ";
          const tABC = extintorTipo === "PÓ ABC" ? "X" : " ";
          label =
            `EXTINTOR - TIPO ( ${tComum} ) COMUM   ( ${tABC} ) PÓ ABC - QUILOS ${extintorKg || "______"}\n` +
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

      // ===== Observações =====
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

      // ===== Assinaturas =====
      autoTable(doc, {
        startY: y,
        theme: "grid",
        head: [["VISTORIADOR", "LÍDER MANUTENÇÃO", "GERENTE MANUTENÇÃO"]],
        body: [[vistoriador || "", lider || "", gerente || ""]],
        styles: { fontSize: 9, halign: "center", minCellHeight: 20, lineColor: [0, 0, 0], lineWidth: 0.2, textColor: [0, 0, 0] },
        headStyles: { fillColor: [217, 217, 217], textColor: [0, 0, 0], fontStyle: "normal", halign: "center" },
        margin: { left: M, right: M },
      });

      // ===== Página 2: Fotos =====
      if (fotos.length) {
        doc.addPage();
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text("FOTOS", W / 2, M + 5, { align: "center" });

        const cols = 2;
        const gap = 5;
        const cellW = (contentW - gap * (cols - 1)) / cols;
        const cellH = 80;
        const rowsPerPage = Math.floor((H - (M + 12) - M) / (cellH + gap));
        const perPage = cols * rowsPerPage;

        for (let i = 0; i < fotos.length; i++) {
          const idxInPage = i % perPage;
          if (i > 0 && idxInPage === 0) {
            doc.addPage();
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.text("FOTOS", W / 2, M + 5, { align: "center" });
          }
          const col = idxInPage % cols;
          const row = Math.floor(idxInPage / cols);
          const x = M + col * (cellW + gap);
          const yImg = M + 12 + row * (cellH + gap);
          try {
            doc.addImage(fotos[i].dataUrl, "JPEG", x, yImg, cellW, cellH, undefined, "FAST");
          } catch {
            try {
              doc.addImage(fotos[i].dataUrl, "PNG", x, yImg, cellW, cellH, undefined, "FAST");
            } catch {
              // skip
            }
          }
        }
      }

      const nome = `checklist-saida${frota ? "-" + frota : ""}${data ? "-" + data : ""}.pdf`;
      if (autoPrint) {
        doc.autoPrint();
        const url = doc.output("bloburl");
        window.open(url, "_blank");
      } else {
        doc.save(nome);
      }
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar PDF");
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="space-y-6">
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
            <Label>Extintor — Tipo</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={extintorTipo}
              onChange={(e) => setExtintorTipo(e.target.value as "" | "COMUM" | "PÓ ABC")}
            >
              <option value="">—</option>
              <option value="COMUM">COMUM</option>
              <option value="PÓ ABC">PÓ ABC</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Extintor — Quilos</Label>
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
                    <Input
                      value={it.nome}
                      onChange={(e) => updateItem(i, { nome: e.target.value })}
                      className="h-9"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <Input
                      value={it.desc}
                      onChange={(e) => updateItem(i, { desc: e.target.value })}
                      className="h-9"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <select
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={it.status}
                      onChange={(e) => updateItem(i, { status: e.target.value as Status })}
                    >
                      {STATUS_OPTS.map((s) => (
                        <option key={s} value={s}>
                          {s || "—"}
                        </option>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>Vistoriador</Label>
            <Input value={vistoriador} onChange={(e) => setVistoriador(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Líder manutenção</Label>
            <Input value={lider} onChange={(e) => setLider(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Gerente manutenção</Label>
            <Input value={gerente} onChange={(e) => setGerente(e.target.value)} />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold uppercase">Fotos (página 2 do PDF)</h2>
          <label className="inline-flex">
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFotos}
            />
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
        <Button variant="outline" onClick={() => gerarPDF(true)} disabled={gerando}>
          <FileDown className="h-4 w-4 mr-2" /> Imprimir
        </Button>
        <Button onClick={() => gerarPDF(false)} disabled={gerando}>
          <FileDown className="h-4 w-4 mr-2" /> {gerando ? "Gerando..." : "Gerar PDF"}
        </Button>
      </div>
    </div>
  );
}
