import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const RECIPIENTS = [
  "Murilo@rentallift.com",
  "manutencao@rentallift.com",
  "manutencao1@rentallift.com",
  "daniela.campos@rentallift.com",
];
const GMAIL_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

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

function formatDuration(startIso: string): string {
  const ms = Date.now() - new Date(startIso).getTime();
  const totalHours = Math.floor(ms / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days > 0 && hours > 0) return `${days} dia(s) e ${hours} hora(s)`;
  if (days > 0) return `${days} dia(s)`;
  return `${hours} hora(s)`;
}

async function sendEmail(item: any) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const gmailKey = process.env.GOOGLE_MAIL_API_KEY;
  if (!lovableKey) throw new Error("LOVABLE_API_KEY não configurada");
  if (!gmailKey) throw new Error("GOOGLE_MAIL_API_KEY não configurada");

  const greeting = greetingBR();
  const tempo = formatDuration(item.data_inicio_parada);
  const body = [
    `${greeting},`,
    ``,
    `A máquina abaixo está parada há mais de 2 dias:`,
    ``,
    `Código da frota: ${item.codigo_frota}`,
    `Cliente: ${item.cliente || "—"}`,
    `Local: ${item.local || "—"}`,
    `Motivo: ${item.motivo}`,
    `Responsável: ${item.responsavel || "—"}`,
    `Tempo parada: ${tempo}`,
    ``,
    `Qualquer dúvida estamos à disposição.`,
  ].join("\r\n");

  const mime = [
    `To: ${RECIPIENTS.join(", ")}`,
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(`⚠️ Máquina parada há mais de 2 dias - ${item.codigo_frota}`)))}?=`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: 8bit`,
    ``,
    body,
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

export const Route = createFileRoute("/api/public/hooks/check-maquinas-paradas")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
          const { data: rows, error } = await supabaseAdmin
            .from("maquinas_paradas" as any)
            .select("id, codigo_frota, cliente, local, motivo, data_inicio_parada, responsavel")
            .eq("status", "parada")
            .eq("alerta_enviado", false)
            .lte("data_inicio_parada", cutoff);
          if (error) throw new Error(error.message);

          const items = (rows ?? []) as any[];
          const sent: string[] = [];
          for (const item of items) {
            try {
              await sendEmail(item);
              await supabaseAdmin
                .from("maquinas_paradas" as any)
                .update({ alerta_enviado: true })
                .eq("id", item.id);
              sent.push(item.codigo_frota);
            } catch (e: any) {
              console.error("[check-maquinas-paradas] falha ao enviar", item.id, e?.message);
            }
          }

          return Response.json({ ok: true, checked: items.length, sent });
        } catch (e: any) {
          console.error("[check-maquinas-paradas] erro", e);
          return Response.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
        }
      },
    },
  },
});
