import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

const pinSchema = z.string().regex(/^\d{4,8}$/, "PIN inválido");
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");

// ---------- Public: list operators (names only, no PIN) ----------
export const listOperators = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("operators")
    .select("id, name, position")
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  return data;
});

// ---------- Operator: verify PIN + get today's schedule + parts ----------
export const getOperatorDay = createServerFn({ method: "POST" })
  .inputValidator((d: { operatorId: string; pin: string; date: string }) =>
    z.object({
      operatorId: z.string().uuid(),
      pin: pinSchema,
      date: dateSchema,
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { data: op, error: opErr } = await supabaseAdmin
      .from("operators")
      .select("id, name, pin")
      .eq("id", data.operatorId)
      .maybeSingle();
    if (opErr) throw new Error(opErr.message);
    if (!op || op.pin !== data.pin) throw new Error("PIN incorreto");

    const { data: schedule } = await supabaseAdmin
      .from("schedules")
      .select("id, task, updated_at")
      .eq("operator_id", data.operatorId)
      .eq("work_date", data.date)
      .maybeSingle();

    let parts: Array<{ id: string; name: string; quantity: number; checked: boolean }> = [];
    let tasks: Array<{ id: string; position: number; title: string; description: string }> = [];
    if (schedule) {
      const [{ data: p }, { data: t }] = await Promise.all([
        supabaseAdmin
          .from("parts")
          .select("id, name, quantity, checked")
          .eq("schedule_id", schedule.id)
          .order("position", { ascending: true })
          .order("created_at", { ascending: true }),
        supabaseAdmin
          .from("tasks")
          .select("id, position, title, description")
          .eq("schedule_id", schedule.id)
          .order("position", { ascending: true })
          .order("created_at", { ascending: true }),
      ]);
      parts = p ?? [];
      tasks = (t ?? []) as any;
    }

    return {
      operator: { id: op.id, name: op.name },
      schedule: schedule ?? null,
      tasks,
      parts,
    };
  });

// ---------- Operator: toggle part checked (PIN re-checked) ----------
export const togglePart = createServerFn({ method: "POST" })
  .inputValidator((d: { operatorId: string; pin: string; partId: string; checked: boolean }) =>
    z.object({
      operatorId: z.string().uuid(),
      pin: pinSchema,
      partId: z.string().uuid(),
      checked: z.boolean(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { data: op } = await supabaseAdmin
      .from("operators").select("pin").eq("id", data.operatorId).maybeSingle();
    if (!op || op.pin !== data.pin) throw new Error("PIN incorreto");

    // Ensure the part belongs to a schedule owned by this operator
    const { data: part } = await supabaseAdmin
      .from("parts")
      .select("id, schedule_id, schedules!inner(operator_id)")
      .eq("id", data.partId)
      .maybeSingle();
    if (!part || (part as any).schedules.operator_id !== data.operatorId) {
      throw new Error("Item não encontrado");
    }

    const { error } = await supabaseAdmin
      .from("parts").update({ checked: data.checked }).eq("id", data.partId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Admin: verify PIN ----------
async function verifyAdmin(pin: string) {
  pinSchema.parse(pin);
  const { data } = await supabaseAdmin
    .from("app_settings").select("admin_pin").eq("id", 1).maybeSingle();
  if (!data || data.admin_pin !== pin) throw new Error("PIN de administrador incorreto");
}

// ---------- Almoxarifado: verify PIN (accepts almox PIN or admin PIN) ----------
async function verifyAlmox(pin: string) {
  pinSchema.parse(pin);
  const { data } = await supabaseAdmin
    .from("app_settings").select("admin_pin, almox_pin").eq("id", 1).maybeSingle();
  if (!data) throw new Error("Configuração ausente");
  if (pin !== data.almox_pin && pin !== data.admin_pin) {
    throw new Error("PIN do almoxarifado incorreto");
  }
}

// ---------- Oficina: verify PIN (accepts oficina PIN or admin PIN) ----------
async function verifyOficina(pin: string) {
  pinSchema.parse(pin);
  const { data } = await supabaseAdmin
    .from("app_settings").select("admin_pin, oficina_pin").eq("id", 1).maybeSingle();
  if (!data) throw new Error("Configuração ausente");
  if (pin !== (data as any).oficina_pin && pin !== data.admin_pin) {
    throw new Error("PIN da oficina incorreto");
  }
}

export const oficinaLogin = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string }) => z.object({ pin: pinSchema }).parse(d))
  .handler(async ({ data }) => {
    await verifyOficina(data.pin);
    return { ok: true };
  });

const partItemSchema = z.object({
  partName: z.string().trim().min(1).max(200),
  quantity: z.number().int().min(1).max(9999),
  code: z.string().trim().max(100).default(""),
});

export const oficinaCreateRequest = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string; requesterName: string; items: Array<{ partName: string; quantity: number; code: string }> }) =>
    z.object({
      pin: pinSchema,
      requesterName: z.string().trim().min(1).max(100),
      items: z.array(partItemSchema).min(1).max(50),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await verifyOficina(data.pin);
    const groupId = crypto.randomUUID();
    const inserts = data.items.map((item) => ({
      group_id: groupId,
      requester_name: data.requesterName,
      part_name: item.partName,
      quantity: item.quantity,
      code: item.code,
    }));
    const { error } = await supabaseAdmin.from("part_requests" as any).insert(inserts);
    if (error) throw new Error(error.message);
    return { ok: true, groupId };
  });

export const oficinaListRequests = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string }) => z.object({ pin: pinSchema }).parse(d))
  .handler(async ({ data }) => {
    await verifyOficina(data.pin);
    const { data: rows, error } = await supabaseAdmin
      .from("part_requests" as any)
      .select("id, group_id, requester_name, part_name, quantity, code, status, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    // Group by group_id
    const groups = new Map<string, any[]>();
    for (const row of (rows ?? []) as any[]) {
      const list = groups.get(row.group_id) ?? [];
      list.push(row);
      groups.set(row.group_id, list);
    }

    const requests = Array.from(groups.entries()).map(([groupId, items]) => ({
      group_id: groupId,
      requester_name: items[0].requester_name,
      created_at: items[0].created_at,
      items: items.map((i: any) => ({
        id: i.id,
        part_name: i.part_name,
        quantity: i.quantity,
        code: i.code,
        status: i.status,
      })),
    }));

    return { requests };
  });

// ---------- Almoxarifado: list/update/delete part requests from oficina ----------
export const almoxListRequests = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string }) => z.object({ pin: pinSchema }).parse(d))
  .handler(async ({ data }) => {
    await verifyAlmox(data.pin);
    const { data: rows, error } = await supabaseAdmin
      .from("part_requests" as any)
      .select("id, group_id, requester_name, part_name, quantity, code, status, created_at, original_group_id, edited_at, superseded, is_extra, note")
      .eq("superseded", false)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const groups = new Map<string, any[]>();
    for (const row of (rows ?? []) as any[]) {
      const list = groups.get(row.group_id) ?? [];
      list.push(row);
      groups.set(row.group_id, list);
    }

    const requests = Array.from(groups.entries()).map(([groupId, items]) => {
      items.sort((a: any, b: any) => Number(!!a.is_extra) - Number(!!b.is_extra));
      const base = items.find((i: any) => !i.is_extra) ?? items[0];
      return {
        group_id: groupId,
        requester_name: base.requester_name,
        created_at: base.created_at,
        original_group_id: base.original_group_id ?? null,
        edited_at: base.edited_at ?? null,
        items: items.map((i: any) => ({
          id: i.id,
          part_name: i.part_name,
          quantity: i.quantity,
          code: i.code,
          status: i.status,
          is_extra: !!i.is_extra,
          note: i.note ?? null,
        })),
      };
    });

    return { requests };
  });

