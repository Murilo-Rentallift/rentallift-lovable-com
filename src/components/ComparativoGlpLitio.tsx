import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Plus,
  Trash2,
  Fuel,
  BatteryCharging,
  TrendingUp,
  Lock,
  Flame,
  Zap,
  Copy,
  RotateCcw,
} from "lucide-react";

import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const KWH_CARGA_COMPLETA = 9.6; // constante fixa

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const num = (v: string) => {
  const n = parseFloat(String(v).replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? 0 : n;
};

type Setor = { id: number; nome: string; maquinas: string; botijoesDia: string };

function useAnimatedNumber(value: number, duration = 700) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (value - from) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
      else fromRef.current = value;
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      fromRef.current = display;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return display;
}

function ReadOnlyStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border/70 bg-muted/40 px-3 py-2 backdrop-blur transition-colors">
      <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
        <Lock className="h-3 w-3" /> {label}
      </div>
      <div className="mt-0.5 font-mono text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

const emptySetor = (): Setor => ({ id: Date.now(), nome: "", maquinas: "", botijoesDia: "" });

export function ComparativoGlpLitio() {
  // Inputs gerais (iniciam vazios por segurança comercial)
  const [custoBotijao, setCustoBotijao] = useState("");
  const [locacaoGlp, setLocacaoGlp] = useState("");
  const [locacaoLitio, setLocacaoLitio] = useState("");
  const [valorKwh, setValorKwh] = useState("");
  const [horasDia, setHorasDia] = useState("");
  const [diasUteis, setDiasUteis] = useState("");
  const [horasPorCarga, setHorasPorCarga] = useState("");

  const [setores, setSetores] = useState<Setor[]>([
    { id: 1, nome: "", maquinas: "", botijoesDia: "" },
  ]);

  const preenchido = (v: string) => v.trim() !== "";
  const ready =
    [custoBotijao, locacaoGlp, locacaoLitio, valorKwh, horasDia, diasUteis, horasPorCarga].every(
      preenchido,
    ) && setores.every((s) => preenchido(s.maquinas) && preenchido(s.botijoesDia));

  const limparTudo = () => {
    setCustoBotijao("");
    setLocacaoGlp("");
    setLocacaoLitio("");
    setValorKwh("");
    setHorasDia("");
    setDiasUteis("");
    setHorasPorCarga("");
    setSetores([emptySetor()]);
    toast.success("Campos limpos");
  };


  const calc = useMemo(() => {
    const cBotijao = num(custoBotijao);
    const locGlp = num(locacaoGlp);
    const locLitio = num(locacaoLitio);
    const kwh = num(valorKwh);
    const hDia = num(horasDia);
    const dias = num(diasUteis);
    const hCarga = num(horasPorCarga);

    const consumoCargaCompleta = kwh * KWH_CARGA_COMPLETA;
    const custoHoraGlp = hCarga ? cBotijao / hCarga : 0;
    const custoHoraLitio = hCarga ? consumoCargaCompleta / hCarga : 0;
    const custoDiaGlp = custoHoraGlp * hDia;
    const custoDiaLitio = custoHoraLitio * hDia;
    const custoMesGlp = custoDiaGlp * dias;
    const custoMesLitio = custoDiaLitio * dias;

    const linhas = setores.map((s) => {
      const qtd = num(s.maquinas);
      const botDia = num(s.botijoesDia);
      const botijoesMes = botDia * dias * qtd;
      const custoGlpMes = botijoesMes * cBotijao;
      const totalGlp = locGlp * qtd + custoGlpMes;
      const custoCargaMes = qtd * custoMesLitio;
      const totalLitio = qtd * locLitio + custoCargaMes;
      return {
        setor: s,
        qtd,
        botijoesMes,
        custoGlpMes,
        totalGlp,
        custoCargaMes,
        totalLitio,
        economia: totalGlp - totalLitio,
      };
    });

    const economiaMensal = linhas.reduce((a, l) => a + l.economia, 0);
    const totalGlpGeral = linhas.reduce((a, l) => a + l.totalGlp, 0);
    const totalLitioGeral = linhas.reduce((a, l) => a + l.totalLitio, 0);

    return {
      consumoCargaCompleta,
      custoHoraGlp,
      custoHoraLitio,
      custoDiaGlp,
      custoDiaLitio,
      custoMesGlp,
      custoMesLitio,
      linhas,
      economiaMensal,
      economiaAnual: economiaMensal * 12,
      totalGlpGeral,
      totalLitioGeral,
    };
  }, [custoBotijao, locacaoGlp, locacaoLitio, valorKwh, horasDia, diasUteis, horasPorCarga, setores]);

  const mensalAnim = useAnimatedNumber(calc.economiaMensal);
  const glpAnim = useAnimatedNumber(calc.totalGlpGeral);
  const litioAnim = useAnimatedNumber(calc.totalLitioGeral);
  const anualAnim = useAnimatedNumber(calc.economiaAnual);

  const addSetor = () => setSetores((s) => [...s, emptySetor()]);
  const fmt = (n: number) => (ready ? brl(n) : "—");
  const fmtNum = (n: number) => (ready ? n.toLocaleString("pt-BR") : "—");

  const removeSetor = (id: number) =>
    setSetores((s) => (s.length > 1 ? s.filter((x) => x.id !== id) : s));
  const updSetor = (id: number, k: keyof Setor, v: string) =>
    setSetores((s) => s.map((x) => (x.id === id ? { ...x, [k]: v } : x)));

  const chartGeral = [
    { nome: "Geral", GLP: Math.round(calc.totalGlpGeral), "Lítio": Math.round(calc.totalLitioGeral) },
  ];
  const chartSetores = calc.linhas.map((l, i) => ({
    nome: l.setor.nome.trim() || `Setor ${i + 1}`,
    GLP: Math.round(l.totalGlp),
    "Lítio": Math.round(l.totalLitio),
  }));

  const copiarResumo = async () => {
    if (!ready) {
      toast.error("Preencha todos os campos para gerar o resumo");
      return;
    }
    const linhasTxt = calc.linhas.map((l, i) => {
      const nome = l.setor.nome.trim() || `Setor ${i + 1}`;
      return `• ${nome}: ${l.qtd} máquina(s) | GLP ${brl(l.totalGlp)}/mês | Lítio ${brl(l.totalLitio)}/mês | Economia ${brl(l.economia)}/mês`;
    });

    const txt = [
      "COMPARATIVO DE CUSTOS — EMPILHADEIRA GLP x LÍTIO",
      "",
      "Parâmetros utilizados:",
      `- Custo do botijão GLP: ${brl(num(custoBotijao))}`,
      `- Locação mensal GLP: ${brl(num(locacaoGlp))}`,
      `- Locação mensal Lítio: ${brl(num(locacaoLitio))}`,
      `- Valor do KW/h: ${brl(num(valorKwh))}`,
      `- Horas de uso por dia: ${num(horasDia)}`,
      `- Dias úteis no mês: ${num(diasUteis)}`,
      `- Horas por carga: ${num(horasPorCarga)} | Carga completa lítio: ${KWH_CARGA_COMPLETA} kWh`,
      "",
      "Por setor:",
      ...linhasTxt,
      "",
      `CUSTO MENSAL TOTAL GLP: ${brl(calc.totalGlpGeral)}`,
      `CUSTO MENSAL TOTAL LÍTIO: ${brl(calc.totalLitioGeral)}`,
      `ECONOMIA MENSAL: ${brl(calc.economiaMensal)}`,
      `ECONOMIA ANUAL: ${brl(calc.economiaAnual)}`,
      "",
      "Rental Lift",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(txt);
      toast.success("Resumo copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {ready
            ? "Cálculo atualizado com os dados deste cliente."
            : "Preencha os campos para calcular."}
        </p>
        <Button variant="outline" size="sm" onClick={limparTudo}>
          <RotateCcw className="h-4 w-4" /> Limpar tudo / Novo orçamento
        </Button>
      </div>

      {/* Destaques */}
      <div className={`grid grid-cols-1 gap-4 md:grid-cols-2 ${ready ? "" : "opacity-60"}`}>
        <div className="relative overflow-hidden rounded-2xl border border-destructive/40 bg-card/60 p-5 backdrop-blur transition-all duration-300 hover:-translate-y-0.5">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-destructive/20 blur-3xl" />
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <Flame className="h-4 w-4 text-destructive" /> Custo mensal GLP
          </div>
          <div className="mt-2 font-mono text-3xl font-bold tabular-nums text-destructive">
            {ready ? brl(glpAnim) : "—"}
          </div>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-primary/40 bg-card/60 p-5 backdrop-blur transition-all duration-300 hover:-translate-y-0.5">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/20 blur-3xl" />
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <Zap className="h-4 w-4 text-primary" /> Custo mensal Lítio
          </div>
          <div className="mt-2 font-mono text-3xl font-bold tabular-nums text-primary">
            {ready ? brl(litioAnim) : "—"}
          </div>
        </div>
      </div>

      <div
        className={`relative overflow-hidden rounded-2xl border border-primary/50 bg-card/60 p-8 text-center backdrop-blur transition-all duration-300 ${ready ? "hover:shadow-[0_0_60px_-14px_var(--primary)]" : "opacity-60"}`}
      >
        <div className="absolute -left-16 -top-16 h-48 w-48 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -right-16 -bottom-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
        <div className="flex items-center justify-center gap-2 text-xs uppercase tracking-[0.25em] text-muted-foreground">
          <TrendingUp className="h-4 w-4 text-primary" /> Economia mensal
        </div>
        <div className="mt-3 font-mono text-5xl font-extrabold tabular-nums text-primary md:text-6xl">
          {ready ? brl(mensalAnim) : "—"}
        </div>
        {!ready && (
          <div className="mt-2 text-xs text-muted-foreground">
            Preencha os parâmetros e os setores para calcular
          </div>
        )}
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/50 px-4 py-1.5 backdrop-blur">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Economia anual</span>
          <span className="font-mono text-sm font-bold tabular-nums text-primary">
            {ready ? brl(anualAnim) : "—"}
          </span>
        </div>
        <div className="mt-5">
          <Button variant="outline" size="sm" onClick={copiarResumo} disabled={!ready}>
            <Copy className="h-4 w-4" /> Copiar resumo
          </Button>
        </div>
      </div>



      {/* Parâmetros */}
      <Card className="border-border/60 bg-card/60 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-base">Parâmetros gerais (editáveis)</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Custo do botijão GLP (R$)</Label>
            <Input value={custoBotijao} onChange={(e) => setCustoBotijao(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Locação mensal GLP (R$)</Label>
            <Input value={locacaoGlp} onChange={(e) => setLocacaoGlp(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Locação mensal Lítio (R$)</Label>
            <Input value={locacaoLitio} onChange={(e) => setLocacaoLitio(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Valor do KW/h (R$)</Label>
            <Input value={valorKwh} onChange={(e) => setValorKwh(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Horas de uso por dia</Label>
            <Input value={horasDia} onChange={(e) => setHorasDia(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Dias úteis no mês</Label>
            <Input value={diasUteis} onChange={(e) => setDiasUteis(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Horas por carga (GLP e Lítio)</Label>
            <Input value={horasPorCarga} onChange={(e) => setHorasPorCarga(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <ReadOnlyStat
              label="Consumo de uma carga completa (lítio) — fixo"
              value={`${KWH_CARGA_COMPLETA.toLocaleString("pt-BR")} kWh`}
            />
          </div>
        </CardContent>
      </Card>

      {/* Intermediários */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="border-border/60 bg-card/60 backdrop-blur">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Fuel className="h-4 w-4" /> GLP — cálculos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <ReadOnlyStat label="Custo hora trabalho" value={brl(calc.custoHoraGlp)} />
            <ReadOnlyStat label="Custo dia trabalho" value={brl(calc.custoDiaGlp)} />
            <ReadOnlyStat label="Custo mês por máquina (combustível)" value={brl(calc.custoMesGlp)} />
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/60 backdrop-blur">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <BatteryCharging className="h-4 w-4" /> Lítio — cálculos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <ReadOnlyStat label="Consumo carga completa (R$)" value={brl(calc.consumoCargaCompleta)} />
            <ReadOnlyStat label="Custo hora trabalho" value={brl(calc.custoHoraLitio)} />
            <ReadOnlyStat label="Custo dia trabalho" value={brl(calc.custoDiaLitio)} />
            <ReadOnlyStat label="Custo mês por máquina (energia)" value={brl(calc.custoMesLitio)} />
          </CardContent>
        </Card>
      </div>

      {/* Setores */}
      <Card className="border-border/60 bg-card/60 backdrop-blur">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Setores</CardTitle>
          <Button size="sm" variant="outline" onClick={addSetor}>
            <Plus className="h-4 w-4" /> Setor
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {calc.linhas.map((l, i) => (
            <div
              key={l.setor.id}
              className="rounded-xl border border-border/60 bg-background/40 p-4 backdrop-blur transition-all duration-200"
            >
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold">
                  {l.setor.nome.trim() || `Setor ${i + 1}`}
                </h4>
                {calc.linhas.length > 1 && (
                  <Button size="icon" variant="ghost" onClick={() => removeSetor(l.setor.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Nome do setor</Label>
                  <Input
                    value={l.setor.nome}
                    onChange={(e) => updSetor(l.setor.id, "nome", e.target.value)}
                    placeholder="Ex: Armazém"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Qtd. de máquinas</Label>
                  <Input
                    value={l.setor.maquinas}
                    onChange={(e) => updSetor(l.setor.id, "maquinas", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Botijões GLP/dia por máquina</Label>
                  <Input
                    value={l.setor.botijoesDia}
                    onChange={(e) => updSetor(l.setor.id, "botijoesDia", e.target.value)}
                  />
                </div>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
                <ReadOnlyStat label="Botijões GLP / mês" value={l.botijoesMes.toLocaleString("pt-BR")} />
                <ReadOnlyStat label="Custo GLP no mês (combustível)" value={brl(l.custoGlpMes)} />
                <ReadOnlyStat label="Total GLP (locação + comb.)" value={brl(l.totalGlp)} />
                <ReadOnlyStat label="Custo carga bateria no mês" value={brl(l.custoCargaMes)} />
                <ReadOnlyStat label="Total Lítio (locação + energia)" value={brl(l.totalLitio)} />
                <div className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Economia mensal do setor
                  </div>
                  <div className="mt-0.5 font-mono text-sm font-bold tabular-nums text-primary">
                    {brl(l.economia)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Gráficos */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border-border/60 bg-card/60 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Custo mensal total — geral</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartGeral}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="nome" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip
                  formatter={(v: number) => brl(v)}
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                  }}
                />
                <Legend />
                <Bar dataKey="GLP" fill="var(--destructive)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Lítio" fill="var(--primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/60 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Custo mensal total — por setor</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartSetores}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="nome" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip
                  formatter={(v: number) => brl(v)}
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                  }}
                />
                <Legend />
                <Bar dataKey="GLP" fill="var(--destructive)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Lítio" fill="var(--primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
