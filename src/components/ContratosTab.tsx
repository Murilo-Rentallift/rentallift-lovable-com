import { useState, useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listContracts, getContract, saveContract, deleteContract } from "@/lib/contracts.functions";
import { generateContractDoc } from "@/lib/contract-doc.functions";
import { reaisPorExtenso, parseBR } from "@/lib/numberToWords";
import { importContractFromDocx } from "@/lib/contract-import";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Trash2, Save, FileText, RotateCcw, FileDown, CalendarIcon, Pencil, Check, Upload } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";


const MESES_PT = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const formatDataExtenso = (iso: string) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return "";
  return `${String(d).padStart(2, "0")} de ${MESES_PT[m - 1]} de ${y}`;
};

type SubClause = { numero: string; texto: string };
type Clause = {
  id: string;
  numero: string; // ex: "1"
  titulo: string;
  fixo: boolean; // se false, é cláusula adicional (título editável, corpo editável)
  corpo?: string; // usado para cláusulas adicionais
  subclausulasFixas?: Array<{ numero: string; texto: string; placeholders?: Record<string, string> }>;
  subclausulasExtras: SubClause[];
};

type Equipamento = { descricao: string; valorUnitario: string };

type ContratoData = {
  // Quadro de resumo
  numeroContrato?: string;
  contratanteNome: string;
  contratanteEndereco: string;
  contratanteCnpj: string;
  contratanteIE: string;
  descricaoServicos: string;
  localPrestacao: string;
  documentosAplicaveis: string;
  vigencia: string;
  precoTotal: string;
  precoExtenso: string;
  formaPagamento: string;
  // Cláusulas
  clausulas: Clause[];
  // Anexo I
  equipamentos: Equipamento[];
  // Assinaturas
  contratanteAssinNome: string;
  contratanteAssinRg: string;
  contratanteAssinCpf: string;
  contratanteRepresentante?: string;
  contratanteCargo?: string;
  testemunha1Nome: string;
  testemunha1Rg: string;
  testemunha2Nome: string;
  testemunha2Rg: string;
  dataAssinatura: string; // ex: "Santo André, 24 de junho de 2026" (composto)
  cidadeAssinatura?: string;
  dataAssinaturaIso?: string; // YYYY-MM-DD
  // Contratada selecionada
  contratadaKey?: "rental" | "rle" | "empisa";
  contratadaNome?: string;
  contratadaCnpj?: string;
  contratadaEndereco?: string;
};

const CONTRATADAS: Record<"rental" | "rle" | "empisa", { label: string; nome: string; cnpj: string; endereco: string }> = {
  rental: {
    label: "Rental Lift",
    nome: "RENTAL LIFT LOCAÇÃO, MANUTENÇÃO E MOVIMENTAÇÃO DE CARGAS LTDA",
    cnpj: "04.705.697/0001-57",
    endereco: "AV. DOM BOSCO, 835, SANTO ANDRÉ, SÃO PAULO",
  },
  rle: {
    label: "RLE",
    nome: "RLE LOCACAO E TRANSPORTE DE EQUIPAMENTOS LTDA",
    cnpj: "14.989.985/0001-34",
    endereco: "AV DOM BOSCO, 1050, VILA LUCINDA, SANTO ANDRÉ, SÃO PAULO",
  },
  empisa: {
    label: "Empisa",
    nome: "EMPISA EMPILHADEIRAS SANTO ANDRE LOCACAO E MOVIMENTACAO DE CARGAS LTDA",
    cnpj: "09.449.084/0001-10",
    endereco: "AV DOM BOSCO, 84, VILA LUCINDA, SANTO ANDRÉ, SÃO PAULO",
  },
};


const SUB32 = "3.2) O reajuste da parcela correspondente à locação dos equipamentos será automático e baseado no índice dos últimos 12 (doze) meses do IGP-M, ou outro índice que venha á substitui-lo, considerando como base o mês de {{MES}} / {{ANO}}, e será aplicado a cada 12 meses de contrato.";

