import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { almoxarifadoGetDay, almoxUpdatePartStatus, almoxWeeklyMissing, almoxDeletePart, almoxUpdatePartQuantity, almoxListRequests, almoxUpdateRequestStatus, almoxDeleteRequest } from "@/lib/app.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, FileDown, Package, Lock, Trash2, ListChecks, Wrench } from "lucide-react";
import { Logo } from "@/components/Logo";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/almoxarifado")({
  head: () => ({ meta: [{ title: "Almoxarifado — Lista de Peças" }] }),
  component: AlmoxarifadoPage,
});

type PartStatus = "pendente" | "separado" | "em_falta" | "entregue";

const STATUS_OPTIONS: { value: PartStatus; label: string; className: string }[] = [
  { value: "pendente", label: "Pendente", className: "bg-accent/20 text-accent border-accent/40" },
  { value: "separado", label: "Separado", className: "bg-blue-500/20 text-blue-400 border-blue-500/40" },
  { value: "em_falta", label: "Em falta", className: "bg-red-500/20 text-red-400 border-red-500/40" },
  { value: "entregue", label: "Entregue", className: "bg-green-500/20 text-green-500 border-green-500/40" },
];


type Part = { id: string; name: string; quantity: number; checked: boolean; status: PartStatus };
type Group = {
  operator: { id: string; name: string; position: number };
  parts: Part[];
};


function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