// ---------- Almoxarifado: edit a request group (keeps original as history) ----------
export const almoxEditRequest = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string; groupId: string; requesterName: string; items: Array<{ partName: string; quantity: number; code: string }> }) =>
    z.object({
      pin: pinSchema,
      groupId: z.string().uuid(),
      requesterName: z.string().trim().min(1).max(100),
      items: z.array(partItemSchema).min(1).max(50),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await verifyAlmox(data.pin);
    const { data: origRows, error: origErr } = await supabaseAdmin
      .from("part_requests" as any)
      .select("id, group_id, original_group_id, created_at")
      .eq("group_id", data.groupId);
    if (origErr) throw new Error(origErr.message);
    if (!origRows || origRows.length === 0) throw new Error("Requisição não encontrada");

    const rootGroupId: string = (origRows[0] as any).original_group_id ?? data.groupId;
    const originalCreatedAt: string = (origRows[0] as any).created_at;

    const { error: supErr } = await supabaseAdmin
      .from("part_requests" as any)
      .update({ superseded: true })
      .eq("group_id", data.groupId);
    if (supErr) throw new Error(supErr.message);

    const newGroupId = crypto.randomUUID();
    const nowIso = new Date().toISOString();
    const inserts = data.items.map((item) => ({
      group_id: newGroupId,
      requester_name: data.requesterName,
      part_name: item.partName,
      quantity: item.quantity,
      code: item.code,
      original_group_id: rootGroupId,
      edited_at: nowIso,
      created_at: originalCreatedAt,
    }));
    const { error } = await supabaseAdmin.from("part_requests" as any).insert(inserts);
    if (error) throw new Error(error.message);
    return { ok: true, newGroupId };
  });

