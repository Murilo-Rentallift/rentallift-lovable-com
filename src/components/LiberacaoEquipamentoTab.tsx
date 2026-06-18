import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Copy, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";

type Empresa = "Rental" | "Rle" | "Empisa";
type TipoLib =
  | "Nova Locação"
  | "Encerramento de Locação"
  | "Troca de Equipamento"
  | "Retorno para Manutenção"
  | "Empréstimo ou Teste";
type SimNao = "Sim" | "Não";
type Frete = "Remetente" | "Cliente" | "Junto na Loc.";

const empresas: Empresa[] = ["Rental", "Rle", "Empisa"];
const tipos: TipoLib[] = [
  "Nova Locação",
  "Encerramento de Locação",
  "Troca de Equipamento",
  "Retorno para Manutenção",
  "Empréstimo ou Teste",
];
const fretes: Frete[] = ["Remetente", "Cliente", "Junto na Loc."];

const formatDataBR = (iso: string) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
};

export function LiberacaoEquipamentoTab() {
  const [empresa, setEmpresa] = useState<Empresa>("Rental");
  const [tipo, setTipo] = useState<TipoLib>("Nova Locação");
  const [cliente, setCliente] = useState("");
  const [empilhadeira, setEmpilhadeira] = useState("");
  const [acessorios, setAcessorios] = useState("");
  const [desmontagem, setDesmontagem] = useState<SimNao>("Não");
  const [valorLocacao, setValorLocacao] = useState("");
  const [endereco, setEndereco] = useState("");
  const [dataEntrega, setDataEntrega] = useState("");
  const [dataEntregaTexto, setDataEntregaTexto] = useState("");
  const [frete, setFrete] = useState<Frete>("Cliente");
  const [transportadora, setTransportadora] = useState("");
  const [valorFrete, setValorFrete] = useState("");
  const [dataCobranca, setDataCobranca] = useState("");
  const [dataCobrancaTexto, setDataCobrancaTexto] = useState("");
  const [dataCobrancaBranco, setDataCobrancaBranco] = useState(false);
  const [observacao, setObservacao] = useState("");
  const [mensagem, setMensagem] = useState("");

  const gerarMensagem = () => {
    const empresaLinha = empresas
      .map((e) => `(${e === empresa ? "x" : " "}) ${e}`)
      .join(" ");

    const tiposLinhas: string[] = [];
    for (let i = 0; i < tipos.length; i += 2) {
      const linha = [tipos[i], tipos[i + 1]]
        .filter(Boolean)
        .map((t) => `(${t === tipo ? "x" : " "}) ${t}`)
        .join(" ");
      tiposLinhas.push(linha);
    }

    const freteLinha = fretes
      .map((f) => `(${f === frete ? "x" : " "}) ${f.toLowerCase()}`)
      .join(" ");

    const desmontagemLinha = (["Sim", "Não"] as SimNao[])
      .map((s) => `(${s === desmontagem ? " x " : " "}) ${s}`)
      .join("  ");

    const dataEntregaFinal = dataEntregaTexto.trim() || formatDataBR(dataEntrega) || "";
    const dataCobrancaFinal = dataCobrancaBranco
      ? ""
      : dataCobrancaTexto.trim() || formatDataBR(dataCobranca) || "";

    const msg = `Empresa: ${empresaLinha}

Tipo liberação:

${tiposLinhas.join("\n")}

CLIENTE:

${cliente}

EMPILHADEIRA:

${empilhadeira}

ACESSORIOS:

${acessorios}

Necessário Desmontagem da Torre: ${desmontagemLinha}

Valor Locação: ${valorLocacao}

End. de entrega: ${endereco}

Data de Entrega: ${dataEntregaFinal}

Frete por conta do:

${freteLinha}

Transportadora: ${transportadora}
Valor FRETE: ${valorFrete}

Data de Início ou Encerramento da Cobrança: ${dataCobrancaFinal}

OBS: ${observacao}`;

    setMensagem(msg);
    toast.success("Mensagem gerada");
  };

  const copiar = async () => {
    if (!mensagem) {
      toast.error("Gere a mensagem primeiro");
      return;
    }
    try {
      await navigator.clipboard.writeText(mensagem);
      toast.success("Mensagem copiada");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const whatsappUrl = mensagem
    ? `https://wa.me/?text=${encodeURIComponent(mensagem)}`
    : undefined;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-emerald-500" />
            Liberação de Equipamento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Empresa</Label>
            <RadioGroup
              value={empresa}
              onValueChange={(v) => setEmpresa(v as Empresa)}
              className="flex flex-wrap gap-4"
            >
              {empresas.map((e) => (
                <label key={e} className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value={e} id={`emp-${e}`} />
                  <span className="text-sm">{e}</span>
                </label>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label>Tipo de Liberação</Label>
            <RadioGroup
              value={tipo}
              onValueChange={(v) => setTipo(v as TipoLib)}
              className="grid grid-cols-1 sm:grid-cols-2 gap-2"
            >
              {tipos.map((t) => (
                <label key={t} className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value={t} id={`tipo-${t}`} />
                  <span className="text-sm">{t}</span>
                </label>
              ))}
            </RadioGroup>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Textarea rows={2} value={cliente} onChange={(e) => setCliente(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Empilhadeira</Label>
              <Textarea
                rows={2}
                value={empilhadeira}
                onChange={(e) => setEmpilhadeira(e.target.value)}
                placeholder={"Ex:\nVai E630\nVolta E294"}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Acessórios</Label>
              <Textarea rows={2} value={acessorios} onChange={(e) => setAcessorios(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Necessário Desmontagem da Torre</Label>
            <RadioGroup
              value={desmontagem}
              onValueChange={(v) => setDesmontagem(v as SimNao)}
              className="flex gap-4"
            >
              {(["Sim", "Não"] as SimNao[]).map((s) => (
                <label key={s} className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value={s} id={`des-${s}`} />
                  <span className="text-sm">{s}</span>
                </label>
              ))}
            </RadioGroup>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Valor Locação</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  R$
                </span>
                <Input
                  className="pl-10"
                  inputMode="decimal"
                  value={valorLocacao}
                  onChange={(e) => setValorLocacao(e.target.value)}
                  placeholder="0,00"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Data de Entrega</Label>
              <Input
                type="date"
                value={dataEntrega}
                onChange={(e) => setDataEntrega(e.target.value)}
              />
              <Input
                value={dataEntregaTexto}
                onChange={(e) => setDataEntregaTexto(e.target.value)}
                placeholder="ou texto (ex: A combinar) — sobrescreve a data"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Endereço de Entrega</Label>
              <Textarea rows={2} value={endereco} onChange={(e) => setEndereco(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Frete por conta do</Label>
            <RadioGroup
              value={frete}
              onValueChange={(v) => setFrete(v as Frete)}
              className="flex flex-wrap gap-4"
            >
              {fretes.map((f) => (
                <label key={f} className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value={f} id={`frete-${f}`} />
                  <span className="text-sm">{f}</span>
                </label>
              ))}
            </RadioGroup>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Transportadora</Label>
              <Textarea
                rows={2}
                value={transportadora}
                onChange={(e) => setTransportadora(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Valor do Frete</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  R$
                </span>
                <Input
                  className="pl-10"
                  inputMode="decimal"
                  value={valorFrete}
                  onChange={(e) => setValorFrete(e.target.value)}
                  placeholder="0,00"
                />
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Data de Início ou Encerramento da Cobrança</Label>
              <Input
                type="date"
                value={dataCobranca}
                onChange={(e) => setDataCobranca(e.target.value)}
                disabled={dataCobrancaBranco}
              />
              <Input
                value={dataCobrancaTexto}
                onChange={(e) => setDataCobrancaTexto(e.target.value)}
                placeholder="ou texto (ex: A combinar) — sobrescreve a data"
                disabled={dataCobrancaBranco}
              />
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={dataCobrancaBranco}
                  onChange={(e) => setDataCobrancaBranco(e.target.checked)}
                />
                Deixar em branco
              </label>
            </div>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>OBS</Label>
            <Textarea
              rows={2}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Observações adicionais"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              onClick={gerarMensagem}
              className="bg-emerald-700 hover:bg-emerald-800 text-white"
            >
              <MessageSquare className="h-4 w-4" /> Gerar Mensagem
            </Button>
            <Button onClick={copiar} variant="outline" disabled={!mensagem}>
              <Copy className="h-4 w-4" /> Copiar Mensagem
            </Button>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white transition-colors ${
                mensagem
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "pointer-events-none bg-emerald-300"
              }`}
            >
              <Send className="h-4 w-4" /> Enviar pelo WhatsApp
            </a>
          </div>

          {mensagem && (
            <div className="space-y-2">
              <Label>Mensagem (WhatsApp)</Label>
              <Textarea
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                rows={22}
                className="font-mono text-sm"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
