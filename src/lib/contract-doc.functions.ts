import { createServerFn } from "@tanstack/react-start";

type SubFix = { numero: string; texto: string; placeholders?: Record<string, string> };
type SubExtra = { numero: string; texto: string };
type Clause = {
  id: string;
  numero: string;
  titulo: string;
  fixo: boolean;
  corpo?: string;
  subclausulasFixas?: SubFix[];
  subclausulasExtras: SubExtra[];
};
type Equipamento = { descricao: string; valorUnitario: string };

export type ContratoDocInput = {
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
  clausulas: Clause[];
  equipamentos: Equipamento[];
  contratanteAssinNome: string;
  contratanteAssinRg: string;
  contratanteAssinCpf: string;
  testemunha1Nome: string;
  testemunha1Rg: string;
  testemunha2Nome: string;
  testemunha2Rg: string;
  dataAssinatura: string;
};

function applyPh(texto: string, ph?: Record<string, string>): string {
  if (!ph) return texto;
  return texto.replace(/\{\{(\w+)\}\}/g, (_, k) => ph[k] ?? `{{${k}}}`);
}

export const generateContractDoc = createServerFn({ method: "POST" })
  .inputValidator((d: ContratoDocInput) => d)
  .handler(async ({ data }) => {
    const {
      Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
      AlignmentType, WidthType, BorderStyle, HeightRule, Footer,
    } = await import("docx");

    const FONT = "Arial";
    const t = (text: string, opts: Record<string, unknown> = {}) =>
      new TextRun({ text, font: FONT, size: 20, ...opts });
    const p = (children: any[], opts: Record<string, unknown> = {}) =>
      new Paragraph({ children, ...opts });

    const border = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
    const cellBorders = { top: border, bottom: border, left: border, right: border };

    const cell = (children: any[], w: number, opts: { bold?: boolean; shade?: string } = {}) =>
      new TableCell({
        borders: cellBorders,
        width: { size: w, type: WidthType.DXA },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        ...(opts.shade ? { shading: { fill: opts.shade, type: "clear", color: "auto" } as any } : {}),
        children: children.map((c) => (typeof c === "string" ? p([t(c, { bold: opts.bold })]) : c)),
      });

    // ============ Quadro Resumo ============
    const labelW = 2400;
    const valueW = 6960;
    const resumoRows: InstanceType<typeof TableRow>[] = [
      new TableRow({
        children: [
          cell(["QUADRO RESUMO"], labelW + valueW, { bold: true, shade: "D9D9D9" }),
        ],
      }),
      new TableRow({
        children: [
          cell(["A) CONTRATANTE"], labelW, { bold: true }),
          cell([
            p([t(data.contratanteNome, { bold: true })]),
            p([t(data.contratanteEndereco)]),
            p([t(`CNPJ: ${data.contratanteCnpj}     I.E.: ${data.contratanteIE}`)]),
          ], valueW),
        ],
      }),
      new TableRow({
        children: [
          cell(["B.1) DESCRIÇÃO DOS SERVIÇOS"], labelW, { bold: true }),
          cell([data.descricaoServicos], valueW),
        ],
      }),
      new TableRow({
        children: [
          cell(["B.2) LOCAL DA PRESTAÇÃO"], labelW, { bold: true }),
          cell([data.localPrestacao], valueW),
        ],
      }),
      new TableRow({
        children: [
          cell(["B.3) DOCUMENTOS APLICÁVEIS"], labelW, { bold: true }),
          cell([data.documentosAplicaveis], valueW),
        ],
      }),
      new TableRow({
        children: [
          cell(["C) VIGÊNCIA"], labelW, { bold: true }),
          cell([data.vigencia], valueW),
        ],
      }),
      new TableRow({
        children: [
          cell(["D) PREÇO TOTAL"], labelW, { bold: true }),
          cell([
            p([t(`R$ ${data.precoTotal}`, { bold: true })]),
            p([t(`(${data.precoExtenso})`)]),
          ], valueW),
        ],
      }),
      new TableRow({
        children: [
          cell(["E) FORMA DE PAGAMENTO"], labelW, { bold: true }),
          cell([data.formaPagamento], valueW),
        ],
      }),
    ];

    const quadroResumo = new Table({
      width: { size: labelW + valueW, type: WidthType.DXA },
      columnWidths: [labelW, valueW],
      rows: resumoRows,
    });

    // ============ Cláusulas ============
    const clausulasParas: any[] = [];
    for (const c of data.clausulas) {
      clausulasParas.push(
        p([t(`CLÁUSULA ${c.numero} — ${c.titulo}`, { bold: true })], {
          spacing: { before: 240, after: 120 },
        }),
      );
      if (c.fixo) {
        for (const s of c.subclausulasFixas ?? []) {
          clausulasParas.push(
            p([t(`${s.numero}) `, { bold: true }), t(applyPh(s.texto, s.placeholders).replace(new RegExp(`^${s.numero.replace(/\./g, "\\.")}\\)\\s*`), ""))], {
              alignment: AlignmentType.JUSTIFIED,
              spacing: { after: 100 },
            }),
          );
        }
      } else if (c.corpo) {
        clausulasParas.push(
          p([t(c.corpo)], { alignment: AlignmentType.JUSTIFIED, spacing: { after: 100 } }),
        );
      }
      for (const s of c.subclausulasExtras) {
        clausulasParas.push(
          p([t(`${s.numero}) `, { bold: true }), t(s.texto)], {
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 100 },
          }),
        );
      }
    }

    // ============ Assinaturas ============
    const assin: any[] = [
      p([t(data.dataAssinatura)], { spacing: { before: 480, after: 480 } }),
      p([t("_______________________________________________")]),
      p([t("CONTRATANTE", { bold: true })]),
      p([t(data.contratanteNome, { bold: true })]),
      p([t(`Nome: ${data.contratanteAssinNome}`)]),
      p([t(`RG: ${data.contratanteAssinRg}     CPF: ${data.contratanteAssinCpf}`)], { spacing: { after: 360 } }),
      p([t("_______________________________________________")]),
      p([t("CONTRATADA", { bold: true })]),
      p([t("RENTAL LIFT LOCAÇÃO, MANUTENÇÃO E MOVIMENTAÇÃO DE CARGAS LTDA", { bold: true })]),
      p([t("CNPJ 04.705.697/0001-57 — AV. DOM BOSCO 835, SANTO ANDRÉ-SP")], { spacing: { after: 480 } }),
      p([t("TESTEMUNHAS:", { bold: true })], { spacing: { after: 240 } }),
      p([t("1) _______________________________________")]),
      p([t(`Nome: ${data.testemunha1Nome}`)]),
      p([t(`RG: ${data.testemunha1Rg}`)], { spacing: { after: 240 } }),
      p([t("2) _______________________________________")]),
      p([t(`Nome: ${data.testemunha2Nome}`)]),
      p([t(`RG: ${data.testemunha2Rg}`)]),
    ];

    // ============ Anexo I ============
    const anexoRows: InstanceType<typeof TableRow>[] = [
      new TableRow({
        tableHeader: true,
        children: [
          cell(["DESCRIÇÃO"], 6000, { bold: true, shade: "D9D9D9" }),
          cell(["VALOR DE MERCADO UNITÁRIO"], 3360, { bold: true, shade: "D9D9D9" }),
        ],
      }),
      ...data.equipamentos.map(
        (eq) =>
          new TableRow({
            children: [
              cell([eq.descricao], 6000),
              cell([eq.valorUnitario], 3360),
            ],
          }),
      ),
    ];
    const anexoTable = new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [6000, 3360],
      rows: anexoRows,
    });

    const doc = new Document({
      styles: { default: { document: { run: { font: FONT, size: 20 } } } },
      sections: [
        {
          properties: {
            page: {
              size: { width: 11906, height: 16838 },
              margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
            },
          },
          footers: {
            default: new Footer({
              children: [
                p([t("Contrato de Locação - Rental Lift", { size: 16 })], {
                  alignment: AlignmentType.CENTER,
                }),
              ],
            }),
          },
          children: [
            p([t("CONTRATO DE LOCAÇÃO DE EQUIPAMENTOS", { bold: true, size: 28 })], {
              alignment: AlignmentType.CENTER,
              spacing: { after: 360 },
            }),
            quadroResumo,
            p([t("")], { spacing: { after: 240 } }),
            ...clausulasParas,
            p([t("")], { spacing: { before: 360 } }),
            ...assin,
            p([t("ANEXO I — DESCRIÇÃO DOS EQUIPAMENTOS", { bold: true, size: 24 })], {
              alignment: AlignmentType.CENTER,
              spacing: { before: 600, after: 240 },
              pageBreakBefore: true,
            }),
            anexoTable,
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    return {
      filename: `Contrato_${(data.contratanteNome || "contratante").replace(/[^a-zA-Z0-9]+/g, "_")}.docx`,
      base64: Buffer.from(buffer).toString("base64"),
    };
  });