// ---------- Almoxarifado: fetch original (pre-edit) version of a request ----------
export const almoxGetOriginalRequest = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string; originalGroupId: string }) =>
    z.object({ pin: pinSchema, originalGroupId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    await verifyAlmox(data.pin);
    const { data: rows, error } = await supabaseAdmin
      .from("part_requests" as any)
      .select("id, group_id, requester_name, part_name, quantity, code, status, created_at")
      .eq("group_id", data.originalGroupId);
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) throw new Error("Versão original não encontrada");
    const items = (rows as any[]).map((i) => ({
      id: i.id, part_name: i.part_name, quantity: i.quantity, code: i.code, status: i.status,
    }));
    return {
      group_id: data.originalGroupId,
      requester_name: (rows[0] as any).requester_name,
      created_at: (rows[0] as any).created_at,
      items,
    };
  });


export const almoxUpdateGroupStatus = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string; groupId: string; status: string }) =>
    z.object({
      pin: pinSchema,
      groupId: z.string().uuid(),
      status: z.enum(["pendente", "separado", "em_falta", "entregue", "tecnico_possui"]),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await verifyAlmox(data.pin);
    const { error } = await supabaseAdmin
      .from("part_requests" as any).update({ status: data.status }).eq("group_id", data.groupId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Almoxarifado: update a single request item status ----------
export const almoxUpdateRequestItemStatus = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string; itemId: string; status: string }) =>
    z.object({
      pin: pinSchema,
      itemId: z.string().uuid(),
      status: z.enum(["pendente", "separado", "em_falta", "entregue", "tecnico_possui"]),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await verifyAlmox(data.pin);
    const { error } = await supabaseAdmin
      .from("part_requests" as any).update({ status: data.status }).eq("id", data.itemId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Almoxarifado: list upcoming schedule dates that have parts ----------
export const almoxUpcomingDates = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string; fromDate: string }) =>
    z.object({ pin: pinSchema, fromDate: dateSchema }).parse(d),
  )
  .handler(async ({ data }) => {
    await verifyAlmox(data.pin);
    const { data: schedules } = await supabaseAdmin
      .from("schedules")
      .select("id, work_date")
      .gt("work_date", data.fromDate)
      .order("work_date", { ascending: true });
    const ids = (schedules ?? []).map((s) => s.id);
    if (!ids.length) return { dates: [] as string[] };
    const { data: parts } = await supabaseAdmin
      .from("parts").select("schedule_id").in("schedule_id", ids);
    const withParts = new Set((parts ?? []).map((p: any) => p.schedule_id));
    const dates = Array.from(
      new Set((schedules ?? []).filter((s) => withParts.has(s.id)).map((s) => s.work_date as string)),
    ).sort();
    return { dates };
  });

// ---------- Almoxarifado: weekly report of missing part requests from oficina ----------
export const almoxWeeklyMissingRequests = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string; startDate: string; endDate: string }) =>
    z.object({ pin: pinSchema, startDate: dateSchema, endDate: dateSchema }).parse(d),
  )
  .handler(async ({ data }) => {
    await verifyAlmox(data.pin);

    const { data: rows, error } = await supabaseAdmin
      .from("part_requests" as any)
      .select("id, group_id, requester_name, part_name, quantity, code, status, created_at")
      .eq("status", "em_falta")
      .eq("superseded", false)
      .gte("created_at", `${data.startDate}T00:00:00Z`)
      .lte("created_at", `${data.endDate}T23:59:59Z`)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    // Group by group_id
    const groups = new Map<string, any[]>();
    for (const row of (rows ?? []) as any[]) {
      const list = groups.get(row.group_id) ?? [];
      list.push(row);
      groups.set(row.group_id, list);
    }

    const requests = Array.from(groups.entries()).map(([groupId, items]) => ({
      group_id: groupId,
      requester_name: items[0].requester_name,
      created_at: items[0].created_at,
      items: items.map((i: any) => ({
        id: i.id,
        part_name: i.part_name,
        quantity: i.quantity,
        code: i.code,
        status: i.status,
      })),
    }));

    return { startDate: data.startDate, endDate: data.endDate, requests };
  });

export const almoxDeleteGroup = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string; groupId: string }) =>
    z.object({ pin: pinSchema, groupId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    await verifyAlmox(data.pin);
    const { error } = await supabaseAdmin
      .from("part_requests" as any).delete().eq("group_id", data.groupId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string }) => z.object({ pin: pinSchema }).parse(d))
  .handler(async ({ data }) => {
    await verifyAdmin(data.pin);
    return { ok: true };
  });


