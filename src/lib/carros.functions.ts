import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  verifyOficinaPin,
  uploadFotosCarros,
  signFotos,
  sendGmail,
  ALERTA_MANUTENCAO_PADRAO,
  DESTINATARIOS_FROTA,
} from "@/lib/carros.server";

export type VeiculoCard = {
  id: string;
  veiculo: string;
  numero_frota: string;
  placa: string;
  condutor_atual: string;
  status: string;
  ultimoChecklist: string | null;
  pendenciasAbertas: number;
  manutencoesAbertas: number;
  emUso: null | {
    id: string;
    retirado_por: string;
    destino_motivo: string;
    data_saida: string;
    km_saida: number | null;
  };
};

export const carrosListFrota = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ pin: z.string() }).parse(d))
  .handler(async ({ data }): Promise<VeiculoCard[]> => {
    await verifyOficinaPin(data.pin);
    const [veiculos, checklists, pendencias, solicitacoes, retiradas] = await Promise.all([
      supabaseAdmin
        .from("frota_veiculos")
        .select("*")
        .order("numero_frota", { ascending: true }),
      supabaseAdmin.from("checklists_veiculos").select("veiculo_id, data, created_at"),
      supabaseAdmin.from("pendencias_veiculos").select("veiculo_id").eq("status", "aberta"),
      supabaseAdmin.from("solicitacoes_manutencao").select("veiculo_id").eq("status", "aberta"),
      supabaseAdmin
        .from("retiradas_veiculos")
        .select("id, veiculo_id, retirado_por, destino_motivo, data_saida, km_saida")
        .is("data_retorno", null),
    ]);
    if (veiculos.error) throw new Error(veiculos.error.message);

    const lastCk = new Map<string, string>();
    for (const c of checklists.data ?? []) {
      const prev = lastCk.get(c.veiculo_id);
      if (!prev || c.created_at > prev) lastCk.set(c.veiculo_id, c.created_at);
    }
    const countBy = (rows: { veiculo_id: string }[] | null) => {
      const m = new Map<string, number>();
      for (const r of rows ?? []) m.set(r.veiculo_id, (m.get(r.veiculo_id) ?? 0) + 1);
      return m;
    };
    const pend = countBy(pendencias.data);
    const man = countBy(solicitacoes.data);
    const uso = new Map<string, any>();
    for (const r of retiradas.data ?? []) uso.set(r.veiculo_id, r);

    return (veiculos.data ?? [])
      .sort((a, b) => Number(a.numero_frota) - Number(b.numero_frota))
      .map((v) => ({
        id: v.id,
        veiculo: v.veiculo,
        numero_frota: v.numero_frota,
        placa: v.placa,
        condutor_atual: v.condutor_atual,
        status: v.status,
        ultimoChecklist: lastCk.get(v.id) ?? null,
        pendenciasAbertas: pend.get(v.id) ?? 0,
        manutencoesAbertas: man.get(v.id) ?? 0,
        emUso: uso.get(v.id)
          ? {
              id: uso.get(v.id).id,
              retirado_por: uso.get(v.id).retirado_por,
              destino_motivo: uso.get(v.id).destino_motivo,
              data_saida: uso.get(v.id).data_saida,
              km_saida: uso.get(v.id).km_saida,
            }
          : null,
      }));
  });

export const carrosGetVeiculo = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ pin: z.string(), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    await verifyOficinaPin(data.pin);
    const [veiculo, checklists, pendencias, retiradas, solicitacoes, historico] =
      await Promise.all([
        supabaseAdmin.from("frota_veiculos").select("*").eq("id", data.id).maybeSingle(),
        supabaseAdmin
          .from("checklists_veiculos")
          .select("*")
          .eq("veiculo_id", data.id)
          .order("created_at", { ascending: false }),
        supabaseAdmin
          .from("pendencias_veiculos")
          .select("*")
          .eq("veiculo_id", data.id)
          .order("created_at", { ascending: false }),
        supabaseAdmin
          .from("retiradas_veiculos")
          .select("*")
          .eq("veiculo_id", data.id)
          .order("data_saida", { ascending: false }),
        supabaseAdmin
          .from("solicitacoes_manutencao")
          .select("*")
          .eq("veiculo_id", data.id)
          .order("created_at", { ascending: false }),
        supabaseAdmin
          .from("historico_condutores")
          .select("*")
          .eq("veiculo_id", data.id)
          .order("created_at", { ascending: false }),
      ]);
    if (!veiculo.data) throw new Error("Veículo não encontrado");

    const paths = (pendencias.data ?? []).flatMap((p) => (p.fotos ?? []) as string[]);
    const signed = await signFotos(paths);

    return {
      veiculo: veiculo.data,
      checklists: checklists.data ?? [],
      pendencias: (pendencias.data ?? []).map((p) => ({
        ...p,
        fotosUrls: ((p.fotos ?? []) as string[]).map((f) => signed[f] ?? ""),
      })),
      retiradas: retiradas.data ?? [],
      solicitacoes: solicitacoes.data ?? [],
      historicoCondutores: historico.data ?? [],
    };
  });