const defaultClausulas = (): Clause[] => [
  {
    id: "c1", numero: "1", titulo: "OBJETO", fixo: true, subclausulasExtras: [],
    subclausulasFixas: [
      { numero: "1.1", texto: "A CONTRATANTE contrata, por força do presente a(s) empilhadeira(s) da CONTRATADA, para trabalhos em sua sede, com operadores da CONTRATANTE." },
    ],
  },
  {
    id: "c2", numero: "2", titulo: "DOCUMENTOS APLICÁVEIS", fixo: true, subclausulasExtras: [],
    subclausulasFixas: [
      { numero: "2.1", texto: "Fazem parte integrante do presente contrato, como se aqui estivessem transcrito, documentos cujo teor as partes declaram Ter pleno conhecimento e aceitam independentemente da sua anexação, os indicados no item \"B 3\" do Quadro Resumo." },
    ],
  },
  {
    id: "c3", numero: "3", titulo: "VIGÊNCIA E REAJUSTE DE PREÇOS", fixo: true, subclausulasExtras: [],
    subclausulasFixas: [
      { numero: "3.1", texto: "O presente contrato vigorará pelo prazo constante no item \"c\" do quadro resumo, findo o qual, passará a vigorar por prazo indeterminado, mantidas todas as demais cláusulas, sendo que, nesta hipótese a parte que desejar rescindir o contrato deverá comunicar a outra, por escrito, com antecedência de 30 (trinta) dias. Se uma das partes rescindir o contrato antes do seu término, se obriga a pagar a outra, no ato da rescisão, os alugueres pelo tempo que faltar até a data prevista como termo final." },
      { numero: "3.2", texto: SUB32, placeholders: { MES: "JUNHO", ANO: "2026" } },
      { numero: "3.3", texto: "Havendo, no entanto, qualquer alteração significativa na Política Econômica vigente ou oscilação de mercado que possa comprometer os interesses comuns, as partes poderão reavaliar as condições gerais reajustando os preços durante o período de vigência deste instrumento." },
    ],
  },
  {
    id: "c4", numero: "4", titulo: "OBRIGAÇÕES DA CONTRATADA", fixo: true, subclausulasExtras: [],
    subclausulasFixas: [
      { numero: "4.1", texto: "Será obrigação da CONTRATADA, toda manutenção preventiva e corretiva das empilhadeiras de sua propriedade, e os materiais aplicados para esses serviços, excetuando-se os casos em que as quebras sejam provenientes de erros de operação que nestes casos serão cobrados da CONTRATANTE, peças e mão de obra, como se fosse um serviço esporádico, sendo que incluem-se neste item erro de operação manobras que danifiquem a pintura e estrutura do equipamento." },
      { numero: "4.2", texto: "Será de obrigação da CONTRATADA, manter em funcionamento o número de máquinas constantes no Anexo I, com suas especificações combinadas, correndo sobre sua responsabilidade, custo com fretes no caso de troca de equipamentos por problemas mecânicos." },
      { numero: "4.3", texto: "Aceitar as normas e procedimentos internos da CONTRATANTE, desde que os mesmos sejam passados para os funcionários da CONTRATADA." },
      { numero: "4.4", texto: "Manter seu pessoal uniformizado e com os EPI's necessários pata tal operação." },
      { numero: "4.5", texto: "Salários, encargos, refeição e transporte de seus funcionários/propostos." },
    ],
  },
  {
    id: "c5", numero: "5", titulo: "OBRIGAÇÕES DA CONTRATANTE", fixo: true, subclausulasExtras: [],
    subclausulasFixas: [
      { numero: "5.1", texto: "O(s) equipamento(s) objeto deste instrumento contratual são utilizados por funcionários da CONTRATANTE, ficando a mesma responsável pelo desdobramento legais (ações de diversas natureza) provocadas pelo uso do equipamento e por eventuais danos causados ao próprio equipamento." },
      { numero: "5.2", texto: "Será de responsabilidade da CONTRATANTE, disponibilizar os equipamentos no endereço descrito no item \"B.2\" do quadro resumo para os serviços ora contratados, de acordo com programação e acordo entre as partes." },
      { numero: "5.3", texto: "Comunicar, prontamente, a existência de problemas que possam interferir sobre o andamento do contrato." },
      { numero: "5.4", texto: "Efetuar os pagamentos a CONTRATADA, nos termos estabelecidos de presente contratação." },
      { numero: "5.5", texto: "Comunicar, por escrito, com antecedência de trinta dias úteis, à CONTRATADA, qualquer alteração referente aos serviços objeto do presente contrato, a qual analisará se a necessidade de ser elaborado um aditivo contratual." },
      { numero: "5.6", texto: "Será de responsabilidade da CONTRATANTE, garantir que seus funcionários façam e preencham corretamente os relatórios de verificação (Check List) a cada troca de turno." },
      { numero: "5.7", texto: "Será de responsabilidade da CONTRATANTE, as despesas para aquisição de gás liquefeito de petróleo (GLP), necessário para os abastecimento do equipamento descrito no Anexo I, sendo, também, de responsabilidade da CONTRATANTE, o controle de qualidade e a solicitação de compra dos referidos combustíveis." },
      { numero: "5.8", texto: "Tratar os resíduos decorrentes das manutenções realizadas nos equipamentos." },
      { numero: "5.9", texto: "A CONTRATADA, disponibilizará seus equipamentos objeto deste instrumento, totalmente revisado e bom para o uso, o qual a CONTRATANTE, declara desde já assumir as responsabilidades pela conservação dos mesmos enquanto estiverem em suas instalações e nos percursos de ida e volta do local destino as instalações da CONTRATADA." },
      { numero: "5.10", texto: "A CONTRATANTE é responsável pela integridade dos equipamentos da CONTRATADA, no que diz respeito as enchentes, incêndios, roubos, furtos e outros casos, considerados fortuitos ou de força maior, ressarcindo de imediato os valores equivalentes dos equipamentos que estavam designados na sede da CONTRATANTE, conforme descrito no anexo I." },
      { numero: "5.11", texto: "Frete de ida do equipamento, a volta ficará por conta da contratada." },
    ],
  },
  {
    id: "c6", numero: "6", titulo: "VALOR", fixo: true, subclausulasExtras: [],
    subclausulasFixas: [
      { numero: "6.1", texto: "Pelo serviços prestados, mediante a apresentação, pela CONTRATADA, dos documentos fiscais hábeis, a CONTRATANTE pagará o preço especificado no item \"D\" do quadro de resumo." },
    ],
  },
  {
    id: "c7", numero: "7", titulo: "PAGAMENTO", fixo: true, subclausulasExtras: [],
    subclausulasFixas: [
      { numero: "7.1", texto: "Os pagamentos, pelo serviços objeto deste contrato, desde que obedecidas as condições expostas neste instrumento, serão efetuados conforme item \"E\" do contrato do resumo, com depósito em conta corrente fornecida pela contratada, ou boleto bancário." },
      { numero: "7.2", texto: "Serão cobrada MULTA de 2% (dois por cento) ao mês, mais juros bancários paras as faturas pagas em atraso, conforme condições de pagamento hora estabelecida. No caso de atraso, se ocorrer acumulo de duas parcelas vencidas, poderá a contratada a seu critério rescindir o contrato e retirar as máquinas locadas, e acionar a clausula 3.1 no tocante a multa de finalização do contrato." },
    ],
  },
  {
    id: "c8", numero: "8", titulo: "RESCISÃO", fixo: true, subclausulasExtras: [],
    subclausulasFixas: [
      { numero: "8.1", texto: "Serão motivos de rescisão, independentemente de notificação judicial ou extrajudicial. As seguintes hipóteses acarretarão a rescisão contratual motivada: 8.1.1) A alteração, pela CONTRATADA, de seus objeto social, capaz de impossibilitar a realização dos serviços ora contratados. 8.1.2) A declaração de falência, concordata, insolvência, liquidação judicial ou extrajudicial de qualquer das partes." },
      { numero: "8.2", texto: "O descumprimento, por qualquer das partes das obrigações assumidas por força deste contrato perante a outra parte sem prejuízo da indenização por perdas e danos que der causa." },
      { numero: "8.3", texto: "O descumprimento, por qualquer das partes, das condições estabelecida neste contrato acarretará a sua rescisão, a critério da parte lesada ficando a parte infratora obrigada ao pagamento da multa contratual em caráter não compensatório no valor de 10% (dez por cento) do valor dos serviços, sem prejuízos da indenização devida por penas e danos a que der causa." },
      { numero: "8.4", texto: "Na hipótese de se efetivar a rescisão, as partes deverão realizar um ajuste final de contas, em um prazo máximo de 30 (trinta) dias a contar da data de rescisão." },
    ],
  },
  {
    id: "c9", numero: "9", titulo: "DISPOSIÇÕES GERAIS", fixo: true, subclausulasExtras: [],
    subclausulasFixas: [
      { numero: "9.1", texto: "Nenhuma das partes poderá ceder, sublocar ou transferir o presente contrato, total ou parcialmente a terceiros, sem anuência previa ou por escrito da outra parte." },
      { numero: "9.2", texto: "O não exercício por qualquer das partes, de direitos relativos ao presente contrato será considerado como mera liberalidade e tolerância, não representando em qualquer hipótese, nova ação, revogação ou renúncia ao mesmos ou ao direito de exigidos no futuro." },
      { numero: "9.3", texto: "Nenhuma das partes poderá ser considerada inadimplente no cumprimento de suas obrigações, caso haja ocorrência de eventos que, pela sua natureza, efeitos e abrangências, possa ser considerados como de força maior ou fortuitos. Findo o evento, á parte impedida de cumprir suas obrigações diligenciar no sentido de retornar a regular execução do contrato no menor prazo de tempo possível, não acarretando juros ou taxas adicionais." },
      { numero: "9.4", texto: "Nenhuma modificação ou alteração a este contrato será considerado válida, a menos que acordado por escrito entre as partes, por meio do competente aditivo contratual." },
      { numero: "9.5", texto: "Todos os direitos e obrigações constante do presente instrumento serão, obrigatoriamente, respeitados pelo os sucessores e herdeiros de ambas as partes." },
      { numero: "9.6", texto: "Findo o prazo ou rescindindo o contrato, será feita uma vistoria por representantes de ambas as partes no endereço objeto deste contrato, para total verificação do equipamento e acessórios, ficando desde já estabelecido o seguinte: 9.6.1) Caberá a CONTRATANTE, no prazo de 15 (quinze) dias, proceder os reparos apurados quando da vistoria, necessários para devolução do equipamento e acessórios, em bom estado de conservação e uso ou indenizar a CONTRATADA, o valor do orçamento correspondente aos reparos verificados. 9.6.2) Estando o equipamento e acessórios em pleno funcionamento a CONTRATANTE, se obriga a entrega-los no prazo imediato na sede da CONTRATADA, lavrando-se o respectivo termo de entrega e recebimento, assinado pelas partes." },
      { numero: "9.7", texto: "As partes assumem o compromisso recíproco de manter sigilo de todas as informações de ordem técnica, comercial e administrativas." },
      { numero: "9.8", texto: "Os casos omissos, assim como as questões oriundas ou decorrentes dos serviços objeto deste contrato, serão resolvidos de comum acordo entre as partes." },
    ],
  },
  {
    id: "c10", numero: "10", titulo: "EXTENÇÃO E FORO", fixo: true, subclausulasExtras: [],
    subclausulasFixas: [
      { numero: "10.1", texto: "As partes elegem o Foro da Comarca de Santo André, estado de São Paulo, como o competente para dirimir qualquer dúvida ou litígio que possam advir da presente contratação, com renúncia de qualquer outro por mais privilegiado que seja." },
    ],
  },
];

