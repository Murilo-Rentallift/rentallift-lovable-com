import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { almoxarifadoGetDay, almoxUpdatePartStatus, almoxWeeklyMissing, almoxDeletePart, almoxUpdatePartQuantity, almoxListRequests, almoxUpdateRequestItemStatus, almoxDeleteGroup, almoxWeeklyMissingRequests, almoxUpcomingDates, almoxEditRequest, almoxGetOriginalRequest } from "@/lib/app.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, FileDown, Package, Lock, Trash2, ListChecks, Wrench, Pencil, History, Plus } from "lucide-react";
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
  type ReqItem = { id: string; part_name: string; quantity: number; code: string; status: PartStatus };
  type ReqGroup = { group_id: string; requester_name: string; created_at: string; items: ReqItem[]; original_group_id?: string | null; edited_at?: string | null };

  const [requests, setRequests] = useState<ReqGroup[]>([]);
  const [reqsLoading, setReqsLoading] = useState(false);

  const fetchReqs = useServerFn(almoxListRequests);
  const updateItemStatus = useServerFn(almoxUpdateRequestItemStatus);
  const deleteGroup = useServerFn(almoxDeleteGroup);
  const editReq = useServerFn(almoxEditRequest);
  const getOriginal = useServerFn(almoxGetOriginalRequest);

  type EditDraft = { partName: string; quantity: number; code: string };
  const [editing, setEditing] = useState<{ groupId: string; requesterName: string; items: EditDraft[] } | null>(null);
  const [viewingOriginal, setViewingOriginal] = useState<{
    requester_name: string; created_at: string; items: ReqItem[];
  } | null>(null);

  async function loadRequests(currentPin: string) {
    setReqsLoading(true);
    try {
      const res = await fetchReqs({ data: { pin: currentPin } });
      setRequests(res.requests as ReqGroup[]);
    } catch (e: any) {
      toast.error(e.message || "Falha ao carregar requisições");
    } finally {
      setReqsLoading(false);
    }
  }

  async function changeItemStatus(groupId: string, itemId: string, status: PartStatus) {
    setRequests((rs) =>
      rs.map((r) =>
        r.group_id === groupId
          ? { ...r, items: r.items.map((i) => i.id === itemId ? { ...i, status } : i) }
          : r,
      ),
    );
    try {
      await updateItemStatus({ data: { pin, itemId, status } });
    } catch (e: any) {
      toast.error(e.message || "Falha ao atualizar");
      loadRequests(pin);
    }
  }

  async function removeGroup(groupId: string) {
    if (!confirm("Remover esta requisição e todas as suas peças?")) return;
    const snap = requests;
    setRequests((rs) => rs.filter((r) => r.group_id !== groupId));
    try {
      await deleteGroup({ data: { pin, groupId } });
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
      loadRequests(currentPin);
      loadUpcoming(currentPin, currentDate);
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
  const [weekStartDate, setWeekStartDate] = useState(todayISO());
  const [weekEndDate, setWeekEndDate] = useState(todayISO());
  const [weeklyLoading, setWeeklyLoading] = useState(false);

  const fetchUpcoming = useServerFn(almoxUpcomingDates);
  const [upcomingDates, setUpcomingDates] = useState<string[]>([]);

  async function loadUpcoming(currentPin: string, currentDate: string) {
    try {
      const res = await fetchUpcoming({ data: { pin: currentPin, fromDate: currentDate } });
      setUpcomingDates(res.dates);
    } catch { /* silent */ }
  }

  async function generateWeeklyPDF() {
    const startDate = weekStartDate;
    const endDate = weekEndDate;
    if (startDate > endDate) { toast.error("Data início deve ser anterior à data fim"); return; }
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

  const fetchWeeklyReq = useServerFn(almoxWeeklyMissingRequests);
  const [reqStartDate, setReqStartDate] = useState(todayISO());
  const [reqEndDate, setReqEndDate] = useState(todayISO());
  const [reqWeeklyLoading, setReqWeeklyLoading] = useState(false);

  async function generateWeeklyRequestsPDF() {
    const startDate = reqStartDate;
    const endDate = reqEndDate;
    if (startDate > endDate) { toast.error("Data início deve ser anterior à data fim"); return; }
    setReqWeeklyLoading(true);
    try {
      const res = await fetchWeeklyReq({ data: { pin, startDate, endDate } });

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      doc.setFillColor(127, 29, 29);
      doc.rect(0, 0, pageWidth, 25, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("RELATÓRIO SEMANAL — REQUISIÇÕES EM FALTA", 14, 12);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Período: ${formatDateBR(startDate)} a ${formatDateBR(endDate)}`, 14, 20);

      let y = 35;

      if (!res.requests.length) {
        doc.setTextColor(0, 0, 0);
        doc.text("Nenhuma requisição em falta registrada nesta semana.", 14, y);
      } else {
        const rows: any[] = [];
        res.requests.forEach((req: any) => {
          req.items.forEach((item: any) => {
            rows.push([
              formatDateBR(req.created_at.slice(0, 10)),
              req.requester_name,
              item.part_name,
              String(item.quantity),
              item.code || "—",
            ]);
          });
        });

        autoTable(doc, {
          startY: y,
          head: [["Data", "Solicitante", "Peça", "Qtd", "Código"]],
          body: rows,
          theme: "striped",
          headStyles: { fillColor: [127, 29, 29], textColor: 255, fontStyle: "bold" },
          styles: { fontSize: 10, cellPadding: 2 },
          columnStyles: {
            0: { cellWidth: 26 },
            3: { halign: "center", cellWidth: 18 },
          },
          margin: { left: 14, right: 14 },
        });
        // @ts-ignore
        y = (doc as any).lastAutoTable.finalY + 8;

        // Totals per part name
        const totals: Record<string, number> = {};
        res.requests.forEach((req: any) => {
          req.items.forEach((item: any) => {
            totals[item.part_name] = (totals[item.part_name] || 0) + item.quantity;
          });
        });

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

      doc.save(`requisicoes_em_falta_${startDate}_a_${endDate}.pdf`);
      toast.success(`${res.requests.length} ${res.requests.length === 1 ? "grupo" : "grupos"} no relatório`);
    } catch (e: any) {
      toast.error(e.message || "Falha ao gerar relatório");
    } finally {
      setReqWeeklyLoading(false);
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
        <div className="flex gap-2 border-b border-border">
          <button
            type="button"
            onClick={() => setTab("pecas")}
            className={`px-4 py-2 text-sm font-semibold uppercase tracking-wide border-b-2 -mb-px flex items-center gap-2 ${tab === "pecas" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <Package className="h-4 w-4" /> Peças do dia
          </button>
          <button
            type="button"
            onClick={() => { setTab("requisicoes"); loadRequests(pin); }}
            className={`px-4 py-2 text-sm font-semibold uppercase tracking-wide border-b-2 -mb-px flex items-center gap-2 ${tab === "requisicoes" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <Wrench className="h-4 w-4" /> Requisições da Oficina
            {requests.filter((r) => r.items.some((i) => i.status === "pendente")).length > 0 && (
              <span className="ml-1 rounded-full bg-accent text-accent-foreground text-xs px-2 py-0.5">
                {requests.filter((r) => r.items.some((i) => i.status === "pendente")).length}
              </span>
            )}
          </button>
        </div>

        {tab === "requisicoes" ? (
          <>
            <section className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <h2 className="font-display text-sm font-bold uppercase tracking-wider text-red-400 mb-1">
                  Relatório semanal — Requisições em falta
                </h2>
                <p className="text-xs text-muted-foreground">
                  Gera um PDF com todas as requisições marcadas como "Em falta" na semana selecionada.
                </p>
              </div>
              <div className="flex items-end gap-2 flex-wrap">
                <div>
                  <Label htmlFor="reqStartDate" className="text-xs">Data início</Label>
                  <Input
                    id="reqStartDate"
                    type="date"
                    value={reqStartDate}
                    onChange={(e) => setReqStartDate(e.target.value)}
                    className="w-auto"
                  />
                </div>
                <div>
                  <Label htmlFor="reqEndDate" className="text-xs">Data fim</Label>
                  <Input
                    id="reqEndDate"
                    type="date"
                    value={reqEndDate}
                    onChange={(e) => setReqEndDate(e.target.value)}
                    className="w-auto"
                  />
                </div>
                <Button
                  onClick={generateWeeklyRequestsPDF}
                  disabled={reqWeeklyLoading || !reqStartDate || !reqEndDate}
                  variant="destructive"
                >
                  <FileDown className="h-4 w-4 mr-2" />
                  {reqWeeklyLoading ? "Gerando..." : "Gerar relatório"}
                </Button>
              </div>
            </section>

            <section className="rounded-lg border border-border bg-card">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h2 className="font-display text-sm uppercase tracking-wider flex items-center gap-2">
                  <ListChecks className="h-4 w-4" /> Requisições recebidas
                </h2>
                <span className="text-xs text-muted-foreground">
                  {requests.length} {requests.length === 1 ? "item" : "itens"}
                </span>
              </div>
              {reqsLoading ? (
                <p className="p-6 text-center text-sm text-muted-foreground">Carregando...</p>
              ) : requests.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma requisição da oficina.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {requests.map((r) => {
                    return (
                      <li key={r.group_id} className="px-4 py-4 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-medium text-sm">
                              Solicitante: <span className="text-foreground">{r.requester_name}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(r.created_at).toLocaleString("pt-BR")} · {r.items.length} {r.items.length === 1 ? "peça" : "peças"}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeGroup(r.group_id)}
                            className="rounded border border-red-500/40 bg-red-500/10 p-1.5 text-red-400 hover:bg-red-500/20 transition"
                            title="Remover requisição"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <ul className="mt-2 space-y-1 pl-3 border-l-2 border-border">
                          {r.items.map((item) => {
                            const iopt = STATUS_OPTIONS.find((s) => s.value === item.status) ?? STATUS_OPTIONS[0];
                            return (
                              <li key={item.id} className="text-sm flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className={`h-2 w-2 rounded-full shrink-0 ${
                                    item.status === "entregue" ? "bg-green-500" :
                                    item.status === "separado" ? "bg-blue-500" :
                                    item.status === "em_falta" ? "bg-red-500" : "bg-accent"
                                  }`} />
                                  <span className="truncate">{item.part_name}</span>
                                  <span className="text-muted-foreground">× {item.quantity}</span>
                                  {item.code ? <span className="text-muted-foreground ml-1">· cód. <span className="font-mono">{item.code}</span></span> : null}
                                </div>
                                <select
                                  value={item.status}
                                  onChange={(e) => changeItemStatus(r.group_id, item.id, e.target.value as PartStatus)}
                                  className={`rounded border px-2 py-1 text-xs uppercase font-semibold focus:outline-none focus:ring-2 focus:ring-ring ${iopt.className}`}
                                >
                                  {STATUS_OPTIONS.map((s) => (
                                    <option key={s.value} value={s.value} className="bg-background text-foreground">
                                      {s.label}
                                    </option>
                                  ))}
                                </select>
                              </li>
                            );
                          })}
                        </ul>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        ) : (
          <>
            {upcomingDates.length > 0 && (
              <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-4 text-sm text-yellow-200">
                <strong className="font-semibold">Atenção:</strong>{" "}
                {upcomingDates.length === 1
                  ? `Você possui requisições para o dia ${formatDateBR(upcomingDates[0])}`
                  : `Você possui requisições para os dias: ${upcomingDates.map(formatDateBR).join(", ")}`}
              </div>
            )}
            <section className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <h2 className="font-display text-sm font-bold uppercase tracking-wider text-red-400 mb-1">
                  Relatório — Peças em falta
                </h2>
                <p className="text-xs text-muted-foreground">
                  Gera um PDF com todas as peças marcadas como "Em falta" no intervalo selecionado.
                </p>
              </div>
              <div className="flex items-end gap-2 flex-wrap">
                <div>
                  <Label htmlFor="weekStartDate" className="text-xs">Data início</Label>
                  <Input
                    id="weekStartDate"
                    type="date"
                    value={weekStartDate}
                    onChange={(e) => setWeekStartDate(e.target.value)}
                    className="w-auto"
                  />
                </div>
                <div>
                  <Label htmlFor="weekEndDate" className="text-xs">Data fim</Label>
                  <Input
                    id="weekEndDate"
                    type="date"
                    value={weekEndDate}
                    onChange={(e) => setWeekEndDate(e.target.value)}
                    className="w-auto"
                  />
                </div>
                <Button
                  onClick={generateWeeklyPDF}
                  disabled={weeklyLoading || !weekStartDate || !weekEndDate}
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
          </>
        )}
      </main>
    </div>
  );
}
