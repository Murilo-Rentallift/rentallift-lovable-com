import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const RECIPIENTS = ["Evandro@rentallift.com.br", "Murilo@rentallift.com"];
const GMAIL_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

// Compute previous Mon-Sun window in Brasília time (UTC-3), returns YYYY-MM-DD ISO
function previousWeekBR(): { startDate: string; endDate: string } {
  const now = new Date();
  // Convert to BR time by shifting -3h
  const br = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const y = br.getUTCFullYear();
  const m = br.getUTCMonth();
  const d = br.getUTCDate();
  const dow = br.getUTCDay(); // 0 Sun ... 1 Mon ... 6 Sat
  // Days since last Monday (of current week). If Sunday(0), it's 6.
  const daysSinceMon = (dow + 6) % 7;
  // Previous week's Monday = this week's Monday - 7 days
  const mondayThis = new Date(Date.UTC(y, m, d - daysSinceMon));
  const monPrev = new Date(mondayThis.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sunPrev = new Date(monPrev.getTime() + 6 * 24 * 60 * 60 * 1000);
  const iso = (dt: Date) =>
    `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
  return { startDate: iso(monPrev), endDate: iso(sunPrev) };
}

function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function toBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function greetingBR(): string {
  const now = new Date();
  const brHour = (now.getUTCHours() - 3 + 24) % 24;
  return brHour < 12 ? "Bom dia" : "Boa tarde";
}

async function fetchMissingRows(startDate: string, endDate: string) {
  const { data: schedules } = await supabaseAdmin
    .from("schedules")
    .select("id, operator_id, work_date")
    .gte("work_date", startDate)
    .lte("work_date", endDate);

  const scheduleIds = (schedules ?? []).map((s) => s.id);
  if (!scheduleIds.length) return [];

  const [{ data: parts }, { data: operators }] = await Promise.all([
    supabaseAdmin
      .from("parts")
      .select("id, schedule_id, name, quantity, status")
      .in("schedule_id", scheduleIds)
      .eq("status", "em_falta"),
    supabaseAdmin.from("operators").select("id, name, position"),
  ]);

  const opMap = new Map((operators ?? []).map((o) => [o.id, o]));
  const schedMap = new Map(
    (schedules ?? []).map((s) => [s.id, { operator_id: s.operator_id, work_date: s.work_date }]),
  );

  const rows = (parts ?? []).map((p) => {
    const sch = schedMap.get(p.schedule_id);
    const op = sch ? opMap.get(sch.operator_id) : undefined;
    return {
      date: sch?.work_date ?? "",
      operatorName: op?.name ?? "—",
      operatorPosition: op?.position ?? 0,
      name: p.name,
      quantity: p.quantity as number,
    };
  });

  rows.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.operatorPosition - b.operatorPosition ||
      a.name.localeCompare(b.name),
  );
  return rows;
}

function buildPDF(
  startDate: string,
  endDate: string,
  rows: Array<{ date: string; operatorName: string; name: string; quantity: number }>,
): string {
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

  if (!rows.length) {
    doc.setTextColor(0, 0, 0);
    doc.text("Nenhuma peça em falta registrada nesta semana.", 14, y);
  } else {
    autoTable(doc, {
      startY: y,
      head: [["Data", "Técnico", "Peça", "Qtd"]],
      body: rows.map((r) => [formatDateBR(r.date), r.operatorName, r.name, String(r.quantity)]),
      theme: "striped",
      headStyles: { fillColor: [127, 29, 29], textColor: 255, fontStyle: "bold" },
      styles: { fontSize: 10, cellPadding: 2 },
      columnStyles: { 0: { cellWidth: 26 }, 3: { halign: "center", cellWidth: 18 } },
      margin: { left: 14, right: 14 },
    });
    // @ts-ignore
    y = (doc as any).lastAutoTable.finalY + 8;

    const totals: Record<string, number> = {};
    rows.forEach((r) => {
      totals[r.name] = (totals[r.name] || 0) + r.quantity;
    });

    if (y > 240) {
      doc.addPage();
      y = 20;
    }
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

  // dataurlstring returns "data:application/pdf;filename=...;base64,XXXX"
  const dataUrl = doc.output("datauristring");
  const b64 = dataUrl.split("base64,")[1] ?? "";
  return b64;
}

async function sendEmailWithPDF(params: {
  startDate: string;
  endDate: string;
  fileName: string;
  pdfBase64: string;
}) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const gmailKey = process.env.GOOGLE_MAIL_API_KEY;
  if (!lovableKey) throw new Error("LOVABLE_API_KEY não configurada");
  if (!gmailKey) throw new Error("GOOGLE_MAIL_API_KEY não configurada");

  const boundary = `bnd_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const pdfB64 = params.pdfBase64.replace(/\s+/g, "");
  const greeting = greetingBR();
  const body = `${greeting},\r\n\r\nSegue em anexo o relatório semanal de peças em falta do almoxarifado, referente ao período de ${formatDateBR(params.startDate)} a ${formatDateBR(params.endDate)}.\r\n\r\nQualquer dúvida estamos à disposição.`;

  const mime = [
    `To: ${RECIPIENTS.join(", ")}`,
    `Subject: Relatório Semanal — Peças em Falta (${formatDateBR(params.startDate)} a ${formatDateBR(params.endDate)})`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    body,
    ``,
    `--${boundary}`,
    `Content-Type: application/pdf; name="${params.fileName}"`,
    `Content-Disposition: attachment; filename="${params.fileName}"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    pdfB64,
    ``,
    `--${boundary}--`,
  ].join("\r\n");

  const raw = toBase64Url(mime);

  const res = await fetch(`${GMAIL_URL}/users/me/messages/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": gmailKey,
    },
    body: JSON.stringify({ raw }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Falha ao enviar email (${res.status}): ${errText}`);
  }
  return await res.json();
}

export const Route = createFileRoute("/api/public/hooks/weekly-missing-parts")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const { startDate, endDate } = previousWeekBR();
          const rows = await fetchMissingRows(startDate, endDate);
          const pdfBase64 = buildPDF(startDate, endDate, rows);
          const fileName = `pecas_em_falta_${startDate}_a_${endDate}.pdf`;
          const result = await sendEmailWithPDF({ startDate, endDate, fileName, pdfBase64 });
          console.log("[weekly-missing-parts] enviado", {
            startDate,
            endDate,
            rows: rows.length,
            messageId: result?.id,
          });
          return Response.json({
            ok: true,
            startDate,
            endDate,
            rowCount: rows.length,
            recipients: RECIPIENTS,
          });
        } catch (e: any) {
          console.error("[weekly-missing-parts] erro", e);
          return Response.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
        }
      },
    },
  },
});