// ---------- Admin: get all operators + selected date data ----------
export const adminGetDay = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string; date: string }) =>
    z.object({ pin: pinSchema, date: dateSchema }).parse(d),
  )
  .handler(async ({ data }) => {
    await verifyAdmin(data.pin);

    const { data: operators } = await supabaseAdmin
      .from("operators")
      .select("id, name, pin, position")
      .order("position", { ascending: true });

    const { data: schedules } = await supabaseAdmin
      .from("schedules")
      .select("id, operator_id, task")
      .eq("work_date", data.date);

    const scheduleIds = (schedules ?? []).map((s) => s.id);
    let parts: Array<{ id: string; schedule_id: string; name: string; quantity: number; checked: boolean }> = [];
    let tasks: Array<{ id: string; schedule_id: string; position: number; title: string; description: string }> = [];
    if (scheduleIds.length) {
      const [{ data: p }, { data: t }] = await Promise.all([
        supabaseAdmin
          .from("parts")
          .select("id, schedule_id, name, quantity, checked, position")
          .in("schedule_id", scheduleIds)
          .order("position", { ascending: true })
          .order("created_at", { ascending: true }),
        supabaseAdmin
          .from("tasks")
          .select("id, schedule_id, position, title, description")
          .in("schedule_id", scheduleIds)
          .order("position", { ascending: true })
          .order("created_at", { ascending: true }),
      ]);
      parts = (p ?? []) as any;
      tasks = (t ?? []) as any;
    }

    return { operators: operators ?? [], schedules: schedules ?? [], parts, tasks };
  });

// ---------- Almoxarifado: all parts of all operators for a given date ----------
export const almoxarifadoGetDay = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string; date: string }) =>
    z.object({ pin: pinSchema, date: dateSchema }).parse(d),
  )
  .handler(async ({ data }) => {
    await verifyAlmox(data.pin);

    const { data: operators } = await supabaseAdmin
      .from("operators")
      .select("id, name, position")
      .order("position", { ascending: true });

    const { data: schedules } = await supabaseAdmin
      .from("schedules")
      .select("id, operator_id, task")
      .eq("work_date", data.date);

    const scheduleIds = (schedules ?? []).map((s) => s.id);
    let parts: Array<{ id: string; schedule_id: string; name: string; quantity: number; checked: boolean; status: string }> = [];
    if (scheduleIds.length) {
      const { data: p } = await supabaseAdmin
        .from("parts")
        .select("id, schedule_id, name, quantity, checked, position, status")
        .in("schedule_id", scheduleIds)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
      parts = (p ?? []) as any;
    }

    const scheduleToOperator = new Map((schedules ?? []).map((s) => [s.id, s.operator_id]));
    const grouped = (operators ?? []).map((op) => ({
      operator: op,
      parts: parts
        .filter((p) => scheduleToOperator.get(p.schedule_id) === op.id)
        .map(({ id, name, quantity, checked, status }) => ({ id, name, quantity, checked, status })),
    }));

    return { date: data.date, groups: grouped };
  });