const blank = (): ContratoData => ({
  numeroContrato: "",
  contratanteNome: "",
  contratanteEndereco: "",
  contratanteCnpj: "",
  contratanteIE: "",
  descricaoServicos: "Locação de equipamentos móveis, conforme descrito no Anexo I.",
  localPrestacao: "NA SEDE DA CONTRATANTE",
  documentosAplicaveis: "Anexo I – Planilha quantitativa de Equipamentos;",
  vigencia: "",
  precoTotal: "",
  precoExtenso: "",
  formaPagamento: "",
  clausulas: defaultClausulas(),
  equipamentos: [{ descricao: "", valorUnitario: "" }],
  contratanteAssinNome: "",
  contratanteAssinRg: "",
  contratanteAssinCpf: "",
  contratanteRepresentante: "",
  contratanteCargo: "",
  testemunha1Nome: "",
  testemunha1Rg: "",
  testemunha2Nome: "",
  testemunha2Rg: "",
  dataAssinatura: "",
  cidadeAssinatura: "Santo André",
  dataAssinaturaIso: "",
  contratadaKey: "rental",
  contratadaNome: CONTRATADAS.rental.nome,
  contratadaCnpj: CONTRATADAS.rental.cnpj,
  contratadaEndereco: CONTRATADAS.rental.endereco,
});


