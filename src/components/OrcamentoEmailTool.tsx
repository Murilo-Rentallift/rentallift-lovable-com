import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Copy, Mail } from "lucide-react";

const FIXED_CC_EMAILS = [
  "manutencao@rentallift.com",
  "manutencao1@rentallift.com",
  "daniela.campos@rentallift.com",
  "evandro@rentallift.com.br",
  "debora@rentallift.com.br",
].join(", ");

type Greeting = "Bom dia" | "Boa tarde";

function defaultGreeting(): Greeting {
  const hour = new Date().getHours();
  return hour < 12 ? "Bom dia" : "Boa tarde";
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  } catch {
    toast.error("Falha ao copiar");
  }
}

function CopyBlock({
  label,
  value,
  rows = 3,
}: {
  label: string;
  value: string;
  rows?: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
          {label}
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => copyToClipboard(value)}
          className="h-7 gap-1 text-xs"
        >
          <Copy className="h-3.5 w-3.5" />
          Copiar
        </Button>
      </div>
      <Textarea
        readOnly
        value={value}
        rows={rows}
        className="resize-none font-mono text-sm bg-muted/30"
      />
    </div>
  );
}

export function OrcamentoEmailTool() {
  const [greeting, setGreeting] = useState<Greeting>(defaultGreeting());
  const [number, setNumber] = useState("");
  const [client, setClient] = useState("");
  const [responsible, setResponsible] = useState("");
  const [reason, setReason] = useState("");
  const [deadline, setDeadline] = useState<string>("5");
  const [isOperatorError, setIsOperatorError] = useState(false);

  const subjectLine = useMemo(() => {
    const clientUpper = client.trim().toUpperCase();
    const reasonUpper = reason.trim().toUpperCase();
    let line = `ORÇAMENTO ${number.trim()}`;
    if (clientUpper) line += ` - ${clientUpper}`;
    if (reasonUpper) line += ` - ${reasonUpper}`;
    if (isOperatorError) line += " - ERRO DE OPERAÇÃO";
    line += " - AGUARDANDO APROVAÇÃO";
    line += ` - PRAZO: ${deadline || "0"} DIAS`;
    return line;
  }, [number, client, reason, isOperatorError, deadline]);

  const bodyText = useMemo(() => {
    const responsibleFmt = responsible.trim() || "";
    const reasonFmt = reason.trim() || "";
    const lines = [
      `${greeting}${responsibleFmt ? `, ${responsibleFmt}` : ""}, tudo bem?`,
      "",
      `Segue em anexo o orçamento referente a ${reasonFmt || "solicitação"}.`,
      "",
      subjectLine,
      "",
      "Qualquer dúvida, estamos à disposição",
      "",
      "Att",
    ];
    return lines.join("\n");
  }, [greeting, responsible, reason, subjectLine]);

  useEffect(() => {
    setGreeting(defaultGreeting());
  }, []);

  return (
    <section className="space-y-5">
      <div className="rounded-lg border border-border bg-card p-5 shadow-lg">
        <div className="flex items-center gap-2 mb-4">
          <Mail className="h-5 w-5 text-accent" />
          <h3 className="font-display text-lg font-bold uppercase">
            Email de Orçamentos
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="greeting" className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Saudação
            </Label>
            <Select
              value={greeting}
              onValueChange={(v) => setGreeting(v as Greeting)}
            >
              <SelectTrigger id="greeting" className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Bom dia">Bom dia</SelectItem>
                <SelectItem value="Boa tarde">Boa tarde</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="number" className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Número do orçamento
            </Label>
            <Input
              id="number"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="Ex: 22032"
              className="bg-background"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="client" className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Nome do cliente
            </Label>
            <Input
              id="client"
              value={client}
              onChange={(e) => setClient(e.target.value)}
              placeholder="Ex: Aperam, Vigor SCS"
              className="bg-background"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="responsible" className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Responsável do cliente
            </Label>
            <Input
              id="responsible"
              value={responsible}
              onChange={(e) => setResponsible(e.target.value)}
              placeholder="Ex: Luigi, Rita"
              className="bg-background"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="reason" className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Motivo / descrição do orçamento
            </Label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: motor de partida da empilhadeira de 10 TON, batida da grade"
              className="bg-background"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="deadline" className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Prazo (dias)
            </Label>
            <Input
              id="deadline"
              type="number"
              min={1}
              value={deadline}
              onChange={(e) => {
                const v = e.target.value;
                setDeadline(v === "" ? "" : String(Math.max(1, parseInt(v) || 1)));
              }}
              className="bg-background"
            />
          </div>

          <div className="flex items-end gap-2 pb-1">
            <Checkbox
              id="operator-error"
              checked={isOperatorError}
              onCheckedChange={(c) => setIsOperatorError(c === true)}
            />
            <Label
              htmlFor="operator-error"
              className="text-sm font-normal cursor-pointer"
            >
              Erro de operação
            </Label>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 shadow-lg space-y-5">
        <h4 className="font-display text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Resultado
        </h4>

        <CopyBlock label="Emails para copiar" value={FIXED_CC_EMAILS} rows={2} />
        <CopyBlock label="Assunto" value={subjectLine} rows={2} />
        <CopyBlock label="Corpo do email" value={bodyText} rows={10} />
      </div>
    </section>
  );
}
