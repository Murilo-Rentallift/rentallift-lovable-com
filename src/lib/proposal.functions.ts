import { createServerFn } from "@tanstack/react-start";
import { PROPOSAL_LOGOS_B64 } from "./assets/proposal-logos";

export type EquipDesc = {
  tipo: string;
  combustivel: string;
  capacidade: string;
  tipoTorre: string;
  alturaFechada: string;
  alturaAberta: string;
  acessorioTorre: string;
  garfos: string;
  tipoPneus: string;
  itensSeguranca: string;
  quantidade: string;
};

export type ProposalInput = {
  data: string;
  cliente: string;
  responsavel: string;
  equipamentos: EquipDesc[];
  itensValor: Array<{
    quant: string;
    equipamento: string;
    valorUnitario: string;
    valorTotal: string;
  }>;
  valorTotalMensal: string;
  valorTotalExtenso: string;
  prazoEntrega: string;
  periodoContrato: string;
  condicoesPagamento: string;
  validadeProposta: string;
  custoFrete: string;
};

export const generateProposal = createServerFn({ method: "POST" })
  .inputValidator((data: ProposalInput) => data)
  .handler(async ({ data }) => {
    const {
      Document,
      Packer,
      Paragraph,
      TextRun,
      Table,
      TableRow,
      TableCell,
      Header,
      Footer,
      AlignmentType,
      WidthType,
      BorderStyle,
      ShadingType,
      PageBreak,
      ImageRun,
    } = await import("docx");

    const logoBuffer = Buffer.from(PROPOSAL_LOGOS_B64, "base64");
    const headerImage = new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new ImageRun({
          type: "png",
          data: logoBuffer,
          transformation: { width: 480, height: 88 },
        } as never),
      ],
    });

    const FONT = "Century Gothic";

    const t = (text: string, opts: Record<string, unknown> = {}) =>
      new TextRun({ text, font: FONT, size: 19, ...opts });
    const p = (children: any[], opts: Record<string, unknown> = {}) =>
      new Paragraph({ children, ...opts });

    const border = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
    const cellBorders = { top: border, bottom: border, left: border, right: border };

    const equipRow = (label: string, value: string, valueLine2?: string) =>
      new TableRow({
        children: [
          new TableCell({
            borders: cellBorders,
            width: { size: 3600, type: WidthType.DXA },
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            children: [p([t(label, { bold: true })])],
          }),
          new TableCell({
            borders: cellBorders,
            width: { size: 5760, type: WidthType.DXA },
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            children: valueLine2
              ? [p([t(value)]), p([t(valueLine2)])]
              : [p([t(value)])],
          }),
        ],
      });

    const buildEquipTable = (eq: EquipDesc) =>
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [3600, 5760],
        rows: [
          equipRow("TIPO", eq.tipo),
          equipRow("COMBUSTÍVEL", eq.combustivel),
          equipRow("CAPACIDADE", eq.capacidade),
          equipRow("TIPO TORRE", eq.tipoTorre),
          equipRow("ALTURA (fechada / aberta) mm", eq.alturaFechada, eq.alturaAberta),
          equipRow("ACESSÓRIO TORRE", eq.acessorioTorre),
          equipRow("GARFOS (mm)", eq.garfos),
          equipRow("TIPO PNEUS", eq.tipoPneus),
          equipRow("ITENS SEGURANÇA", eq.itensSeguranca),
          equipRow("QUANTIDADE", eq.quantidade),
        ],
      });

    const headerCell = (text: string, w: number) =>
      new TableCell({
        borders: cellBorders,
        width: { size: w, type: WidthType.DXA },
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
        shading: { fill: "D9D9D9", type: ShadingType.CLEAR, color: "auto" },
        children: [p([t(text, { bold: true })], { alignment: AlignmentType.CENTER })],
      });
    const dataCell = (text: string, w: number) =>
      new TableCell({
        borders: cellBorders,
        width: { size: w, type: WidthType.DXA },
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
        children: [p([t(text)], { alignment: AlignmentType.CENTER })],
      });

    const valoresRows: InstanceType<typeof TableRow>[] = [
      new TableRow({
        tableHeader: true,
        children: [
          headerCell("QUANT.", 1400),
          headerCell("EQUIPAMENTO", 4360),
          headerCell("VALOR UNITARIO", 1800),
          headerCell("VALOR TOTAL", 1800),
        ],
      }),
      ...data.itensValor.map(
        (it) =>
          new TableRow({
            children: [
              dataCell(it.quant, 1400),
              dataCell(it.equipamento, 4360),
              dataCell(`R$${it.valorUnitario}`, 1800),
              dataCell(`R$${it.valorTotal}`, 1800),
            ],
          }),
      ),
    ];

    const valoresTable = new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [1400, 4360, 1800, 1800],
      rows: valoresRows,
    });

    const bullet = (text: string) =>
      p([t("- " + text)], { indent: { left: 360 } });

    const sectionTitle = (n: number, text: string) =>
      p([t(`${n}) ${text.toUpperCase()}`, { bold: true })], {
        spacing: { before: 240, after: 120 },
      });

    const subItem = (text: string) =>
      p([t(text, { bold: true })], { indent: { left: 360 }, spacing: { before: 120, after: 60 } });
    const subValue = (text: string) =>
      p([t(text)], { indent: { left: 360 }, spacing: { after: 120 } });

    const footerPara = p(
      [
        t("Doc.010 – Proposta de Locação | Revisão: 00 | Data da revisão: 13/08/2025", {
          size: 18,
          bold: true,
        }),
      ],
      { alignment: AlignmentType.CENTER },
    );

    const equipmentBlocks: any[] = [];
    data.equipamentos.forEach((eq, i) => {
      if (i > 0) {
        equipmentBlocks.push(
          p([t(`Equipamento ${i + 1}`, { bold: true })], { spacing: { before: 200, after: 80 } }),
        );
      } else if (data.equipamentos.length > 1) {
        equipmentBlocks.push(
          p([t(`Equipamento ${i + 1}`, { bold: true })], { spacing: { before: 0, after: 80 } }),
        );
      }
      equipmentBlocks.push(buildEquipTable(eq));
    });

    const doc = new Document({
      styles: {
        default: { document: { run: { font: FONT, size: 19 } } },
      },
      sections: [
        {
          properties: {
            page: {
              size: { width: 11906, height: 16838 },
              margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
            },
          },
          headers: {
            default: new Header({ children: [headerImage] }),
          },
          footers: {
            default: new Footer({ children: [footerPara] }),
          },
          children: [
            p([t(`Santo André, ${data.data}`)], { spacing: { after: 240 } }),
            p([t("A")]),
            p([t(data.cliente.toUpperCase())]),
            p([t(`A/C.: ${data.responsavel.toUpperCase()}`)], { spacing: { after: 120 } }),
            p([t("REF.: Proposta locação de empilhadeira", { bold: true })], {
              spacing: { after: 240 },
            }),
            p(
              [
                t(
                  "Conforme solicitação, apresentamos nossa proposta técnica / comercial de locação de equipamentos, como segue abaixo:",
                ),
              ],
              { alignment: AlignmentType.JUSTIFIED, spacing: { after: 240 } },
            ),

            sectionTitle(1, "Descrição do Equipamento:"),
            ...equipmentBlocks,

            sectionTitle(2, "São por conta da CONTRATANTE:"),
            bullet("Operador habilitado e suas respectivas obrigações e responsabilidades."),
            bullet("Combustível para o equipamento e seu controle de quantidade / qualidade."),
            bullet("Água de Bateria – aquisição e reposição (para equipamentos elétricos com bateria de chumbo)."),
            bullet("Seguir ciclo de carregamento correto para equipamentos elétricos."),
            bullet("Não operar equipamentos de Litio com menos de 20% de bateria (perigo de descarga profunda)."),
            bullet("Serviços de Borracharia (para equipamentos com pneu de Câmara de ar)."),
            bullet("Zelar pelo equipamento e se responsabilizar por sua guarda no período de locação."),
            bullet("Custear frete de ida e volta em caminhão plataforma com seguro."),
            p([t("Obs.: pode ser indicado ou contratado pela contratada e repassado custos.")], {
              indent: { left: 720 },
            }),
            bullet("Fornecer local coberto para manutenções com pontos de água e eletricidade."),
            bullet("Controlar as horas faltantes para manutenções preventivas e acionar a assistência técnica (100hs antes)."),

            sectionTitle(3, "São por conta da CONTRATADA:"),
            bullet("Salários, encargos, EPIs e uniformes para seus colaboradores."),
            bullet("Seguir normas e procedimentos da contratante, desde que as mesmas sejam passadas para conhecimento."),
            bullet("Comunicar por escrito qualquer irregularidade observada por nosso técnico na operação do equipamento."),
            bullet("Arcar com toda a manutenção preventiva do equipamento, feita em data previamente combinada."),
            bullet("Arcar com toda a manutenção corretiva do equipamento, exceto em casos de mal-uso ou erro de operação."),
            bullet("Arcar com custos de troca de pneus por desgaste, exceto em casos de mal-uso ou erro de operação."),

            sectionTitle(4, "Condições Comerciais"),
            p([t("- VALOR", { bold: true })], { indent: { left: 360 }, spacing: { after: 120 } }),
            valoresTable,
            p(
              [t(`Valor total mensal – R$ ${data.valorTotalMensal} ( ${data.valorTotalExtenso} )`)],
              { spacing: { before: 120, after: 240 } },
            ),

            subItem("- PRAZO DE ENTREGA DOS EQUIPAMENTOS:"),
            subValue(data.prazoEntrega),
            subItem("- PERÍODO DE CONTRATO:"),
            subValue(data.periodoContrato),
            subItem("- CONDIÇÕES DE PAGAMENTO"),
            subValue(data.condicoesPagamento),
            subItem("- VALIDADE DA PROPOSTA:"),
            subValue(data.validadeProposta),
            subItem("- CUSTO DE FRETE:"),
            subValue(data.custoFrete),

            p(
              [
                t(
                  "Obs.: Em casos de empilhadeiras que necessitem ser transportadas com torre desmontada, o cliente deverá fornecer empilhadeira para montagem da mesma com capacidade e altura necessárias ou transporte com caminhão Munck.",
                ),
              ],
              { alignment: AlignmentType.JUSTIFIED, spacing: { before: 240, after: 240 } },
            ),

            p([new PageBreak()]),

            p([t("ÁREA DO CLIENTE", { bold: true, size: 24 })], {
              alignment: AlignmentType.CENTER,
              spacing: { before: 240, after: 480 },
            }),
            p([t("De acordo:")], { spacing: { after: 720 } }),
            p([t("_________________________.                        ____________________________________")]),
            p([t("ASSINATURA                                                                NOME LEGÍVEL")], {
              spacing: { after: 720 },
            }),

            p([t("Rental Lift Locação, Manutenção e Movimentação de Cargas Ltda", { bold: true })], {
              alignment: AlignmentType.CENTER,
              spacing: { before: 480 },
            }),
            p([t("Empisa Empilhadeiras Santo André Locação e Movimentação de Cargas Ltda", { bold: true })], {
              alignment: AlignmentType.CENTER,
            }),
            p([t("RLE Locação e Transportes de Equipamentos Ltda", { bold: true })], {
              alignment: AlignmentType.CENTER,
              spacing: { after: 240 },
            }),
            p([t("Telefone: (11) 4975-9100")], { alignment: AlignmentType.CENTER }),
            p([t("Site: www.rentallift.com")], { alignment: AlignmentType.CENTER }),
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    return {
      filename: `Proposta_${data.cliente.replace(/[^a-zA-Z0-9]+/g, "_")}.docx`,
      base64: Buffer.from(buffer).toString("base64"),
    };
  });
