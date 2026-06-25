import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

const dataSchema = z.record(z.string(), z.any());

export const listContracts = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("contracts" as any)
    .select("id, contractor_name, created_at, updated_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return { contracts: ((data ?? []) as unknown) as Array<{
    id: string; contractor_name: string; created_at: string; updated_at: string;
  }> };
});

export const getContract = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("contracts" as any)
      .select("id, contractor_name, data, created_at, updated_at")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Contrato não encontrado");
    return row as unknown as {
      id: string; contractor_name: string; data: Record<string, any>;
      created_at: string; updated_at: string;
    };
  });

export const saveContract = createServerFn({ method: "POST" })
  .inputValidator((d: { id?: string | null; contractorName: string; data: Record<string, any> }) =>
    z.object({
      id: z.string().uuid().nullish(),
      contractorName: z.string().trim().min(1).max(300),
      data: dataSchema,
    }).parse(d),
  )
  .handler(async ({ data }) => {
    if (data.id) {
      const { error } = await supabaseAdmin
        .from("contracts" as any)
        .update({ contractor_name: data.contractorName, data: data.data })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabaseAdmin
      .from("contracts" as any)
      .insert({ contractor_name: data.contractorName, data: data.data })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (row as any).id as string };
  });

export const deleteContract = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("contracts" as any)
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
