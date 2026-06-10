import { createServerFn } from "@tanstack/react-start";

const DESTINATARIOS = [
  "Murilo@rentallift.com",
  "william@rentallift.com",
  "manutencao@rentallift.com",
  "evandro@rentallift.com.br",
  "recepcao@rentallift.com",
];

type Input = {
  subject: string;
  body: string;
  fileName: string;
  pdfBase64: string; // base64 (sem prefixo data:)
};

export const sendChecklistEmail = createServerFn({ method: "POST" })
  .inputValidator((data: Input) => {
    if (!data || typeof data !== "object") throw new Error("Payload inválido");
    if (!data.subject || data.subject.length > 300) throw new Error("Assunto inválido");
    if (!data.body || data.body.length > 5000) throw new Error("Corpo inválido");
    if (!data.fileName || !/^[\w\-\. ]+\.pdf$/i.test(data.fileName)) throw new Error("Nome de arquivo inválido");
    if (!data.pdfBase64 || data.pdfBase64.length > 15_000_000) throw new Error("PDF inválido ou muito grande");
    return data;
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY não configurada");

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: "Checklist Rental Lift <onboarding@resend.dev>",
        to: DESTINATARIOS,
        subject: data.subject,
        text: data.body,
        attachments: [
          {
            filename: data.fileName,
            content: data.pdfBase64,
          },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Falha ao enviar email (${res.status}): ${errText}`);
    }

    const result = await res.json();
    return { ok: true, id: result?.id, recipients: DESTINATARIOS };
  });
