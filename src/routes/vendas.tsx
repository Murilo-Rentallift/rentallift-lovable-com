import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { generateProposal, type ProposalInput, type EquipDesc } from "@/lib/proposal.functions";
import { reaisPorExtenso, parseBR, formatBR } from "@/lib/numberToWords";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, FileDown, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/vendas")({
  head: () => ({
    meta: [{ title: "Vendas — Gerador de Propostas" }],
  }),
  component: VendasPage,
});

const today = () => {
  const meses = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
  ];
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
};

const emptyEquip = (): EquipDesc => ({
  tipo: "",
  combustivel: "",
  capacidade: "",
  tipoTorre: "",
  alturaFechada: "",
  alturaAberta: "",
  acessorioTorre: "",
  garfos: "",
  tipoPneus: "",
  itensSeguranca: "",
  quantidade: "",
});

function VendasPage() {
  const gen = useServerFn(generateProposal);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<ProposalInput>({
    data: today(),
    cliente: "",
    responsavel: "",
    equipamentos: [emptyEquip()],
    itensValor: [],
    valorTotalMensal: "0,00",
    valorTotalExtenso: "zero real",
    prazoEntrega: "",
    periodoContrato: "",
    condicoesPagamento: "",
    validadeProposta: "",
    custoFrete: "",
  });

  const set = <K extends keyof ProposalInput>(k: K, v: ProposalInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const updateEquip = (i: number, k: keyof EquipDesc, v: string) =>
    setForm((f) => ({
      ...f,
      equipamentos: f.equipamentos.map((e, idx) => (idx === i ? { ...e, [k]: v } : e)),
    }));
  const addEquip = () =>
    setForm((f) => ({ ...f, equipamentos: [...f.equipamentos, emptyEquip()] }));
  const removeEquip = (i: number) =>
    setForm((f) => ({
      ...f,
      equipamentos: f.equipamentos.length > 1 ? f.equipamentos.filter((_, idx) => idx !== i) : f.equipamentos,
    }));

  const updateItem = (i: number, field: keyof ProposalInput["itensValor"][number], val: string) =>
    setForm((f) => ({
      ...f,
      itensValor: f.itensValor.map((it, idx) => {
        if (idx !== i) return it;
        const next = { ...it, [field]: val };
        // Auto-calc valorTotal when quant or valorUnitario change
        if (field === "quant" || field === "valorUnitario") {
          const q = parseBR(field === "quant" ? val : next.quant);
          const u = parseBR(field === "valorUnitario" ? val : next.valorUnitario);
          if (q > 0 && u > 0) next.valorTotal = formatBR(q * u);
        }
        return next;
      }),
    }));
  const addItem = () =>
    setForm((f) => ({
      ...f,
      itensValor: [...f.itensValor, { quant: "", equipamento: "", valorUnitario: "", valorTotal: "" }],
    }));
  const removeItem = (i: number) =>
    setForm((f) => ({ ...f, itensValor: f.itensValor.filter((_, idx) => idx !== i) }));

  // Auto sum total mensal + extenso
  useEffect(() => {
    const soma = form.itensValor.reduce((acc, it) => acc + parseBR(it.valorTotal), 0);
    const totalStr = formatBR(soma);
    const extenso = reaisPorExtenso(soma);
    setForm((f) =>
      f.valorTotalMensal === totalStr && f.valorTotalExtenso === extenso
        ? f
        : { ...f, valorTotalMensal: totalStr, valorTotalExtenso: extenso },
    );
  }, [form.itensValor]);

  const handleGenerate = async () => {
    if (!form.cliente.trim()) {
      toast.error("Informe o nome do cliente");
      return;
    }
    setLoading(true);
    try {
      const res = await gen({ data: form });
      const bin = atob(res.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Proposta gerada");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao gerar proposta");
    } finally {
      setLoading(false);
    }
  };

  const eqFields: Array<[keyof EquipDesc, string]> = [
    ["tipo", "TIPO"],
    ["combustivel", "COMBUSTÍVEL"],
    ["capacidade", "CAPACIDADE"],
    ["tipoTorre", "TIPO TORRE"],
    ["alturaFechada", "ALTURA (fechada) mm"],
    ["alturaAberta", "ALTURA (aberta) mm"],
    ["acessorioTorre", "ACESSÓRIO TORRE"],
    ["garfos", "GARFOS (mm)"],
    ["tipoPneus", "TIPO PNEUS"],
    ["itensSeguranca", "ITENS SEGURANÇA"],
    ["quantidade", "QUANTIDADE"],
  ];

  const eqPlaceholders: Record<keyof EquipDesc, string> = {
    tipo: "Ex: Empilhadeira contrabalançada NOVA",
    combustivel: "Ex: GLP",
    capacidade: "Ex: 2,5 ton",
    tipoTorre: "Ex: Triplex",
    alturaFechada: "Ex: 2300 fechada",
    alturaAberta: "Ex: 4700 aberta",
    acessorioTorre: "Ex: Não",
    garfos: "Ex: Padrão - 1100",
    tipoPneus: "Ex: Maciços",
    itensSeguranca: "Ex: Iluminação completa + blue spot",
    quantidade: "Ex: 01",
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card/50">
        <div className="mx-auto max-w-5xl px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold uppercase">Vendas</h1>
            <p className="text-sm text-muted-foreground">Gerador de Propostas</p>
          </div>
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        <Card>
          <CardHeader><CardTitle>Cabeçalho</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Data</Label>
              <Input value={form.data} onChange={(e) => set("data", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Nome do Cliente</Label>
              <Input value={form.cliente} onChange={(e) => set("cliente", e.target.value)} placeholder="ADESTE" />
            </div>
            <div className="space-y-2">
              <Label>A/C (Responsável)</Label>
              <Input value={form.responsavel} onChange={(e) => set("responsavel", e.target.value)} placeholder="CRISTIANE" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Descrição do Equipamento</CardTitle>
            <Button size="sm" variant="outline" onClick={addEquip}>
              <Plus className="h-4 w-4" /> Equipamento
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {form.equipamentos.map((eq, ei) => (
              <div key={ei} className="space-y-3 border rounded-md p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">Equipamento {ei + 1}</h3>
                  {form.equipamentos.length > 1 && (
                    <Button size="icon" variant="ghost" onClick={() => removeEquip(ei)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {eqFields.map(([k, label]) => (
                    <div key={String(k)} className="space-y-2">
                      <Label>{label}</Label>
                      <Input value={eq[k]} onChange={(e) => updateEquip(ei, k, e.target.value)} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Valores</CardTitle>
            <Button size="sm" variant="outline" onClick={addItem}><Plus className="h-4 w-4" /> Linha</Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {form.itensValor.map((it, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Quant.</Label>
                  <Input value={it.quant} onChange={(e) => updateItem(i, "quant", e.target.value)} />
                </div>
                <div className="col-span-5 space-y-1">
                  <Label className="text-xs">Equipamento</Label>
                  <Input value={it.equipamento} onChange={(e) => updateItem(i, "equipamento", e.target.value)} />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Vlr Unit.</Label>
                  <Input value={it.valorUnitario} onChange={(e) => updateItem(i, "valorUnitario", e.target.value)} />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Vlr Total (auto)</Label>
                  <Input value={it.valorTotal} onChange={(e) => updateItem(i, "valorTotal", e.target.value)} />
                </div>
                <div className="col-span-1">
                  <Button size="icon" variant="ghost" onClick={() => removeItem(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t">
              <div className="space-y-2">
                <Label>Valor Total Mensal (R$) — auto</Label>
                <Input value={form.valorTotalMensal} readOnly className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Valor por Extenso — auto</Label>
                <Input value={form.valorTotalExtenso} readOnly className="bg-muted" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Condições</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Prazo de Entrega</Label>
              <Textarea rows={2} value={form.prazoEntrega} onChange={(e) => set("prazoEntrega", e.target.value)} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Período de Contrato</Label>
                <Input value={form.periodoContrato} onChange={(e) => set("periodoContrato", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Condições de Pagamento</Label>
                <Input value={form.condicoesPagamento} onChange={(e) => set("condicoesPagamento", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Validade da Proposta</Label>
                <Input value={form.validadeProposta} onChange={(e) => set("validadeProposta", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Custo de Frete</Label>
                <Input value={form.custoFrete} onChange={(e) => set("custoFrete", e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button size="lg" onClick={handleGenerate} disabled={loading}>
            <FileDown className="h-5 w-5" />
            {loading ? "Gerando..." : "Gerar Proposta (Word)"}
          </Button>
        </div>
      </main>
    </div>
  );
}
