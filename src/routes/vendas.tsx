import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { generateProposal, type ProposalInput } from "@/lib/proposal.functions";
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

function VendasPage() {
  const gen = useServerFn(generateProposal);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<ProposalInput>({
    data: today(),
    cliente: "",
    responsavel: "",
    equip: {
      tipo: "Empilhadeira contrabalançada NOVA",
      combustivel: "GLP",
      capacidade: "2,5 ton",
      tipoTorre: "Triplex",
      alturaFechada: "2300 fechada",
      alturaAberta: "4700 aberta",
      acessorioTorre: "Não",
      garfos: "Padrão - 1100",
      tipoPneus: "Maciços",
      itensSeguranca: "Iluminação completa + blue spot",
      quantidade: "01",
    },
    itensValor: [
      { quant: "01", equipamento: "EMPILHADEIRA 2.5 TON NOVA", valorUnitario: "5.200,00", valorTotal: "5.200,00" },
    ],
    valorTotalMensal: "5.200,00",
    valorTotalExtenso: "cinco mil e duzentos reais",
    prazoEntrega: "A pronta entrega – confirmar disponibilidade de caminhão para frete",
    periodoContrato: "24 meses",
    condicoesPagamento: "10 DDL após fechamento do mês",
    validadeProposta: "Proposta valida por 15 dias",
    custoFrete: "Por conta do cliente",
  });

  const set = <K extends keyof ProposalInput>(k: K, v: ProposalInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const setEq = <K extends keyof ProposalInput["equip"]>(k: K, v: string) =>
    setForm((f) => ({ ...f, equip: { ...f.equip, [k]: v } }));

  const updateItem = (i: number, field: keyof ProposalInput["itensValor"][number], val: string) =>
    setForm((f) => ({
      ...f,
      itensValor: f.itensValor.map((it, idx) => (idx === i ? { ...it, [field]: val } : it)),
    }));
  const addItem = () =>
    setForm((f) => ({
      ...f,
      itensValor: [...f.itensValor, { quant: "", equipamento: "", valorUnitario: "", valorTotal: "" }],
    }));
  const removeItem = (i: number) =>
    setForm((f) => ({ ...f, itensValor: f.itensValor.filter((_, idx) => idx !== i) }));

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

  const eqFields: Array<[keyof ProposalInput["equip"], string]> = [
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
          <CardHeader><CardTitle>Descrição do Equipamento</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {eqFields.map(([k, label]) => (
              <div key={k} className="space-y-2">
                <Label>{label}</Label>
                <Input value={form.equip[k]} onChange={(e) => setEq(k, e.target.value)} />
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
                  <Label className="text-xs">Vlr Total</Label>
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
                <Label>Valor Total Mensal (R$)</Label>
                <Input value={form.valorTotalMensal} onChange={(e) => set("valorTotalMensal", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Valor por Extenso</Label>
                <Input value={form.valorTotalExtenso} onChange={(e) => set("valorTotalExtenso", e.target.value)} />
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
