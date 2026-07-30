import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

const BUCKET = "maquinas-fotos";
const SIGNED_TTL = 60 * 60 * 8; // 8h

export type MaquinaRow = {
  id: string;
  tipo: string;
  frota: string;
  modelo: string;
  marca: string;
  ano_fabricacao: number | null;
  status: string;
  observacoes: string | null;
  fotos: string[];
  fotosUrls: string[];
  created_at: string;
};

async function withSignedUrls(rows: any[]): Promise<MaquinaRow[]> {
  const allPaths = rows.flatMap((r) => (r.fotos ?? []) as string[]);
  const map = new Map<string, string>();
  if (allPaths.length) {
    const { data } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrls(allPaths, SIGNED_TTL);
    for (const item of data ?? []) {
      if (item.path && item.signedUrl) map.set(item.path, item.signedUrl);
    }
  }
  return rows.map((r) => ({
    ...r,
    fotos: (r.fotos ?? []) as string[],
    fotosUrls: ((r.fotos ?? []) as string[]).map((p) => map.get(p) ?? ""),
  }));
}

export const listMaquinas = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("maquinas_disponibilidade")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return withSignedUrls(data ?? []);
});

const fotoSchema = z.object({ dataUrl: z.string().min(10), name: z.string().optional() });

const maquinaInput = z.object({
  tipo: z.string().min(1),
  frota: z.string().default(""),
  modelo: z.string().default(""),
  marca: z.string().default(""),
  anoFabricacao: z.number().int().nullable().optional(),
  status: z.enum(["disponivel", "reservada"]).default("disponivel"),
  observacoes: z.string().nullable().optional(),
  fotosExistentes: z.array(z.string()).default([]),
  novasFotos: z.array(fotoSchema).default([]),
});

async function uploadFotos(novas: { dataUrl: string; name?: string }[]): Promise<string[]> {
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
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType, upsert: false });
    if (error) throw new Error(`Falha ao enviar foto: ${error.message}`);
    paths.push(path);
  }
  return paths;
}

export const createMaquina = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => maquinaInput.parse(d))
  .handler(async ({ data }) => {
    const novas = await uploadFotos(data.novasFotos);
    const { error } = await supabaseAdmin.from("maquinas_disponibilidade").insert({
      tipo: data.tipo,
      frota: data.frota,
      modelo: data.modelo,
      marca: data.marca,
      ano_fabricacao: data.anoFabricacao ?? null,
      status: data.status,
      observacoes: data.observacoes ?? null,
      fotos: [...data.fotosExistentes, ...novas],
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateMaquina = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => maquinaInput.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { data: current } = await supabaseAdmin
      .from("maquinas_disponibilidade")
      .select("fotos")
      .eq("id", data.id)
      .maybeSingle();
    const previous = (current?.fotos ?? []) as string[];
    const removed = previous.filter((p) => !data.fotosExistentes.includes(p));
    const novas = await uploadFotos(data.novasFotos);
    const { error } = await supabaseAdmin
      .from("maquinas_disponibilidade")
      .update({
        tipo: data.tipo,
        frota: data.frota,
        modelo: data.modelo,
        marca: data.marca,
        ano_fabricacao: data.anoFabricacao ?? null,
        status: data.status,
        observacoes: data.observacoes ?? null,
        fotos: [...data.fotosExistentes, ...novas],
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    if (removed.length) await supabaseAdmin.storage.from(BUCKET).remove(removed);
    return { ok: true };
  });

export const deleteMaquina = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { data: current } = await supabaseAdmin
      .from("maquinas_disponibilidade")
      .select("fotos")
      .eq("id", data.id)
      .maybeSingle();
    const fotos = (current?.fotos ?? []) as string[];
    const { error } = await supabaseAdmin
      .from("maquinas_disponibilidade")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    if (fotos.length) await supabaseAdmin.storage.from(BUCKET).remove(fotos);
    return { ok: true };
  });