export const carrosUpdateCondutor = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({ pin: z.string(), id: z.string().uuid(), condutor: z.string().min(1).max(120) })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await verifyOficinaPin(data.pin);
    const { data: atual } = await supabaseAdmin
      .from("frota_veiculos")
      .select("condutor_atual")
      .eq("id", data.id)
      .maybeSingle();
    const anterior = atual?.condutor_atual ?? "";
    const novo = data.condutor.trim();
    if (anterior === novo) return { ok: true };
    const { error } = await supabaseAdmin
      .from("frota_veiculos")
      .update({ condutor_atual: novo })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("historico_condutores").insert({
      veiculo_id: data.id,
      condutor_anterior: anterior,
      condutor_novo: novo,
    });
    return { ok: true };
  });

export const carrosSaveChecklist = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        pin: z.string(),
        veiculoId: z.string().uuid(),
        frota: z.string().default(""),
        placa: z.string().default(""),
        condutor: z.string().default(""),
        data: z.string().default(""),
        vistoriador: z.string().default(""),
        lider: z.string().default(""),
        obsManutencao: z.string().default(""),
        statusFinal: z.enum(["disponivel", "pendencia", "manutencao"]),
        assinaturas: z
          .object({
            vistoriador: z.string().default(""),
            lider: z.string().default(""),
            condutor: z.string().default(""),
          })
          .default({ vistoriador: "", lider: "", condutor: "" }),
        fotosGerais: z.array(z.object({ dataUrl: z.string().min(10) })).default([]),
        itens: z
          .array(
            z.object({
              item: z.string(),
              resposta: z.enum(["sim", "nao"]).nullable(),
              obs: z.string().default(""),
              fotos: z.array(z.object({ dataUrl: z.string().min(10) })).default([]),
            }),
          )
          .min(1),

      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await verifyOficinaPin(data.pin);

    const itensPersistidos: {
      item: string;
      resposta: string | null;
      obs: string;
      fotos: string[];
    }[] = [];
    for (const it of data.itens) {
      const fotos = it.fotos.length ? await uploadFotosCarros(it.fotos) : [];
      itensPersistidos.push({ item: it.item, resposta: it.resposta, obs: it.obs, fotos });
    }

    if (data.fotosGerais.length) {
      const fotos = await uploadFotosCarros(data.fotosGerais);
      itensPersistidos.push({
        item: "FOTOS GERAIS DO VEÍCULO",
        resposta: null,
        obs: "",
        fotos,
      });
    }



    const { data: ck, error } = await supabaseAdmin
      .from("checklists_veiculos")
      .insert({
        veiculo_id: data.veiculoId,
        frota: data.frota,
        placa: data.placa,
        condutor: data.condutor,
        data: data.data || new Date().toISOString().slice(0, 10),
        vistoriador: data.vistoriador,
        lider: data.lider,
        itens: itensPersistidos,
        obs_manutencao: data.obsManutencao,
        status_final: data.statusFinal,
        assinaturas: data.assinaturas,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const naoConformes = itensPersistidos.filter((i) => i.resposta === "nao");
    if (naoConformes.length) {
      await supabaseAdmin.from("pendencias_veiculos").insert(
        naoConformes.map((i) => ({
          veiculo_id: data.veiculoId,
          checklist_id: ck.id,
          item: i.item,
          descricao: i.obs,
          fotos: i.fotos,
        })),
      );
    }

    await supabaseAdmin
      .from("frota_veiculos")
      .update({ status: data.statusFinal })
      .eq("id", data.veiculoId);

    let solicitacaoId: string | null = null;
    if (data.statusFinal === "manutencao") {
      const descricao = [
        data.obsManutencao,
        ...naoConformes.map((i) => `${i.item}: ${i.obs}`),
      ]
        .filter(Boolean)
        .join(" | ");
      const { data: sol } = await supabaseAdmin
        .from("solicitacoes_manutencao")
        .insert({
          veiculo_id: data.veiculoId,
          origem: "checklist",
          descricao: descricao || "Checklist finalizado com necessidade de manutenção",
          status: "aberta",
        })
        .select("id, descricao")
        .single();
      solicitacaoId = sol?.id ?? null;
    }

    return { ok: true, checklistId: ck.id, solicitacaoId };
  });

