import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

export type MeetingSummary = {
  summary: string;
  critical_points: string[];
  decisions: string[];
  todos: Array<{ action: string; responsible?: string | null }>;
};

export const listMeetings = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("meetings")
    .select("id, title, summary, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const getMeeting = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("meetings")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Reunião não encontrada");
    return row;
  });

export const deleteMeeting = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("meetings").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const renameMeeting = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; title: string }) =>
    z.object({ id: z.string().uuid(), title: z.string().min(1).max(200) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("meetings")
      .update({ title: data.title })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Analyze transcript with Lovable AI and persist the meeting.
export const analyzeAndSaveMeeting = createServerFn({ method: "POST" })
  .inputValidator((d: { title: string; transcript: string }) =>
    z
      .object({
        title: z.string().min(1).max(200),
        transcript: z.string().min(1).max(200000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");

    const system = `Você é um assistente que analisa transcrições de reuniões em português.
Retorne SOMENTE um JSON válido no seguinte formato exato:
{
  "summary": "resumo geral em 1-2 parágrafos",
  "critical_points": ["ponto crítico 1", "ponto crítico 2"],
  "decisions": ["decisão 1", "decisão 2"],
  "todos": [{"action": "ação a fazer", "responsible": "nome ou null se não mencionado"}]
}
Se algum campo não tiver conteúdo, retorne lista vazia. Nunca invente informações que não estejam no texto.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: system },
          { role: "user", content: `Transcrição da reunião:\n\n${data.transcript}` },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      if (resp.status === 429) throw new Error("Limite de requisições atingido. Tente novamente em instantes.");
      if (resp.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos no workspace.");
      throw new Error(`Falha na análise (${resp.status}): ${txt.slice(0, 300)}`);
    }

    const json = await resp.json();
    const content: string = json?.choices?.[0]?.message?.content ?? "{}";
    let parsed: MeetingSummary;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("Resposta da IA não estava em JSON válido.");
    }

    const safe: MeetingSummary = {
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      critical_points: Array.isArray(parsed.critical_points) ? parsed.critical_points.map(String) : [],
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions.map(String) : [],
      todos: Array.isArray(parsed.todos)
        ? parsed.todos.map((t: any) => ({
            action: String(t?.action ?? ""),
            responsible: t?.responsible ? String(t.responsible) : null,
          })).filter((t) => t.action)
        : [],
    };

    const { data: inserted, error } = await supabaseAdmin
      .from("meetings")
      .insert({
        title: data.title,
        transcript: data.transcript,
        summary: safe.summary,
        critical_points: safe.critical_points,
        decisions: safe.decisions,
        todos: safe.todos,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return { id: inserted.id, ...safe };
  });