function nextSubNumber(c: Clause): string {
  const used = [
    ...(c.subclausulasFixas ?? []).map((s) => s.numero),
    ...c.subclausulasExtras.map((s) => s.numero),
  ];
  let n = used.length + 1;
  while (used.includes(`${c.numero}.${n}`)) n++;
  return `${c.numero}.${n}`;
}

export function ContratosTab() {
  const list = useServerFn(listContracts);
  const get = useServerFn(getContract);
  const save = useServerFn(saveContract);
  const del = useServerFn(deleteContract);

  const [id, setId] = useState<string | null>(null);
  const [form, setForm] = useState<ContratoData>(blank());
  const [salvos, setSalvos] = useState<Array<{ id: string; contractor_name: string; created_at: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [editandoClausulas, setEditandoClausulas] = useState(false);


  const refresh = async () => {
    try {
      const r = await list();
      setSalvos(r.contracts);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => { refresh(); }, []);

  // Auto preço por extenso a partir do valor numérico
  useEffect(() => {
    const n = parseBR(form.precoTotal);
    const extenso = n > 0 ? reaisPorExtenso(n) : "";
    setForm((f) => (f.precoExtenso === extenso ? f : { ...f, precoExtenso: extenso }));
  }, [form.precoTotal]);

  // Auto data assinatura: "Cidade, DD de mês de AAAA"
  useEffect(() => {
    if (!form.dataAssinaturaIso) return;
    const cidade = (form.cidadeAssinatura ?? "").trim();
    const dataExt = formatDataExtenso(form.dataAssinaturaIso ?? "");
    const composta = cidade && dataExt ? `${cidade}, ${dataExt}` : cidade ? `${cidade}, ___ de ___________ de ____` : "";
    setForm((f) => (f.dataAssinatura === composta ? f : { ...f, dataAssinatura: composta }));
  }, [form.cidadeAssinatura, form.dataAssinaturaIso]);

  const novo = () => { setId(null); setForm(blank()); };

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const handleImportDocx = async (file: File) => {
    setLoading(true);
    try {
      const { data, filledCount } = await importContractFromDocx(file);
      setId(null);
      setForm((prev) => {
        const base = blank();
        const next: ContratoData = { ...base };
        // Aplica campos simples
        const simpleKeys: Array<keyof ContratoData> = [
          "numeroContrato",
          "contratanteNome", "contratanteEndereco", "contratanteCnpj", "contratanteIE",
          "descricaoServicos", "localPrestacao", "documentosAplicaveis", "vigencia",
          "precoTotal", "precoExtenso", "formaPagamento", "dataAssinatura",
          "cidadeAssinatura", "dataAssinaturaIso", "contratanteRepresentante", "contratanteCargo",
          "contratanteAssinNome", "contratanteAssinRg", "contratanteAssinCpf",
          "contratadaNome", "contratadaCnpj", "contratadaEndereco",
          "testemunha1Nome", "testemunha1Rg", "testemunha2Nome", "testemunha2Rg",
        ];
        for (const k of simpleKeys) {
          const v = (data as any)[k];
          if (typeof v === "string" && v.trim()) (next as any)[k] = v;
        }
        if (data.equipamentos && data.equipamentos.length) {
          next.equipamentos = data.equipamentos;
        }
        // Cláusulas: mescla extras nas correspondentes; cláusulas com numero > 10 viram extras
        if (data.clausulasExtras && data.clausulasExtras.length) {
          const mapped = next.clausulas.map((c) => {
            const found = data.clausulasExtras!.find((x) => x.numero === c.numero);
            if (!found) return c;
            if (c.fixo) {
              // Atualiza textos das subcláusulas fixas por numero; sobras vão para extras
              const fixasByNum = new Map((c.subclausulasFixas ?? []).map((s) => [s.numero, s]));
              const usados = new Set<string>();
              const novasFixas = (c.subclausulasFixas ?? []).map((s) => {
                const imp = found.subclausulasExtras.find((x) => x.numero === s.numero);
                if (imp) { usados.add(imp.numero); return { ...s, texto: imp.texto }; }
                return s;
              });
              const sobras = found.subclausulasExtras.filter((x) => !fixasByNum.has(x.numero) && !usados.has(x.numero));
              if (found.corpo.trim()) sobras.unshift({ numero: `${c.numero}.1`, texto: found.corpo.trim() });
              return { ...c, subclausulasFixas: novasFixas, subclausulasExtras: sobras };
            }
            return {
              ...c,
              titulo: found.titulo || c.titulo,
              corpo: found.corpo,
              subclausulasExtras: found.subclausulasExtras,
            };
          });
          const extrasNovas = data.clausulasExtras
            .filter((x) => !next.clausulas.some((c) => c.numero === x.numero))
            .map((x, i) => ({
              id: `cx-imp-${Date.now()}-${i}`,
              numero: x.numero,
              titulo: x.titulo,
              fixo: false,
              corpo: x.corpo,
              subclausulasExtras: x.subclausulasExtras,
            }));
          next.clausulas = [...mapped, ...extrasNovas];
        }
        return next;
      });
      toast.success(`Contrato importado com sucesso — ${filledCount} campos preenchidos`);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Erro ao importar contrato");
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };


  const genDoc = useServerFn(generateContractDoc);
  const handleGenerateDoc = async () => {
    if (!form.contratanteNome.trim()) {
      toast.error("Informe o nome do contratante");
      return;
    }
    setLoading(true);
    try {
      const res = await genDoc({ data: form });
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
      toast.success("Contrato gerado");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Erro ao gerar contrato");
    } finally {
      setLoading(false);
    }
  };


  const handleSave = async () => {
    if (!form.contratanteNome.trim()) {
      toast.error("Informe o nome do contratante");
      return;
    }
    setLoading(true);
    try {
      const res = await save({ data: { id, contractorName: form.contratanteNome, data: form } });
      setId(res.id);
      toast.success("Contrato salvo");
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    } finally { setLoading(false); }
  };

  const handleOpen = async (cid: string) => {
    setLoading(true);
    try {
      const r = await get({ data: { id: cid } });
      setId(r.id);
      setForm({ ...blank(), ...(r.data as ContratoData) });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao abrir");
    } finally { setLoading(false); }
  };

  const handleDelete = async (cid: string) => {
    if (!confirm("Excluir este contrato?")) return;
    try {
      await del({ data: { id: cid } });
      if (id === cid) novo();
      refresh();
      toast.success("Excluído");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro");
    }
  };

  const updateClause = (cid: string, patch: Partial<Clause>) =>
    setForm((f) => ({ ...f, clausulas: f.clausulas.map((c) => (c.id === cid ? { ...c, ...patch } : c)) }));

  const addSub = (cid: string) =>
    setForm((f) => ({
      ...f,
      clausulas: f.clausulas.map((c) => {
        if (c.id !== cid) return c;
        return { ...c, subclausulasExtras: [...c.subclausulasExtras, { numero: nextSubNumber(c), texto: "" }] };
      }),
    }));

  const removeSub = (cid: string, idx: number) =>
    setForm((f) => ({
      ...f,
      clausulas: f.clausulas.map((c) =>
        c.id !== cid ? c : { ...c, subclausulasExtras: c.subclausulasExtras.filter((_, i) => i !== idx) },
      ),
    }));

  const updateSub = (cid: string, idx: number, patch: Partial<SubClause>) =>
    setForm((f) => ({
      ...f,
      clausulas: f.clausulas.map((c) =>
        c.id !== cid ? c : {
          ...c,
          subclausulasExtras: c.subclausulasExtras.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
        },
      ),
    }));

  const updateFixPh = (cid: string, subNumero: string, key: string, val: string) =>
    setForm((f) => ({
      ...f,
      clausulas: f.clausulas.map((c) => {
        if (c.id !== cid || !c.subclausulasFixas) return c;
        return {
          ...c,
          subclausulasFixas: c.subclausulasFixas.map((s) =>
            s.numero !== subNumero ? s : { ...s, placeholders: { ...(s.placeholders ?? {}), [key]: val } },
          ),
        };
      }),
    }));

  const updateFixSubTexto = (cid: string, subNumero: string, texto: string) =>
    setForm((f) => ({
      ...f,
      clausulas: f.clausulas.map((c) => {
        if (c.id !== cid || !c.subclausulasFixas) return c;
        return {
          ...c,
          subclausulasFixas: c.subclausulasFixas.map((s) =>
            s.numero !== subNumero ? s : { ...s, texto },
          ),
        };
      }),
    }));


  const addClausula = () =>
    setForm((f) => {
      const extras = f.clausulas.filter((c) => !c.fixo);
      const num = String(10 + extras.length + 1);
      return {
        ...f,
        clausulas: [...f.clausulas, {
          id: `cx-${Date.now()}`, numero: num, titulo: "", fixo: false,
          corpo: "", subclausulasExtras: [],
        }],
      };
    });

  const removeClausula = (cid: string) =>
    setForm((f) => ({ ...f, clausulas: f.clausulas.filter((c) => c.id !== cid || c.fixo) }));

  const addEquip = () => setForm((f) => ({ ...f, equipamentos: [...f.equipamentos, { descricao: "", valorUnitario: "" }] }));
  const updateEquip = (i: number, patch: Partial<Equipamento>) =>
    setForm((f) => ({ ...f, equipamentos: f.equipamentos.map((e, idx) => (idx === i ? { ...e, ...patch } : e)) }));
  const removeEquip = (i: number) =>
    setForm((f) => ({ ...f, equipamentos: f.equipamentos.length > 1 ? f.equipamentos.filter((_, idx) => idx !== i) : f.equipamentos }));

  // Render helper for fixed sub-clause with placeholder fields (3.2)
  const renderFixSub = (cid: string, s: { numero: string; texto: string; placeholders?: Record<string, string> }) => {
    if (editandoClausulas) {
      return (
        <div key={s.numero} className="flex gap-2 items-start">
          <span className="text-xs font-semibold pt-2 w-12 shrink-0">{s.numero}</span>
          <Textarea
            rows={Math.max(2, Math.ceil(s.texto.length / 90))}
            value={s.texto}
            onChange={(e) => updateFixSubTexto(cid, s.numero, e.target.value)}
            className="flex-1 text-sm"
          />
        </div>
      );
    }
    if (!s.placeholders) {
      return <p key={s.numero} className="text-sm leading-relaxed whitespace-pre-wrap"><span className="font-semibold">{s.numero}) </span>{s.texto.replace(new RegExp(`^${s.numero.replace(/\./g, "\\.")}\\)\\s*`), "")}</p>;
    }
    // Split by {{KEY}} tokens
    const parts: Array<{ type: "text" | "field"; value: string }> = [];
    const re = /\{\{(\w+)\}\}/g;
    let last = 0; let m: RegExpExecArray | null;
    while ((m = re.exec(s.texto)) !== null) {
      if (m.index > last) parts.push({ type: "text", value: s.texto.slice(last, m.index) });
      parts.push({ type: "field", value: m[1] });
      last = m.index + m[0].length;
    }
    if (last < s.texto.length) parts.push({ type: "text", value: s.texto.slice(last) });
    return (
      <p key={s.numero} className="text-sm leading-relaxed">
        {parts.map((p, i) =>
          p.type === "text" ? (
            <span key={i} className="whitespace-pre-wrap">{p.value}</span>
          ) : (
            <Input
              key={i}
              className="inline-block w-32 mx-1 h-7 px-2 py-0 align-middle"
              value={s.placeholders?.[p.value] ?? ""}
              onChange={(e) => updateFixPh(cid, s.numero, p.value, e.target.value)}
              placeholder={p.value}
              type={p.value === "ANO" ? "number" : "text"}
            />
          ),
        )}
      </p>
    );
  };


  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
      <div className="space-y-6">
        {/* Importar contrato — sempre no topo */}
        <div className="flex justify-end">
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImportDocx(f);
            }}
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={loading}>
            <Upload className="h-4 w-4" /> Editar Contrato Existente
          </Button>
        </div>

        {/* Quadro de Resumo */}
        <Card>
          <CardHeader><CardTitle>Quadro de Resumo</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Número do Contrato</Label>
              <Input value={form.numeroContrato ?? ""} onChange={(e) => setForm({ ...form, numeroContrato: e.target.value })} placeholder="Ex: 001/2026" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* CONTRATANTE */}
              <div className="border-2 rounded-md p-4 space-y-3 bg-card">
                <p className="font-bold text-sm text-primary border-b pb-2">A) CONTRATANTE</p>
                <div className="space-y-2">
                  <Label className="text-xs">Nome / Razão Social</Label>
                  <Input value={form.contratanteNome} onChange={(e) => setForm({ ...form, contratanteNome: e.target.value })} placeholder="Ex: INDUSTRIA BRASILEIRA LTDA" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Endereço</Label>
                  <Textarea rows={2} value={form.contratanteEndereco} onChange={(e) => setForm({ ...form, contratanteEndereco: e.target.value })} placeholder="Rua, número - bairro - cidade - UF" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">CNPJ</Label>
                  <Input value={form.contratanteCnpj} onChange={(e) => setForm({ ...form, contratanteCnpj: e.target.value })} placeholder="00.000.000/0000-00" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Inscrição Estadual</Label>
                  <Input value={form.contratanteIE} onChange={(e) => setForm({ ...form, contratanteIE: e.target.value })} />
                </div>
              </div>
              {/* CONTRATADA */}
              <div className="border-2 rounded-md p-4 space-y-3 bg-muted/30">
                <p className="font-bold text-sm text-primary border-b pb-2">CONTRATADA</p>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(CONTRATADAS) as Array<keyof typeof CONTRATADAS>).map((k) => (
                    <Button
                      key={k}
                      size="sm"
                      type="button"
                      variant={form.contratadaKey === k ? "default" : "outline"}
                      onClick={() => setForm({
                        ...form,
                        contratadaKey: k,
                        contratadaNome: CONTRATADAS[k].nome,
                        contratadaCnpj: CONTRATADAS[k].cnpj,
                        contratadaEndereco: CONTRATADAS[k].endereco,
                      })}
                    >
                      {CONTRATADAS[k].label}
                    </Button>
                  ))}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Razão Social</Label>
                  <p className="text-sm font-medium">{form.contratadaNome}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">CNPJ</Label>
                  <p className="text-sm">{form.contratadaCnpj}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Endereço</Label>
                  <p className="text-sm">{form.contratadaEndereco}</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>B.1) Descrição de Serviços</Label>
              <Textarea rows={2} value={form.descricaoServicos} onChange={(e) => setForm({ ...form, descricaoServicos: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>B.2) Local da Prestação</Label>
                <Input value={form.localPrestacao} onChange={(e) => setForm({ ...form, localPrestacao: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>B.3) Documentos Aplicáveis</Label>
                <Input value={form.documentosAplicaveis} onChange={(e) => setForm({ ...form, documentosAplicaveis: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>C) Vigência</Label>
                <Input value={form.vigencia} onChange={(e) => setForm({ ...form, vigencia: e.target.value })} placeholder="Ex: 03 (TRÊS meses)" />
              </div>
              <div className="space-y-2">
                <Label>D) Preço Total (R$)</Label>
                <Input value={form.precoTotal} onChange={(e) => setForm({ ...form, precoTotal: e.target.value })} placeholder="Ex: 4.000,00" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>D) Preço Total (por extenso) — auto</Label>
                <Input value={form.precoExtenso} readOnly className="bg-muted" placeholder="Preenchido automaticamente a partir do valor numérico" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>E) Forma de Pagamento</Label>
                <Input value={form.formaPagamento} onChange={(e) => setForm({ ...form, formaPagamento: e.target.value })} placeholder="Ex: 10 DDL. Após fechamento do mês" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cláusulas */}
        <div className="flex justify-end">
          {editandoClausulas ? (
            <Button
              size="sm"
              onClick={() => { setEditandoClausulas(false); toast.success("Alterações nas cláusulas salvas"); }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Check className="h-4 w-4" /> Salvar alterações
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setEditandoClausulas(true)}>
              <Pencil className="h-4 w-4" /> Editar Cláusulas
            </Button>
          )}
        </div>

        {form.clausulas.map((c) => (
          <Card key={c.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">
                {c.fixo ? (
                  <>CLÁUSULA {c.numero} — {c.titulo}</>
                ) : (
                  <div className="flex items-center gap-2">
                    <span>CLÁUSULA {c.numero} —</span>
                    <Input
                      value={c.titulo}
                      onChange={(e) => updateClause(c.id, { titulo: e.target.value })}
                      className="h-8 w-72"
                      placeholder="Título da cláusula"
                    />
                  </div>
                )}
              </CardTitle>
              {!c.fixo && (
                <Button size="icon" variant="ghost" onClick={() => removeClausula(c.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {c.fixo ? (
                (c.subclausulasFixas ?? []).map((s) => renderFixSub(c.id, s))
              ) : (
                <Textarea
                  rows={4}
                  value={c.corpo ?? ""}
                  onChange={(e) => updateClause(c.id, { corpo: e.target.value })}
                  placeholder="Texto da cláusula adicional"
                />
              )}

              {c.subclausulasExtras.map((s, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <Input
                    value={s.numero}
                    onChange={(e) => updateSub(c.id, i, { numero: e.target.value })}
                    className="w-20 h-9"
                  />
                  <Textarea
                    rows={2}
                    value={s.texto}
                    onChange={(e) => updateSub(c.id, i, { texto: e.target.value })}
                    placeholder="Texto da subcláusula"
                    className="flex-1"
                  />
                  <Button size="icon" variant="ghost" onClick={() => removeSub(c.id, i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <Button size="sm" variant="ghost" onClick={() => addSub(c.id)} className="text-xs">
                <Plus className="h-3 w-3" /> Adicionar Subcláusula
              </Button>
            </CardContent>
          </Card>
        ))}

        <div className="flex justify-center">
          <Button variant="outline" onClick={addClausula}>
            <Plus className="h-4 w-4" /> Adicionar Cláusula Adicional
          </Button>
        </div>

        {/* Anexo I */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Anexo I — Descrição dos Equipamentos</CardTitle>
            <Button size="sm" variant="outline" onClick={addEquip}>
              <Plus className="h-4 w-4" /> Equipamento
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {form.equipamentos.map((eq, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-start">
                <div className="col-span-8 space-y-1">
                  <Label className="text-xs">Descrição</Label>
                  <Textarea
                    rows={2}
                    value={eq.descricao}
                    onChange={(e) => updateEquip(i, { descricao: e.target.value })}
                    placeholder="Ex: 01 empilhadeira GLP, capacidade 2500kg, torre triplex..."
                  />
                </div>
                <div className="col-span-3 space-y-1">
                  <Label className="text-xs">Valor Mercado Unit.</Label>
                  <Input
                    value={eq.valorUnitario}
                    onChange={(e) => updateEquip(i, { valorUnitario: e.target.value })}
                    placeholder="Ex: R$ 100.000,00 (cem mil reais)"
                  />
                </div>
                <div className="col-span-1 pt-6">
                  <Button size="icon" variant="ghost" onClick={() => removeEquip(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Assinaturas */}
        <Card>
          <CardHeader><CardTitle>Assinaturas</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Cidade / Local</Label>
                <Input
                  value={form.cidadeAssinatura ?? ""}
                  onChange={(e) => setForm({ ...form, cidadeAssinatura: e.target.value })}
                  placeholder="Ex: Santo André"
                />
              </div>
              <div className="space-y-2">
                <Label>Data da Assinatura</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !form.dataAssinaturaIso && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="h-4 w-4" />
                      {form.dataAssinaturaIso
                        ? formatDataExtenso(form.dataAssinaturaIso)
                        : "Selecionar data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={form.dataAssinaturaIso ? new Date(form.dataAssinaturaIso + "T00:00:00") : undefined}
                      onSelect={(d) => {
                        if (!d) { setForm({ ...form, dataAssinaturaIso: "" }); return; }
                        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                        setForm({ ...form, dataAssinaturaIso: iso });
                      }}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            {form.dataAssinatura && (
              <p className="text-xs text-muted-foreground">
                No contrato será exibido como: <span className="font-medium text-foreground">{form.dataAssinatura}</span>
              </p>
            )}


            <div className="border rounded p-3 space-y-3">
              <p className="font-semibold text-sm">CONTRATANTE (Pessoa Jurídica)</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Razão Social (do quadro)</Label>
                  <Input value={form.contratanteNome} readOnly className="bg-muted" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">CNPJ (do quadro)</Label>
                  <Input value={form.contratanteCnpj} readOnly className="bg-muted" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Representante Legal</Label>
                  <Input value={form.contratanteRepresentante ?? ""} onChange={(e) => setForm({ ...form, contratanteRepresentante: e.target.value })} placeholder="Nome do representante" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Cargo / Função</Label>
                  <Input value={form.contratanteCargo ?? ""} onChange={(e) => setForm({ ...form, contratanteCargo: e.target.value })} placeholder="Ex: Diretor, Sócio-Administrador" />
                </div>
              </div>
            </div>


            <div className="border rounded p-3 space-y-1 bg-muted/30">
              <p className="font-semibold text-sm">CONTRATADA</p>
              <p className="text-sm">{form.contratadaNome}</p>
              <p className="text-xs text-muted-foreground">CNPJ {form.contratadaCnpj} — {form.contratadaEndereco}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="border rounded p-3 space-y-3">
                <p className="font-semibold text-sm">TESTEMUNHA 1</p>
                <div className="space-y-1"><Label className="text-xs">Nome</Label><Input value={form.testemunha1Nome} onChange={(e) => setForm({ ...form, testemunha1Nome: e.target.value })} /></div>
                <div className="space-y-1"><Label className="text-xs">RG</Label><Input value={form.testemunha1Rg} onChange={(e) => setForm({ ...form, testemunha1Rg: e.target.value })} /></div>
              </div>
              <div className="border rounded p-3 space-y-3">
                <p className="font-semibold text-sm">TESTEMUNHA 2</p>
                <div className="space-y-1"><Label className="text-xs">Nome</Label><Input value={form.testemunha2Nome} onChange={(e) => setForm({ ...form, testemunha2Nome: e.target.value })} /></div>
                <div className="space-y-1"><Label className="text-xs">RG</Label><Input value={form.testemunha2Rg} onChange={(e) => setForm({ ...form, testemunha2Rg: e.target.value })} /></div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2 justify-end">
          <Button variant="outline" onClick={novo}><RotateCcw className="h-4 w-4" /> Novo</Button>
          <Button onClick={handleSave} disabled={loading}>
            <Save className="h-4 w-4" /> {id ? "Atualizar Contrato" : "Salvar Contrato"}
          </Button>
          <Button variant="default" onClick={handleGenerateDoc} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <FileDown className="h-4 w-4" /> {loading ? "Gerando..." : "Gerar Contrato (Word)"}
          </Button>
        </div>


      </div>

      {/* Saved list */}
      <aside className="space-y-3">
        <Card>
          <CardHeader><CardTitle className="text-base">Contratos Salvos</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-[70vh] overflow-auto">
            {salvos.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhum contrato salvo.</p>
            )}
            {salvos.map((s) => (
              <div key={s.id} className={`border rounded p-2 text-sm ${id === s.id ? "border-primary bg-muted/40" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <button onClick={() => handleOpen(s.id)} className="text-left flex-1 hover:underline">
                    <div className="font-medium flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      <span className="line-clamp-1">{s.contractor_name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(s.created_at).toLocaleDateString("pt-BR")}
                    </div>
                  </button>
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(s.id)} className="h-7 w-7">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