export const carrosRetirar = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        pin: z.string(),
        veiculoId: z.string().uuid(),
        retiradoPor: z.string().min(1).max(120),
        destinoMotivo: z.string().max(500).default(""),
        kmSaida: z.number().nullable().default(null),
        dataSaida: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await verifyOficinaPin(data.pin);
    const { data: aberta } = await supabaseAdmin
      .from("retiradas_veiculos")
      .select("id")
      .eq("veiculo_id", data.veiculoId)
      .is("data_retorno", null)
      .maybeSingle();
    if (aberta) throw new Error("Veículo já está em uso");
    const { error } = await supabaseAdmin.from("retiradas_veiculos").insert({
      veiculo_id: data.veiculoId,
      retirado_por: data.retiradoPor.trim(),
      destino_motivo: data.destinoMotivo,
      km_saida: data.kmSaida,
      ...(data.dataSaida ? { data_saida: new Date(data.dataSaida).toISOString() } : {}),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const carrosDevolver = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        pin: z.string(),
        retiradaId: z.string().uuid(),
        kmRetorno: z.number().nullable().default(null),
        observacao: z.string().max(2000).default(""),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await verifyOficinaPin(data.pin);
    const { data: retirada } = await supabaseAdmin
      .from("retiradas_veiculos")
      .select("id, veiculo_id, retirado_por")
      .eq("id", data.retiradaId)
      .maybeSingle();
    if (!retirada) throw new Error("Retirada não encontrada");

    const { error } = await supabaseAdmin
      .from("retiradas_veiculos")
      .update({
        km_retorno: data.kmRetorno,
        data_retorno: new Date().toISOString(),
        observacao_devolucao: data.observacao || null,
      })
      .eq("id", data.retiradaId);
    if (error) throw new Error(error.message);

    let solicitacaoId: string | null = null;
    if (data.observacao.trim()) {
      const { data: sol } = await supabaseAdmin
        .from("solicitacoes_manutencao")
        .insert({
          veiculo_id: retirada.veiculo_id,
          origem: "devolucao_reserva",
          descricao: `Devolução por ${retirada.retirado_por}: ${data.observacao.trim()}`,
          status: "aberta",
        })
        .select("id")
        .single();
      solicitacaoId = sol?.id ?? null;
      await supabaseAdmin
        .from("frota_veiculos")
        .update({ status: "manutencao" })
        .eq("id", retirada.veiculo_id);
    }
    return { ok: true, veiculoId: retirada.veiculo_id, solicitacaoId };
  });

export const carrosResolvePendencia = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ pin: z.string(), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    await verifyOficinaPin(data.pin);
    const { error } = await supabaseAdmin
      .from("pendencias_veiculos")
      .update({ status: "resolvida", resolved_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const carrosResolveSolicitacao = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ pin: z.string(), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    await verifyOficinaPin(data.pin);
    const { data: sol } = await supabaseAdmin
      .from("solicitacoes_manutencao")
      .select("veiculo_id")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await supabaseAdmin
      .from("solicitacoes_manutencao")
      .update({ status: "resolvida", resolved_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    if (sol) {
      const { data: restantes } = await supabaseAdmin
        .from("solicitacoes_manutencao")
        .select("id")
        .eq("veiculo_id", sol.veiculo_id)
        .eq("status", "aberta");
      if (!restantes?.length) {
        const { data: pend } = await supabaseAdmin
          .from("pendencias_veiculos")
          .select("id")
          .eq("veiculo_id", sol.veiculo_id)
          .eq("status", "aberta");
        await supabaseAdmin
          .from("frota_veiculos")
          .update({ status: pend?.length ? "pendencia" : "disponivel" })
          .eq("id", sol.veiculo_id);
      }
    }
    return { ok: true };
  });

export const carrosListSolicitacoes = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ pin: z.string() }).parse(d))
  .handler(async ({ data }) => {
    await verifyOficinaPin(data.pin);
    const { data: rows, error } = await supabaseAdmin
      .from("solicitacoes_manutencao")
      .select("*, frota_veiculos(veiculo, numero_frota, placa)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const carrosSendChecklistEmail = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        pin: z.string(),
        fileName: z.string().regex(/^[\w\-. ]+\.pdf$/i),
        pdfBase64: z.string().min(100).max(15_000_000),
        body: z.string().max(5000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await verifyOficinaPin(data.pin);
    return sendGmail({
      to: DESTINATARIOS_FROTA,
      subject: "CHECK LIST VEICULOS FROTA",
      body: data.body,
      attachment: { fileName: data.fileName, pdfBase64: data.pdfBase64 },
    });
  });

export const carrosSendAlertaManutencao = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        pin: z.string(),
        veiculoLabel: z.string().max(200),
        origem: z.string().max(60),
        descricao: z.string().max(4000),
        extraRecipients: z.array(z.string().email()).max(10).default([]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await verifyOficinaPin(data.pin);
    const to = Array.from(new Set([...ALERTA_MANUTENCAO_PADRAO, ...data.extraRecipients]));
    const body = [
      "Nova solicitação de manutenção registrada.",
      "",
      `Veículo: ${data.veiculoLabel}`,
      `Origem: ${data.origem}`,
      "",
      "Descrição:",
      data.descricao,
    ].join("\n");
    return sendGmail({
      to,
      subject: `ALERTA MANUTENÇÃO — ${data.veiculoLabel}`,
      body,
    });
  });
