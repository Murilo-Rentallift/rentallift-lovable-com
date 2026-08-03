// Helpers server-only do módulo CARROS (frota de veículos de apoio).
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BUCKET = "maquinas-fotos";
const SIGNED_TTL = 60 * 60 * 8;
const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

export async function verifyOficinaPin(pin: string) {
  if (!/^\d{4,8}$/.test(pin)) throw new Error("PIN inválido");
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("admin_pin, oficina_pin")
    .eq("id", 1)
    .maybeSingle();
  if (!data) throw new Error("Configuração ausente");
  if (pin !== data.oficina_pin && pin !== data.admin_pin) {
    throw new Error("PIN da oficina incorreto");
  }
}

export async function uploadFotosCarros(
  novas: { dataUrl: string; name?: string }[],
): Promise<string[]> {
  const paths: string[] = [];
  for (const f of novas) {
    const comma = f.dataUrl.indexOf(",");
    const meta = f.dataUrl.slice(0, comma);
    const b64 = f.dataUrl.slice(comma + 1);
    const contentType = /data:([^;]+)/.exec(meta)?.[1] ?? "image/jpeg";
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const ext = contentType.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
    const path = `carros/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType, upsert: false });
    if (error) throw new Error(`Falha ao enviar foto: ${error.message}`);
    paths.push(path);
  }
  return paths;
}

export async function signFotos(paths: string[]): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  if (!paths.length) return map;
  const { data } = await supabaseAdmin.storage.from(BUCKET).createSignedUrls(paths, SIGNED_TTL);
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
  }
  return map;
}

function toBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sendGmail(opts: {
  to: string[];
  subject: string;
  body: string;
  attachment?: { fileName: string; pdfBase64: string };
}) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const gmailKey = process.env.GOOGLE_MAIL_API_KEY;
  if (!lovableKey) throw new Error("LOVABLE_API_KEY não configurada");
  if (!gmailKey) throw new Error("GOOGLE_MAIL_API_KEY não configurada (conector Gmail)");

  let mime: string;
  if (opts.attachment) {
    const boundary = `bnd_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    mime = [
      `To: ${opts.to.join(", ")}`,
      `Subject: ${opts.subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset="UTF-8"`,
      ``,
      opts.body,
      ``,
      `--${boundary}`,
      `Content-Type: application/pdf; name="${opts.attachment.fileName}"`,
      `Content-Disposition: attachment; filename="${opts.attachment.fileName}"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      opts.attachment.pdfBase64.replace(/\s+/g, ""),
      ``,
      `--${boundary}--`,
    ].join("\r\n");
  } else {
    mime = [
      `To: ${opts.to.join(", ")}`,
      `Subject: ${opts.subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/plain; charset="UTF-8"`,
      ``,
      opts.body,
    ].join("\r\n");
  }

  const res = await fetch(`${GATEWAY_URL}/users/me/messages/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": gmailKey,
    },
    body: JSON.stringify({ raw: toBase64Url(mime) }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Falha ao enviar email (${res.status}): ${errText}`);
  }
  const result = (await res.json()) as { id?: string };
  return { ok: true as const, id: result?.id, recipients: opts.to };
}

export const ALERTA_MANUTENCAO_PADRAO = ["Murilo@rentallift.com", "rildo@rentallift.com"];