// ---------- Almoxarifado: update part status ----------
export const almoxUpdatePartStatus = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string; partId: string; status: string }) =>
    z.object({
      pin: pinSchema,
      partId: z.string().uuid(),
      status: z.enum(["pendente", "separado", "em_falta", "entregue", "tecnico_possui"]),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await verifyAlmox(data.pin);
    const { error } = await supabaseAdmin
      .from("parts").update({ status: data.status }).eq("id", data.partId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Almoxarifado: update part quantity ----------
export const almoxUpdatePartQuantity = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string; partId: string; quantity: number }) =>
    z.object({
      pin: pinSchema,
      partId: z.string().uuid(),
      quantity: z.number().int().min(1).max(9999),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await verifyAlmox(data.pin);
    const { error } = await supabaseAdmin
      .from("parts").update({ quantity: data.quantity }).eq("id", data.partId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Almoxarifado: delete part ----------
export const almoxDeletePart = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string; partId: string }) =>
    z.object({ pin: pinSchema, partId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    await verifyAlmox(data.pin);
    const { error } = await supabaseAdmin.from("parts").delete().eq("id", data.partId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Almoxarifado: weekly report of missing parts ----------
export const almoxWeeklyMissing = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string; startDate: string; endDate: string }) =>
    z.object({ pin: pinSchema, startDate: dateSchema, endDate: dateSchema }).parse(d),
  )
  .handler(async ({ data }) => {
    await verifyAlmox(data.pin);

    const { data: schedules } = await supabaseAdmin
      .from("schedules")
      .select("id, operator_id, work_date")
      .gte("work_date", data.startDate)
      .lte("work_date", data.endDate);

    const scheduleIds = (schedules ?? []).map((s) => s.id);
    if (!scheduleIds.length) {
      return { startDate: data.startDate, endDate: data.endDate, rows: [] };
    }

    const [{ data: parts }, { data: operators }] = await Promise.all([
      supabaseAdmin
        .from("parts")
        .select("id, schedule_id, name, quantity, status")
        .in("schedule_id", scheduleIds)
        .eq("status", "em_falta"),
      supabaseAdmin.from("operators").select("id, name, position"),
    ]);

    const opMap = new Map((operators ?? []).map((o) => [o.id, o]));
    const schedMap = new Map(
      (schedules ?? []).map((s) => [s.id, { operator_id: s.operator_id, work_date: s.work_date }]),
    );

    const rows = (parts ?? []).map((p) => {
      const sch = schedMap.get(p.schedule_id);
      const op = sch ? opMap.get(sch.operator_id) : undefined;
      return {
        date: sch?.work_date ?? "",
        operatorName: op?.name ?? "—",
        operatorPosition: op?.position ?? 0,
        name: p.name,
        quantity: p.quantity,
      };
    });

    rows.sort((a, b) =>
      a.date.localeCompare(b.date) ||
      a.operatorPosition - b.operatorPosition ||
      a.name.localeCompare(b.name),
    );

    return { startDate: data.startDate, endDate: data.endDate, rows };
  });


// ---------- Admin: change almoxarifado PIN ----------
export const adminChangeAlmoxPin = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string; newPin: string }) =>
    z.object({ pin: pinSchema, newPin: pinSchema }).parse(d),
  )
  .handler(async ({ data }) => {
    await verifyAdmin(data.pin);
    const { error } = await supabaseAdmin
      .from("app_settings").update({ almox_pin: data.newPin }).eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


// ---------- Admin: save task (upsert schedule) ----------
export const adminSaveTask = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string; operatorId: string; date: string; task: string }) =>
    z.object({
      pin: pinSchema,
      operatorId: z.string().uuid(),
      date: dateSchema,
      task: z.string().max(2000),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await verifyAdmin(data.pin);
    const { data: existing } = await supabaseAdmin
      .from("schedules")
      .select("id")
      .eq("operator_id", data.operatorId)
      .eq("work_date", data.date)
      .maybeSingle();

    if (existing) {
      const { error } = await supabaseAdmin
        .from("schedules").update({ task: data.task }).eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { id: existing.id };
    }
    const { data: ins, error } = await supabaseAdmin
      .from("schedules")
      .insert({ operator_id: data.operatorId, work_date: data.date, task: data.task })
      .select("id").single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });

