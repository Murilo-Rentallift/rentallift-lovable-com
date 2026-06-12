import { createServerFn } from "@tanstack/react-start";

const DESTINATARIOS = [
  "Murilo@rentallift.com",
  "william@rentallift.com",
  "manutencao@rentallift.com",
  "evandro@rentallift.com.br",
  "recepcao@rentallift.com",
];

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

type Input = {
  body: string;
  fileName: string;
  pdfBase64: string; // base64 (sem prefixo data:)
  clientEmail?: string;
};

const SUBJECT_FIXO = "CHECKLIST DE SAIDA";


// Codifica string UTF-8 em base64url (compatível com Gmail API)
function toBase64Url(input: string): string {
  // btoa só aceita latin1; convertemos UTF-8 -> binário primeiro
  const bytes = new TextEncoder().encode(input);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64ToBase64Url(b64: string): string {
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const sendChecklistEmail = createServerFn({ method: "POST" })
  .inputValidator((data: Input) => {
    if (!data || typeof data !== "object") throw new Error("Payload inválido");
    if (!data.body || data.body.length > 5000) throw new Error("Corpo inválido");
    if (!data.fileName || !/^[\w\-\. ]+\.pdf$/i.test(data.fileName)) throw new Error("Nome de arquivo inválido");
    if (!data.pdfBase64 || data.pdfBase64.length > 15_000_000) throw new Error("PDF inválido ou muito grande");
    if (data.clientEmail) {
      const e = data.clientEmail.trim();
      if (e.length > 320 || !EMAIL_RE.test(e)) throw new Error("Email do cliente inválido");
    }
    return data;
  })
  .handler(async ({ data }) => {
    const lovableKey = process.env.LOVABLE_API_KEY;
    const gmailKey = process.env.GOOGLE_MAIL_API_KEY;
    if (!lovableKey) throw new Error("LOVABLE_API_KEY não configurada");
    if (!gmailKey) throw new Error("GOOGLE_MAIL_API_KEY não configurada (conector Gmail)");

    // Monta um email MIME multipart/mixed com o PDF anexado
    const boundary = `bnd_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const pdfB64 = data.pdfBase64.replace(/\s+/g, "");

    const recipients = [...DESTINATARIOS];
    if (data.clientEmail) recipients.push(data.clientEmail.trim());

    const mime = [
      `To: ${recipients.join(", ")}`,
      `Subject: ${SUBJECT_FIXO}`,

      `MIME-Version: 1.0`,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset="UTF-8"`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      data.body,
      ``,
      `--${boundary}`,
      `Content-Type: application/pdf; name="${data.fileName}"`,
      `Content-Disposition: attachment; filename="${data.fileName}"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      pdfB64,
      ``,
      `--${boundary}--`,
    ].join("\r\n");

    const raw = toBase64Url(mime);

    const res = await fetch(`${GATEWAY_URL}/users/me/messages/send`, {
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

    const result = await res.json();
    // Suprime warning de variável não usada caso o helper deixe de ser necessário
    void base64ToBase64Url;
    return { ok: true, id: result?.id, recipients };
  });
