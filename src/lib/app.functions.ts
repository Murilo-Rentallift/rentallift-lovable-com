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
      status: z.enum(["pendente", "separado", "em_falta", "entregue"]),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await verifyAlmox(data.pin);
    const { error } = await supabaseAdmin
      .from("parts").update({ status: data.status }).eq("id", data.partId);
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
