import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const RH_EMAIL = "rh@rentallift.com";
const SUBJECT = "LISTA DE PRESENÇA";
const BUCKET = "presenca";
const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

function toBase64(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
const toB64Url = (s: string) => toBase64(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

type Part = { nome: string; status: "assinado" | "ausente"; ordem: number };

function fmtBR(d: string) {
  const [y, m, dd] = d.split("-");
  return `${dd}/${m}/${y}`;
}

function buildBody(data: string, assunto: string, parts: Part[]) {
  const pres = parts.filter((p) => p.status === "assinado").length;
  const aus = parts.filter((p) => p.status === "ausente").map((p) => p.nome);
  return `Segue em anexo a lista de presença da reunião de ${assunto} do dia ${fmtBR(data)}. Presentes: ${pres}. Ausentes: ${aus.length ? aus.join(", ") : "nenhum"}.`;
}

async function sendMail(body: string, fileName: string, pdfB64: string) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const gmailKey = process.env.GOOGLE_MAIL_API_KEY;
  if (!lovableKey || !gmailKey) throw new Error("Credenciais de e-mail não configuradas");
  const boundary = `bnd_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const mime = [
    `To: ${RH_EMAIL}`,
    `Subject: =?UTF-8?B?${toBase64(SUBJECT)}?=`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    toBase64(body),
    ``,
    `--${boundary}`,
    `Content-Type: application/pdf; name="${fileName}"`,
    `Content-Disposition: attachment; filename="${fileName}"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    pdfB64,
    ``,
    `--${boundary}--`,
  ].join("\r\n");
  const res = await fetch(`${GATEWAY_URL}/users/me/messages/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": gmailKey,
    },
    body: JSON.stringify({ raw: toB64Url(mime) }),
  });
  if (!res.ok) throw new Error(`Falha ao enviar e-mail (${res.status}): ${await res.text()}`);
}

const saveSchema = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  assunto: z.string().min(1).max(200),
  participantes: z
    .array(z.object({ nome: z.string().min(1).max(120), status: z.enum(["assinado", "ausente"]), ordem: z.number().int() }))
    .min(1)
    .max(100),
  pdfBase64: z.string().min(10).max(15_000_000),
});

export const savePresenca = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => saveSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const pdfB64 = data.pdfBase64.replace(/\s+/g, "");
    const bin = Uint8Array.from(atob(pdfB64), (c) => c.charCodeAt(0));
    const fileName = `Lista_Presenca_${data.data}.pdf`;
    const path = `${data.data}/${Date.now()}_${fileName}`;
    const up = await supabaseAdmin.storage.from(BUCKET).upload(path, bin, { contentType: "application/pdf" });
    if (up.error) throw new Error(`Falha ao salvar PDF: ${up.error.message}`);
    const { data: row, error } = await supabaseAdmin
      .from("presenca_listas")
      .insert({ data: data.data, assunto: data.assunto, participantes: data.participantes, pdf_path: path })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    let emailOk = false;
    let emailError: string | null = null;
    try {
      await sendMail(buildBody(data.data, data.assunto, data.participantes), fileName, pdfB64);
      emailOk = true;
      await supabaseAdmin.from("presenca_listas").update({ email_enviado_em: new Date().toISOString() }).eq("id", row.id);
    } catch (e) {
      emailError = e instanceof Error ? e.message : String(e);
      console.error(emailError);
    }
    return { id: row.id, emailOk, emailError };
  });

export const listPresenca = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("presenca_listas")
    .select("id, data, assunto, participantes, pdf_path, email_enviado_em, created_at")
    .order("data", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ ...r, participantes: r.participantes as unknown as Part[] }));
});

const idSchema = z.object({ id: z.string().uuid() });

export const getPresencaPdf = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("presenca_listas").select("pdf_path").eq("id", data.id).single();
    if (!row?.pdf_path) throw new Error("PDF não encontrado");
    const { data: file, error } = await supabaseAdmin.storage.from(BUCKET).download(row.pdf_path);
    if (error || !file) throw new Error("Falha ao abrir PDF");
    return { base64: bytesToB64(new Uint8Array(await file.arrayBuffer())) };
  });

export const resendPresenca = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("presenca_listas").select("*").eq("id", data.id).single();
    if (!row?.pdf_path) throw new Error("PDF não encontrado");
    const { data: file, error } = await supabaseAdmin.storage.from(BUCKET).download(row.pdf_path);
    if (error || !file) throw new Error("Falha ao ler PDF");
    const b64 = bytesToB64(new Uint8Array(await file.arrayBuffer()));
    await sendMail(buildBody(row.data, row.assunto, row.participantes as unknown as Part[]), `Lista_Presenca_${row.data}.pdf`, b64);
    await supabaseAdmin.from("presenca_listas").update({ email_enviado_em: new Date().toISOString() }).eq("id", data.id);
    return { ok: true };
  });