function formatDateBR(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// Returns Monday of the week of the given ISO date
function mondayOf(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const day = dt.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  dt.setDate(dt.getDate() + diff);
  const tz = dt.getTimezoneOffset() * 60000;
  return new Date(dt.getTime() - tz).toISOString().slice(0, 10);
}

function addDays(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const tz = dt.getTimezoneOffset() * 60000;
  return new Date(dt.getTime() - tz).toISOString().slice(0, 10);
}




function AlmoxarifadoPage() {
  const fetchDay = useServerFn(almoxarifadoGetDay);
  const [pin, setPin] = useState("");
  const [authed, setAuthed] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"pecas" | "requisicoes">("pecas");
  const [requests, setRequests] = useState<Array<{ id: string; requester_name: string; part_name: string; quantity: number; code: string; status: PartStatus; created_at: string }>>([]);
  const [reqsLoading, setReqsLoading] = useState(false);

  const fetchReqs = useServerFn(almoxListRequests);
  const updateReqStatus = useServerFn(almoxUpdateRequestStatus);
  const deleteReq = useServerFn(almoxDeleteRequest);

  async function loadRequests(currentPin: string) {
    setReqsLoading(true);
    try {
      const res = await fetchReqs({ data: { pin: currentPin } });
      setRequests(res.requests as any);
    } catch (e: any) {
      toast.error(e.message || "Falha ao carregar requisições");
    } finally {
      setReqsLoading(false);
    }
  }

  async function changeReqStatus(requestId: string, status: PartStatus) {
    setRequests((rs) => rs.map((r) => r.id === requestId ? { ...r, status } : r));
    try {
      await updateReqStatus({ data: { pin, requestId, status } });
    } catch (e: any) {
      toast.error(e.message || "Falha ao atualizar");
      loadRequests(pin);
    }
  }

  async function removeReq(requestId: string) {
    if (!confirm("Remover esta requisição?")) return;
    const snap = requests;
    setRequests((rs) => rs.filter((r) => r.id !== requestId));
    try {
      await deleteReq({ data: { pin, requestId } });
      toast.success("Requisição removida");
    } catch (e: any) {
      toast.error(e.message || "Falha ao remover");
      setRequests(snap);
    }
  }

  async function load(currentPin: string, currentDate: string) {
    setLoading(true);
    try {
      const res = await fetchDay({ data: { pin: currentPin, date: currentDate } });
      setGroups(res.groups as Group[]);
      setAuthed(true);
    } catch (e: any) {
      toast.error(e.message || "Falha ao carregar");
      setAuthed(false);
    } finally {
      setLoading(false);
    }
  }

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    load(pin, date);
  }

  const updateStatus = useServerFn(almoxUpdatePartStatus);
  async function changeStatus(partId: string, status: PartStatus) {
    // optimistic
    setGroups((gs) => gs.map((g) => ({
      ...g,
      parts: g.parts.map((p) => p.id === partId ? { ...p, status } : p),
    })));
    try {
      await updateStatus({ data: { pin, partId, status } });
    } catch (e: any) {
      toast.error(e.message || "Falha ao atualizar status");
      load(pin, date);
    }
  }

  const deletePart = useServerFn(almoxDeletePart);
  async function removePart(partId: string, partName: string) {
    if (!confirm(`Remover "${partName}" da lista?`)) return;
    const snapshot = groups;
    setGroups((gs) => gs.map((g) => ({ ...g, parts: g.parts.filter((p) => p.id !== partId) })));
    try {
      await deletePart({ data: { pin, partId } });
      toast.success("Peça removida");
    } catch (e: any) {
      toast.error(e.message || "Falha ao remover peça");
      setGroups(snapshot);
    }
  }

  const updateQty = useServerFn(almoxUpdatePartQuantity);
  async function changeQty(partId: string, quantity: number) {
    if (!Number.isFinite(quantity) || quantity < 1) return;
    setGroups((gs) => gs.map((g) => ({
      ...g,
      parts: g.parts.map((p) => p.id === partId ? { ...p, quantity } : p),
    })));
    try {
      await updateQty({ data: { pin, partId, quantity } });
    } catch (e: any) {
      toast.error(e.message || "Falha ao atualizar quantidade");
      load(pin, date);
    }
  }

  const fetchWeekly = useServerFn(almoxWeeklyMissing);
  const [weekStart, setWeekStart] = useState(() => mondayOf(todayISO()));
  const [weeklyLoading, setWeeklyLoading] = useState(false);

  async function generateWeeklyPDF() {
    const startDate = mondayOf(weekStart);
    const endDate = addDays(startDate, 6);
    setWeeklyLoading(true);
    try {
      const res = await fetchWeekly({ data: { pin, startDate, endDate } });

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      doc.setFillColor(127, 29, 29);
      doc.rect(0, 0, pageWidth, 25, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("RELATÓRIO SEMANAL — PEÇAS EM FALTA", 14, 12);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Período: ${formatDateBR(startDate)} a ${formatDateBR(endDate)}`, 14, 20);

      let y = 35;

      if (!res.rows.length) {
        doc.setTextColor(0, 0, 0);
        doc.text("Nenhuma peça em falta registrada nesta semana.", 14, y);
      } else {
        autoTable(doc, {
          startY: y,
          head: [["Data", "Técnico", "Peça", "Qtd"]],
          body: res.rows.map((r) => [formatDateBR(r.date), r.operatorName, r.name, String(r.quantity)]),
          theme: "striped",
          headStyles: { fillColor: [127, 29, 29], textColor: 255, fontStyle: "bold" },
          styles: { fontSize: 10, cellPadding: 2 },
          columnStyles: { 0: { cellWidth: 26 }, 3: { halign: "center", cellWidth: 18 } },
          margin: { left: 14, right: 14 },
        });
        // @ts-ignore
        y = (doc as any).lastAutoTable.finalY + 8;

        // Totals per part name
        const totals: Record<string, number> = {};
        res.rows.forEach((r) => { totals[r.name] = (totals[r.name] || 0) + r.quantity; });

        if (y > 240) { doc.addPage(); y = 20; }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(127, 29, 29);
        doc.text("RESUMO POR PEÇA", 14, y);
        autoTable(doc, {
          startY: y + 2,
          head: [["Peça", "Quantidade Total"]],
          body: Object.entries(totals)
            .sort((a, b) => b[1] - a[1])
            .map(([n, q]) => [n, String(q)]),
          theme: "grid",
          headStyles: { fillColor: [250, 204, 21], textColor: 15, fontStyle: "bold" },
          styles: { fontSize: 10, cellPadding: 3 },
          columnStyles: { 1: { halign: "center", cellWidth: 40 } },
          margin: { left: 14, right: 14 },
        });
      }

      const pages = doc.getNumberOfPages();
      for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(
          `Gerado em ${new Date().toLocaleString("pt-BR")} — Página ${i}/${pages}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 8,
          { align: "center" },
        );
      }

      doc.save(`pecas_em_falta_${startDate}_a_${endDate}.pdf`);
      toast.success(`${res.rows.length} ${res.rows.length === 1 ? "registro" : "registros"} no relatório`);
    } catch (e: any) {
      toast.error(e.message || "Falha ao gerar relatório");
    } finally {
      setWeeklyLoading(false);
    }
  }




  function generatePDF() {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 25, "F");
    doc.setTextColor(250, 204, 21);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("ALMOXARIFADO — LISTA DE PEÇAS", 14, 12);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Data: ${formatDateBR(date)}`, 14, 20);

    let y = 35;
    const totals: Record<string, number> = {};

    const withParts = groups.filter((g) => g.parts.length > 0);

    if (withParts.length === 0) {
      doc.setTextColor(0, 0, 0);
      doc.text("Nenhuma peça programada para esta data.", 14, y);
    } else {
      withParts.forEach((g) => {
        if (y > 260) {
          doc.addPage();
          y = 20;
        }
        doc.setTextColor(15, 23, 42);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text(`#${String(g.operator.position).padStart(2, "0")} — ${g.operator.name}`, 14, y);
        y += 4;

        autoTable(doc, {
          startY: y,
          head: [["Peça", "Qtd", "Status"]],
          body: g.parts.map((p) => {
            totals[p.name] = (totals[p.name] || 0) + p.quantity;
            const label = STATUS_OPTIONS.find((s) => s.value === p.status)?.label ?? "Pendente";
            return [p.name, String(p.quantity), label];

          }),
          theme: "striped",
          headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: "bold" },
          styles: { fontSize: 10, cellPadding: 2 },
          columnStyles: { 1: { halign: "center", cellWidth: 20 }, 2: { halign: "center", cellWidth: 30 } },
          margin: { left: 14, right: 14 },
        });
        // @ts-ignore - lastAutoTable injected by plugin
        y = (doc as any).lastAutoTable.finalY + 8;
      });

      // Consolidated totals
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text("RESUMO GERAL (TOTAL POR PEÇA)", 14, y);
      y += 2;
      autoTable(doc, {
        startY: y + 2,
        head: [["Peça", "Quantidade Total"]],
        body: Object.entries(totals)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([name, qty]) => [name, String(qty)]),
        theme: "grid",
        headStyles: { fillColor: [250, 204, 21], textColor: 15, fontStyle: "bold" },
        styles: { fontSize: 10, cellPadding: 3 },
        columnStyles: { 1: { halign: "center", cellWidth: 40 } },
        margin: { left: 14, right: 14 },
      });
    }

    // Footer
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(
        `Gerado em ${new Date().toLocaleString("pt-BR")} — Página ${i}/${pages}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 8,
        { align: "center" },
      );
    }

    doc.save(`almoxarifado_${date}.pdf`);
    toast.success("PDF gerado com sucesso");
  }

  if (!authed) {
    return (
      <div className="min-h-screen grid place-items-center px-4">
        <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-card p-6 shadow-xl">
          <div className="flex items-center gap-3">
            <Logo className="h-10 w-auto" />
            <div>
              <h1 className="font-display text-xl font-bold uppercase">Almoxarifado</h1>
              <p className="text-xs text-muted-foreground">Acesso restrito</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="date">Data</Label>
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pin">PIN do Almoxarifado</Label>
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

  const totalParts = groups.reduce((acc, g) => acc + g.parts.length, 0);

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="hazard-stripe h-2" />
        <div className="mx-auto max-w-6xl px-6 py-4 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <Logo className="h-10 w-auto" />
            <div>
              <h1 className="font-display text-xl md:text-2xl font-bold uppercase">Almoxarifado</h1>
              <p className="text-xs text-muted-foreground">Lista consolidada de peças</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                load(pin, e.target.value);
              }}
              className="w-auto"
            />
            <Button onClick={generatePDF} disabled={totalParts === 0} className="bg-accent text-accent-foreground hover:bg-accent/90">
              <FileDown className="h-4 w-4 mr-2" />
              Gerar PDF
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8 space-y-5">
        <section className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <h2 className="font-display text-sm font-bold uppercase tracking-wider text-red-400 mb-1">
              Relatório semanal — Peças em falta
            </h2>
            <p className="text-xs text-muted-foreground">
              Gera um PDF com todas as peças marcadas como "Em falta" na semana selecionada (segunda a domingo).
            </p>
          </div>
          <div className="flex items-end gap-2">
            <div>
              <Label htmlFor="weekStart" className="text-xs">Semana de</Label>
              <Input
                id="weekStart"
                type="date"
                value={weekStart}
                onChange={(e) => setWeekStart(e.target.value)}
                className="w-auto"
              />
            </div>
            <Button
              onClick={generateWeeklyPDF}
              disabled={weeklyLoading || !weekStart}
              variant="destructive"
            >
              <FileDown className="h-4 w-4 mr-2" />
              {weeklyLoading ? "Gerando..." : "Gerar relatório"}
            </Button>
          </div>
        </section>


        {loading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : totalParts === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-12 text-center">
            <Package className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhuma peça programada para {formatDateBR(date)}.</p>
          </div>
        ) : (
          groups
            .filter((g) => g.parts.length > 0)
            .map((g) => (
              <div key={g.operator.id} className="rounded-lg border border-border bg-card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-muted-foreground">
                      #{String(g.operator.position).padStart(2, "0")}
                    </span>
                    <h2 className="font-display text-lg font-bold uppercase">{g.operator.name}</h2>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {g.parts.length} {g.parts.length === 1 ? "item" : "itens"}
                  </span>
                </div>
                <ul className="divide-y divide-border">
                  {g.parts.map((p) => {
                    const opt = STATUS_OPTIONS.find((s) => s.value === p.status) ?? STATUS_OPTIONS[0];
                    return (
                      <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`h-2 w-2 rounded-full shrink-0 ${
                            p.status === "entregue" ? "bg-green-500" :
                            p.status === "separado" ? "bg-blue-500" :
                            p.status === "em_falta" ? "bg-red-500" : "bg-accent"
                          }`} />
                          <span className="font-medium truncate">{p.name}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <input
                            type="number"
                            min={1}
                            max={9999}
                            value={p.quantity}
                            onChange={(e) => {
                              const v = parseInt(e.target.value, 10);
                              if (Number.isFinite(v)) changeQty(p.id, Math.max(1, Math.min(9999, v)));
                            }}
                            className="w-16 rounded border border-input bg-background px-2 py-1 text-sm font-mono text-center focus:outline-none focus:ring-2 focus:ring-ring"
                            title="Quantidade"
                          />
                          <select
                            value={p.status}
                            onChange={(e) => changeStatus(p.id, e.target.value as PartStatus)}
                            className={`rounded border px-2 py-1 text-xs uppercase font-semibold focus:outline-none focus:ring-2 focus:ring-ring ${opt.className}`}
                          >
                            {STATUS_OPTIONS.map((s) => (
                              <option key={s.value} value={s.value} className="bg-background text-foreground">
                                {s.label}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => removePart(p.id, p.name)}
                            className="rounded border border-red-500/40 bg-red-500/10 p-1.5 text-red-400 hover:bg-red-500/20 transition"
                            title="Remover peça"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </li>
                    );
                  })}

                </ul>
              </div>
            ))
        )}
      </main>
    </div>
  );
}
