import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { FileDown, Plus, Trash2, Camera } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const ITENS_PADRAO = [
  "ÓLEO DE MOTOR",
  "ÓLEO DE TRANSMISSÃO",
  "ÓLEO HIDRÁULICO",
  "FILTRO DE AR",
  "ÁGUA RADIADOR",
  "VAZAMENTOS",
  "GIROFLEX - CONDIÇÃO E FUNCIONAMENTO",
  "BIP DE RÉ",
  "EXTINTOR",
  "FARÓIS E LANTERNAS - CONDIÇÃO E FUNCIONAMENTO",
  "BATERIA",
  "REGULAGEM DE CORRENTES",
  "PINTURA",
  "ADESIVOS",
  "BANCO DO OPERADOR",
  "BUZINA",
  "FREIO",
  "FREIO DE ESTACIONAMENTO",
  "REAPERTO DE RODAS",
  "LUBRIFICAÇÃO",
];

type Status = "" | "OK" | "CORRIGIR" | "CORRIGIDO";
type Item = { nome: string; status: Status; obs: string };
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
  const [extintorTipo, setExtintorTipo] = useState("");
  const [extintorKg, setExtintorKg] = useState("");
  const [bateriaMarca, setBateriaMarca] = useState("");
  const [bateriaAmp, setBateriaAmp] = useState("");
  const [obs, setObs] = useState("");
  const [vistoriador, setVistoriador] = useState("");
  const [lider, setLider] = useState("");
  const [gerente, setGerente] = useState("");
  const [itens, setItens] = useState<Item[]>(
    ITENS_PADRAO.map((n) => ({ nome: n, status: "", obs: "" })),
  );
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [gerando, setGerando] = useState(false);

  function updateItem(i: number, patch: Partial<Item>) {
    setItens((p) => p.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function addItem() {
    setItens((p) => [...p, { nome: "", status: "", obs: "" }]);
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
      const M = 14;
      let y = M;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("CHECK LIST LIBERAÇÃO DE EQUIPAMENTO - OFICINA", W / 2, y, { align: "center" });
      y += 6;
      doc.setFontSize(11);
      doc.text("SAÍDA DE EQUIPAMENTOS", W / 2, y, { align: "center" });
      y += 6;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);

      autoTable(doc, {
        startY: y,
        theme: "grid",
        styles: { fontSize: 9, cellPadding: 1.8 },
        body: [
          [
            { content: `DATA: ${data || ""}`, styles: { fontStyle: "bold" } },
            { content: `FROTA: ${frota || ""}`, styles: { fontStyle: "bold" } },
            { content: `HORÍMETRO: ${horimetro || ""}`, styles: { fontStyle: "bold" } },
          ],
          [{ content: `CLIENTE: ${cliente || ""}`, colSpan: 3, styles: { fontStyle: "bold" } }],
        ],
        margin: { left: M, right: M },
      });
      y = (doc as any).lastAutoTable.finalY + 3;

      const rows = itens.map((it) => {
        let nome = it.nome;
        if (/extintor/i.test(it.nome)) {
          const t = extintorTipo ? `Tipo: ${extintorTipo}` : "";
          const k = extintorKg ? `${extintorKg} kg` : "";
          const extra = [t, k].filter(Boolean).join(" - ");
          if (extra) nome += `  (${extra})`;
        }
        if (/bateria/i.test(it.nome)) {
          const m = bateriaMarca ? `Marca: ${bateriaMarca}` : "";
          const a = bateriaAmp ? `Amp: ${bateriaAmp}` : "";
          const extra = [m, a].filter(Boolean).join(" - ");
          if (extra) nome += `  (${extra})`;
        }
        return [
          nome,
          it.status === "OK" ? "X" : "",
          it.status === "CORRIGIR" ? "X" : "",
          it.status === "CORRIGIDO" ? "X" : "",
          it.obs || "",
        ];
      });

      autoTable(doc, {
        startY: y,
        theme: "grid",
        head: [["ITENS A VERIFICAR", "OK", "CORRIGIR", "CORRIGIDO", "OBS"]],
        body: rows,
        styles: { fontSize: 8.5, cellPadding: 1.5 },
        headStyles: { fillColor: [40, 40, 40], halign: "center" },
        columnStyles: {
          0: { cellWidth: 78 },
          1: { cellWidth: 14, halign: "center" },
          2: { cellWidth: 18, halign: "center" },
          3: { cellWidth: 22, halign: "center" },
          4: { cellWidth: "auto" },
        },
        margin: { left: M, right: M },
      });
      y = (doc as any).lastAutoTable.finalY + 4;

      if (obs.trim()) {
        autoTable(doc, {
          startY: y,
          theme: "grid",
          body: [[{ content: `OBS: ${obs}`, styles: { fontStyle: "bold" } }]],
          styles: { fontSize: 9, cellPadding: 2, minCellHeight: 18 },
          margin: { left: M, right: M },
        });
        y = (doc as any).lastAutoTable.finalY + 4;
      }

      autoTable(doc, {
        startY: y,
        theme: "grid",
        body: [
          [
            { content: `VISTORIADOR\n\n${vistoriador || ""}`, styles: { halign: "center", minCellHeight: 18 } },
            { content: `LÍDER\n\n${lider || ""}`, styles: { halign: "center", minCellHeight: 18 } },
            { content: `GERENTE MANUTENÇÃO\n\n${gerente || ""}`, styles: { halign: "center", minCellHeight: 18 } },
          ],
        ],
        styles: { fontSize: 9 },
        margin: { left: M, right: M },
      });

      // Fotos: 2 por página
      if (fotos.length) {
        const photoPageW = W - M * 2;
        const photoH = 115;
        for (let i = 0; i < fotos.length; i++) {
          if (i % 2 === 0) {
            doc.addPage();
            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            doc.text("FOTOS", W / 2, M, { align: "center" });
          }
          const top = i % 2 === 0 ? M + 5 : M + 5 + photoH + 8;
          try {
            doc.addImage(fotos[i].dataUrl, "JPEG", M, top, photoPageW, photoH, undefined, "FAST");
          } catch {
            try {
              doc.addImage(fotos[i].dataUrl, "PNG", M, top, photoPageW, photoH, undefined, "FAST");
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
              onChange={(e) => setExtintorTipo(e.target.value)}
            >
              <option value="">—</option>
              <option value="COMUM">COMUM</option>
              <option value="PÓ ABC">PÓ ABC</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Extintor — Kilos</Label>
            <Input value={extintorKg} onChange={(e) => setExtintorKg(e.target.value)} placeholder="Ex: 4" />
          </div>
          <div className="space-y-1.5">
            <Label>Bateria — Marca</Label>
            <Input value={bateriaMarca} onChange={(e) => setBateriaMarca(e.target.value)} placeholder="Ex: Moura" />
          </div>
          <div className="space-y-1.5">
            <Label>Bateria — Amp</Label>
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
                <th className="py-2 pr-2">Item</th>
                <th className="py-2 pr-2 w-40">Status</th>
                <th className="py-2 pr-2">Obs.</th>
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
                  <td className="py-2 pr-2">
                    <Input
                      value={it.obs}
                      onChange={(e) => updateItem(i, { obs: e.target.value })}
                      className="h-9"
                      placeholder="Opcional"
                    />
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
        <h2 className="font-display text-lg font-bold uppercase">Observações gerais</h2>
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
            <Label>Líder</Label>
            <Input value={lider} onChange={(e) => setLider(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Gerente de manutenção</Label>
            <Input value={gerente} onChange={(e) => setGerente(e.target.value)} />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold uppercase">Fotos</h2>
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
