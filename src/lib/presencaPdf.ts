import { jsPDF } from "jspdf";
import { RENTAL_LIFT_LOGO_B64 } from "@/lib/assets/rental-lift-logo-b64";

export type PdfRow = { nome: string; assinatura: string };

/** Recorta o PNG da assinatura ao redor do traço. */
async function cropSignature(dataUrl: string): Promise<{ url: string; w: number; h: number } | null> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] > 0 && data[i] < 140 && data[i + 1] < 140) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  const pad = 4;
  minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad); maxY = Math.min(height - 1, maxY + pad);
  const w = maxX - minX + 1, h = maxY - minY + 1;
  const out = document.createElement("canvas");
  out.width = w; out.height = h;
  const o = out.getContext("2d")!;
  o.fillStyle = "#fff";
  o.fillRect(0, 0, w, h);
  // copia só pixels de tinta (fundo vira branco)
  const src = ctx.getImageData(minX, minY, w, h);
  for (let i = 0; i < src.data.length; i += 4) {
    if (!(src.data[i] < 140 && src.data[i + 1] < 140)) {
      src.data[i] = src.data[i + 1] = src.data[i + 2] = 255;
    }
  }
  o.putImageData(src, 0, 0);
  return { url: out.toDataURL("image/png"), w, h };
}

export async function buildPresencaPdf(opts: { dataBR: string; assunto: string; rows: PdfRow[] }) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setLineWidth(0.25);
  doc.setDrawColor(0);
  doc.setTextColor(0);
  const GRAY: [number, number, number] = [217, 217, 217];

  const left = 25;
  // Logo
  const logoW = 40;
  const logoH = logoW * (279 / 550);
  doc.addImage(`data:image/png;base64,${RENTAL_LIFT_LOGO_B64}`, "PNG", left, 10, logoW, logoH);

  // Barra de título
  const tX = left + logoW + 8;
  const tW = 160;
  doc.setFillColor(...GRAY);
  doc.rect(tX, 10, tW, 9, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("LISTA DE PRESENÇA", tX + tW / 2, 16.2, { align: "center" });

  // DATA / ASSUNTO
  doc.setFontSize(8);
  const lblW = 20;
  doc.rect(tX, 21, lblW, 6, "FD");
  doc.text("DATA:", tX + lblW / 2, 25, { align: "center" });
  doc.rect(tX + lblW, 21, 35, 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(opts.dataBR, tX + lblW + 17.5, 25, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.rect(tX, 28, lblW, 6, "FD");
  doc.text("ASSUNTO :", tX + lblW / 2, 32, { align: "center" });
  doc.rect(tX + lblW, 28, 80, 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(opts.assunto, tX + lblW + 40, 32, { align: "center" });

  // Tabela
  const numW = 10, nameW = 105, sigW = 105;
  const tableX = (297 - (numW + nameW + sigW)) / 2;
  let y = 42;
  const rowsCount = Math.max(18, opts.rows.length);
  const available = 200 - y - 6.5;
  const rowH = Math.min(6.5, available / rowsCount);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.rect(tableX, y, numW, 6.5);
  doc.rect(tableX + numW, y, nameW, 6.5, "FD");
  doc.rect(tableX + numW + nameW, y, sigW, 6.5, "FD");
  doc.text("NOME", tableX + numW + nameW / 2, y + 4.4, { align: "center" });
  doc.text("ASSINATURA", tableX + numW + nameW + sigW / 2, y + 4.4, { align: "center" });
  y += 6.5;

  for (let i = 0; i < rowsCount; i++) {
    doc.rect(tableX, y, numW, rowH);
    doc.rect(tableX + numW, y, nameW, rowH);
    doc.rect(tableX + numW + nameW, y, sigW, rowH);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(String(i + 1), tableX + numW / 2, y + rowH / 2 + 1.1, { align: "center" });
    const r = opts.rows[i];
    if (r) {
      doc.setFontSize(9);
      doc.text(r.nome, tableX + numW + nameW / 2, y + rowH / 2 + 1.2, { align: "center" });
      const sig = await cropSignature(r.assinatura);
      if (sig) {
        const maxW = sigW - 4, maxH = rowH - 0.8;
        const s = Math.min(maxW / sig.w, maxH / sig.h);
        const w = sig.w * s, h = sig.h * s;
        doc.addImage(sig.url, "PNG", tableX + numW + nameW + (sigW - w) / 2, y + (rowH - h) / 2, w, h);
      }
    }
    y += rowH;
  }
  return doc;
}