// ---------- Admin: add part ----------
export const adminAddPart = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string; operatorId: string; date: string; name: string; quantity: number }) =>
    z.object({
      pin: pinSchema,
      operatorId: z.string().uuid(),
      date: dateSchema,
      name: z.string().trim().min(1).max(200),
      quantity: z.number().int().min(1).max(9999),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await verifyAdmin(data.pin);
    // Ensure schedule exists
    let scheduleId: string;
    const { data: existing } = await supabaseAdmin
      .from("schedules").select("id")
      .eq("operator_id", data.operatorId).eq("work_date", data.date).maybeSingle();
    if (existing) scheduleId = existing.id;
    else {
      const { data: ins, error } = await supabaseAdmin
        .from("schedules")
        .insert({ operator_id: data.operatorId, work_date: data.date, task: "" })
        .select("id").single();
      if (error) throw new Error(error.message);
      scheduleId = ins.id;
    }

    const { data: max } = await supabaseAdmin
      .from("parts").select("position").eq("schedule_id", scheduleId)
      .order("position", { ascending: false }).limit(1).maybeSingle();
    const nextPos = (max?.position ?? 0) + 1;

    const { error } = await supabaseAdmin.from("parts").insert({
      schedule_id: scheduleId,
      name: data.name,
      quantity: data.quantity,
      position: nextPos,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Admin: edit part (name + quantity) ----------
export const adminEditPart = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string; partId: string; name: string; quantity: number }) =>
    z.object({
      pin: pinSchema,
      partId: z.string().uuid(),
      name: z.string().trim().min(1).max(200),
      quantity: z.number().int().min(1).max(9999),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await verifyAdmin(data.pin);
    const { error } = await supabaseAdmin
      .from("parts")
      .update({ name: data.name, quantity: data.quantity })
      .eq("id", data.partId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Admin: delete part ----------
export const adminDeletePart = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string; partId: string }) =>
    z.object({ pin: pinSchema, partId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    await verifyAdmin(data.pin);
    const { error } = await supabaseAdmin.from("parts").delete().eq("id", data.partId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Admin: update operator name/pin ----------
export const adminUpdateOperator = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string; operatorId: string; name: string; newPin: string }) =>
    z.object({
      pin: pinSchema,
      operatorId: z.string().uuid(),
      name: z.string().trim().min(1).max(60),
      newPin: pinSchema,
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await verifyAdmin(data.pin);
    const { error } = await supabaseAdmin
      .from("operators")
      .update({ name: data.name, pin: data.newPin })
      .eq("id", data.operatorId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Admin: change admin PIN ----------
export const adminChangePin = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string; newPin: string }) =>
    z.object({ pin: pinSchema, newPin: pinSchema }).parse(d),
  )
  .handler(async ({ data }) => {
    await verifyAdmin(data.pin);
    const { error } = await supabaseAdmin
      .from("app_settings").update({ admin_pin: data.newPin }).eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Admin: ensure schedule exists, returns schedule id ----------
async function ensureSchedule(operatorId: string, date: string): Promise<string> {
  const { data: existing } = await supabaseAdmin
    .from("schedules").select("id")
    .eq("operator_id", operatorId).eq("work_date", date).maybeSingle();
  if (existing) return existing.id;
  const { data: ins, error } = await supabaseAdmin
    .from("schedules")
    .insert({ operator_id: operatorId, work_date: date, task: "" })
    .select("id").single();
  if (error) throw new Error(error.message);
  return ins.id;
}

// ---------- Admin: add task (atendimento) ----------
export const adminAddTask = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string; operatorId: string; date: string; title: string; description: string }) =>
    z.object({
      pin: pinSchema,
      operatorId: z.string().uuid(),
      date: dateSchema,
      title: z.string().trim().min(1).max(200),
      description: z.string().max(2000).default(""),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await verifyAdmin(data.pin);
    const scheduleId = await ensureSchedule(data.operatorId, data.date);
    const { data: max } = await supabaseAdmin
      .from("tasks").select("position").eq("schedule_id", scheduleId)
      .order("position", { ascending: false }).limit(1).maybeSingle();
    const nextPos = (max?.position ?? 0) + 1;
    const { error } = await supabaseAdmin.from("tasks").insert({
      schedule_id: scheduleId,
      title: data.title,
      description: data.description,
      position: nextPos,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Admin: edit task ----------
export const adminEditTask = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string; taskId: string; title: string; description: string }) =>
    z.object({
      pin: pinSchema,
      taskId: z.string().uuid(),
      title: z.string().trim().min(1).max(200),
      description: z.string().max(2000),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await verifyAdmin(data.pin);
    const { error } = await supabaseAdmin
      .from("tasks")
      .update({ title: data.title, description: data.description })
      .eq("id", data.taskId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Admin: delete task ----------
export const adminDeleteTask = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string; taskId: string }) =>
    z.object({ pin: pinSchema, taskId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    await verifyAdmin(data.pin);
    const { error } = await supabaseAdmin.from("tasks").delete().eq("id", data.taskId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Admin: move task up/down ----------
export const adminMoveTask = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string; taskId: string; direction: "up" | "down" }) =>
    z.object({
      pin: pinSchema,
      taskId: z.string().uuid(),
      direction: z.enum(["up", "down"]),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await verifyAdmin(data.pin);
    const { data: current } = await supabaseAdmin
      .from("tasks").select("id, schedule_id, position").eq("id", data.taskId).maybeSingle();
    if (!current) throw new Error("Atendimento não encontrado");

    const { data: siblings } = await supabaseAdmin
      .from("tasks")
      .select("id, position")
      .eq("schedule_id", current.schedule_id)
      .order("position", { ascending: true });
    if (!siblings) return { ok: true };

    const idx = siblings.findIndex((s) => s.id === current.id);
    const swapIdx = data.direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= siblings.length) return { ok: true };

    const other = siblings[swapIdx];
    // Swap via a temporary value to avoid unique-ish collisions if any.
    await supabaseAdmin.from("tasks").update({ position: -1 }).eq("id", current.id);
    await supabaseAdmin.from("tasks").update({ position: current.position }).eq("id", other.id);
    await supabaseAdmin.from("tasks").update({ position: other.position }).eq("id", current.id);
    return { ok: true };
  });

// ---------- Admin: pending calls (no technician assigned) ----------
export const adminListPendingCalls = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string; startDate: string; endDate: string }) =>
    z.object({ pin: pinSchema, startDate: dateSchema, endDate: dateSchema }).parse(d),
  )
  .handler(async ({ data }) => {
    await verifyAdmin(data.pin);
    const { data: calls, error } = await supabaseAdmin
      .from("pending_calls")
      .select("id, call_date, company, description, priority, status, created_at")
      .gte("call_date", data.startDate)
      .lte("call_date", data.endDate)
      .order("call_date", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { calls: calls ?? [] };
  });

export const adminUpdatePendingCallStatus = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string; callId: string; status: string }) =>
    z.object({
      pin: pinSchema,
      callId: z.string().uuid(),
      status: z.enum(["pendente", "atendido", "nao_atendido"]),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await verifyAdmin(data.pin);
    const { error } = await supabaseAdmin
      .from("pending_calls").update({ status: data.status }).eq("id", data.callId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminAddPendingCall = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string; callDate: string; company: string; description: string; priority: string }) =>
    z.object({
      pin: pinSchema,
      callDate: dateSchema,
      company: z.string().trim().min(1).max(200),
      description: z.string().trim().max(1000).default(""),
      priority: z.enum(["baixa", "normal", "alta", "urgente"]),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await verifyAdmin(data.pin);
    const { error } = await supabaseAdmin.from("pending_calls").insert({
      call_date: data.callDate,
      company: data.company,
      description: data.description,
      priority: data.priority,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeletePendingCall = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string; callId: string }) =>
    z.object({ pin: pinSchema, callId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    await verifyAdmin(data.pin);
    const { error } = await supabaseAdmin.from("pending_calls").delete().eq("id", data.callId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Admin: attended calls (agenda) ----------
export const adminListAttendedCalls = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string; date: string }) =>
    z.object({ pin: pinSchema, date: dateSchema }).parse(d),
  )
  .handler(async ({ data }) => {
    await verifyAdmin(data.pin);
    const { data: rows, error } = await supabaseAdmin
      .from("attended_calls" as any)
      .select("id, call_date, call_time, company, description, technician, created_at")
      .eq("call_date", data.date)
      .order("call_time", { ascending: true, nullsFirst: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { calls: (rows ?? []) as any[] };
  });

export const adminAddAttendedCall = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string; callDate: string; callTime: string; company: string; description: string; technician: string }) =>
    z.object({
      pin: pinSchema,
      callDate: dateSchema,
      callTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).or(z.literal("")),
      company: z.string().trim().min(1).max(200),
      description: z.string().trim().max(2000).default(""),
      technician: z.string().trim().max(100).default(""),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await verifyAdmin(data.pin);
    const { error } = await supabaseAdmin.from("attended_calls" as any).insert({
      call_date: data.callDate,
      call_time: data.callTime ? data.callTime : null,
      company: data.company,
      description: data.description,
      technician: data.technician,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUpdateAttendedCall = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string; callId: string; callTime: string; company: string; description: string; technician: string }) =>
    z.object({
      pin: pinSchema,
      callId: z.string().uuid(),
      callTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).or(z.literal("")),
      company: z.string().trim().min(1).max(200),
      description: z.string().trim().max(2000).default(""),
      technician: z.string().trim().max(100).default(""),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await verifyAdmin(data.pin);
    const { error } = await supabaseAdmin.from("attended_calls" as any).update({
      call_time: data.callTime ? data.callTime : null,
      company: data.company,
      description: data.description,
      technician: data.technician,
    }).eq("id", data.callId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteAttendedCall = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string; callId: string }) =>
    z.object({ pin: pinSchema, callId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    await verifyAdmin(data.pin);
    const { error } = await supabaseAdmin.from("attended_calls" as any).delete().eq("id", data.callId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// Oficina: Peças e Ferramentas (workshop_items)
// ============================================================
const workshopStatusSchema = z.enum([
  "aguardando_orcamento",
  "orcamento_aguardando_aprovacao",
  "aprovado",
]);

export const oficinaListWorkshopItems = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string }) => z.object({ pin: pinSchema }).parse(d))
  .handler(async ({ data }) => {
    await verifyOficina(data.pin);
    const { data: rows, error } = await supabaseAdmin
      .from("workshop_items" as any)
      .select("id, name, supplier, status, deadline_days, approved_at, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { items: rows ?? [] };
  });

export const oficinaCreateWorkshopItem = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string }) => z.object({ pin: pinSchema }).parse(d))
  .handler(async ({ data }) => {
    await verifyOficina(data.pin);
    const { data: row, error } = await supabaseAdmin
      .from("workshop_items" as any)
      .insert({})
      .select("id, name, supplier, status, deadline_days, approved_at, created_at")
      .single();
    if (error) throw new Error(error.message);
    return { item: row };
  });

export const oficinaUpdateWorkshopItem = createServerFn({ method: "POST" })
  .inputValidator((d: {
    pin: string;
    itemId: string;
    name?: string;
    supplier?: string;
    status?: string;
    deadlineDays?: number;
  }) =>
    z.object({
      pin: pinSchema,
      itemId: z.string().uuid(),
      name: z.string().trim().max(200).optional(),
      supplier: z.string().trim().max(200).optional(),
      status: workshopStatusSchema.optional(),
      deadlineDays: z.number().int().min(0).max(3650).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await verifyOficina(data.pin);
    const patch: Record<string, any> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.supplier !== undefined) patch.supplier = data.supplier;
    if (data.deadlineDays !== undefined) patch.deadline_days = data.deadlineDays;
    if (data.status !== undefined) {
      patch.status = data.status;
      // Set approved_at when transitioning to aprovado; clear otherwise
      const { data: current } = await supabaseAdmin
        .from("workshop_items" as any)
        .select("status, approved_at")
        .eq("id", data.itemId)
        .maybeSingle();
      const currentStatus = (current as any)?.status;
      const currentApprovedAt = (current as any)?.approved_at;
      if (data.status === "aprovado" && currentStatus !== "aprovado") {
        patch.approved_at = new Date().toISOString();
      } else if (data.status !== "aprovado" && currentApprovedAt) {
        patch.approved_at = null;
      }
    }
    const { error } = await supabaseAdmin
      .from("workshop_items" as any)
      .update(patch)
      .eq("id", data.itemId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const oficinaDeleteWorkshopItem = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string; itemId: string }) =>
    z.object({ pin: pinSchema, itemId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    await verifyOficina(data.pin);
    const { error } = await supabaseAdmin
      .from("workshop_items" as any)
      .delete()
      .eq("id", data.itemId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// Oficina: Saída para Técnicos (tool_loans)
// ============================================================
export const oficinaListToolLoans = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string }) => z.object({ pin: pinSchema }).parse(d))
  .handler(async ({ data }) => {
    await verifyOficina(data.pin);
    const { data: rows, error } = await supabaseAdmin
      .from("tool_loans" as any)
      .select("id, tool_name, technician_name, checkout_date, returned_at, created_at")
      .is("returned_at", null)
      .order("checkout_date", { ascending: true });
    if (error) throw new Error(error.message);
    return { loans: rows ?? [] };
  });

export const oficinaCreateToolLoan = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string }) => z.object({ pin: pinSchema }).parse(d))
  .handler(async ({ data }) => {
    await verifyOficina(data.pin);
    const { data: row, error } = await supabaseAdmin
      .from("tool_loans" as any)
      .insert({})
      .select("id, tool_name, technician_name, checkout_date, returned_at, created_at")
      .single();
    if (error) throw new Error(error.message);
    return { loan: row };
  });

export const oficinaUpdateToolLoan = createServerFn({ method: "POST" })
  .inputValidator((d: {
    pin: string;
    loanId: string;
    toolName?: string;
    technicianName?: string;
    checkoutDate?: string;
  }) =>
    z.object({
      pin: pinSchema,
      loanId: z.string().uuid(),
      toolName: z.string().trim().max(200).optional(),
      technicianName: z.string().trim().max(200).optional(),
      checkoutDate: dateSchema.optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await verifyOficina(data.pin);
    const patch: Record<string, any> = {};
    if (data.toolName !== undefined) patch.tool_name = data.toolName;
    if (data.technicianName !== undefined) patch.technician_name = data.technicianName;
    if (data.checkoutDate !== undefined) patch.checkout_date = data.checkoutDate;
    const { error } = await supabaseAdmin
      .from("tool_loans" as any)
      .update(patch)
      .eq("id", data.loanId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const oficinaReturnToolLoan = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string; loanId: string }) =>
    z.object({ pin: pinSchema, loanId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    await verifyOficina(data.pin);
    const { error } = await supabaseAdmin
      .from("tool_loans" as any)
      .update({ returned_at: new Date().toISOString() })
      .eq("id", data.loanId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const oficinaDeleteToolLoan = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string; loanId: string }) =>
    z.object({ pin: pinSchema, loanId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    await verifyOficina(data.pin);
    const { error } = await supabaseAdmin
      .from("tool_loans" as any)
      .delete()
      .eq("id", data.loanId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Admin: maintenance returns ----------
export const adminListMaintenanceReturns = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string }) => z.object({ pin: pinSchema }).parse(d))
  .handler(async ({ data }) => {
    await verifyAdmin(data.pin);
    const { data: rows, error } = await supabaseAdmin
      .from("maintenance_returns" as any)
      .select("id, client_name, description, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { returns: ((rows ?? []) as unknown) as Array<{ id: string; client_name: string; description: string; created_at: string }> };
  });

export const adminAddMaintenanceReturn = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string; clientName: string; description: string }) =>
    z.object({
      pin: pinSchema,
      clientName: z.string().trim().min(1).max(200),
      description: z.string().trim().max(2000).default(""),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await verifyAdmin(data.pin);
    const { error } = await supabaseAdmin.from("maintenance_returns" as any).insert({
      client_name: data.clientName,
      description: data.description,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUpdateMaintenanceReturn = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string; id: string; clientName: string; description: string }) =>
    z.object({
      pin: pinSchema,
      id: z.string().uuid(),
      clientName: z.string().trim().min(1).max(200),
      description: z.string().trim().max(2000).default(""),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await verifyAdmin(data.pin);
    const { error } = await supabaseAdmin
      .from("maintenance_returns" as any)
      .update({ client_name: data.clientName, description: data.description })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteMaintenanceReturn = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string; id: string }) =>
    z.object({ pin: pinSchema, id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    await verifyAdmin(data.pin);
    const { error } = await supabaseAdmin
      .from("maintenance_returns" as any)
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
