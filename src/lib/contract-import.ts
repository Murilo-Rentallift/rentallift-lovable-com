import mammoth from "mammoth";
import JSZip from "jszip";

type Equipamento = { descricao: string; valorUnitario: string };
type ExtraSub = { numero: string; texto: string };
type ImportedClause = {
  numero: string;
  titulo: string;
  corpo: string;
  subclausulasExtras: ExtraSub[];
};

export type ImportedContract = {
  numeroContrato?: string;
  contratanteNome?: string;
  contratanteEndereco?: string;
  contratanteCnpj?: string;
  contratanteIE?: string;
  descricaoServicos?: string;
  localPrestacao?: string;
  documentosAplicaveis?: string;
  vigencia?: string;
  precoTotal?: string;
  precoExtenso?: string;
  formaPagamento?: string;
  dataAssinatura?: string;
  cidadeAssinatura?: string;
  dataAssinaturaIso?: string;
  contratanteRepresentante?: string;
  contratanteCargo?: string;
  contratanteAssinNome?: string;
  contratanteAssinRg?: string;
  contratanteAssinCpf?: string;
  testemunha1Nome?: string;
  testemunha1Rg?: string;
  testemunha2Nome?: string;
  testemunha2Rg?: string;
  contratadaNome?: string;
  contratadaCnpj?: string;
  contratadaEndereco?: string;
  equipamentos?: Equipamento[];
  clausulasExtras?: ImportedClause[];
};

type GridRow = string[];

const MONTHS: Record<string, string> = {
  janeiro: "01",
  fevereiro: "02",
  março: "03",
  marco: "03",
  abril: "04",
  maio: "05",
  junho: "06",
  julho: "07",
  agosto: "08",
  setembro: "09",
  outubro: "10",
  novembro: "11",
  dezembro: "12",
};

const CONTRATADA_HINTS = [
  {
    nome: "RENTAL LIFT LOCAÇÃO, MANUTENÇÃO E MOVIMENTAÇÃO DE CARGAS LTDA",
    cnpj: "04.705.697/0001-57",
    endereco: "AV. DOM BOSCO, 835, SANTO ANDRÉ, SÃO PAULO",
  },
  {
    nome: "RLE LOCACAO E TRANSPORTE DE EQUIPAMENTOS LTDA",
    cnpj: "14.989.985/0001-34",
    endereco: "AV DOM BOSCO, 1050, VILA LUCINDA, SANTO ANDRÉ, SÃO PAULO",
  },
  {
    nome: "EMPISA EMPILHADEIRAS SANTO ANDRE LOCACAO E MOVIMENTACAO DE CARGAS LTDA",
    cnpj: "09.449.084/0001-10",
    endereco: "AV DOM BOSCO, 84, VILA LUCINDA, SANTO ANDRÉ, SÃO PAULO",
  },
];

const norm = (s: string): string =>
  s
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();

const oneLine = (s: string): string => norm(s).replace(/\s+/g, " ").trim();

const stripLabel = (s: string): string =>
  oneLine(s)
    .replace(/^(?:[A-Z](?:\.\d)?\)|[A-Z]\.\d\)|D\)|E\)|C\))\s*/i, "")
    .replace(/^(?:CONTRATANTE|CONTRATADA|DESCRI[ÇC][ÃA]O DOS SERVI[ÇC]OS|LOCAL DA PRESTA[ÇC][ÃA]O|DOCUMENTOS APLIC[ÁA]VEIS|VIG[ÊE]NCIA|PRE[ÇC]O TOTAL|FORMA DE PAGAMENTO)\s*:?\s*/i, "")
    .trim();

const keyOf = (s: string): string =>
  oneLine(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

const cleanFieldValue = (value: string): string =>
  norm(value)
    .replace(/^[:\-–—]+\s*/, "")
    .replace(/^(?:NOME|RAZ[ÃA]O SOCIAL|ENDERE[ÇC]O|CNPJ|I\.?E\.?|INSCRI[ÇC][ÃA]O ESTADUAL|REPRESENTANTE LEGAL|CARGO\/?FUN[ÇC][ÃA]O|CARGO|FUN[ÇC][ÃA]O|RG|CPF)\s*:?\s*/i, "")
    .trim();

const afterColon = (s: string, label: string | RegExp): string | null => {
  const re = typeof label === "string"
    ? new RegExp("^\\s*" + label + "\\s*:?\\s*(.+)$", "i")
    : label;
  const m = s.match(re);
  return m ? cleanFieldValue(m[1]) : null;
};

function splitTextLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => oneLine(l))
    .filter(Boolean);
}

function uniqueLines(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    if (!out.length || out[out.length - 1] !== line) out.push(line);
  }
  return out;
}

function paragraphTextFromXml(p: Element): string {
  const parts: string[] = [];
  p.querySelectorAll("t, delText").forEach((node) => parts.push(node.textContent ?? ""));
  return oneLine(parts.join(""));
}

function cellTextFromXml(cell: Element): string {
  const parts: string[] = [];
  cell.querySelectorAll("p").forEach((p) => {
    const t = paragraphTextFromXml(p);
    if (t) parts.push(t);
  });
  if (!parts.length) {
    cell.querySelectorAll("t, delText").forEach((node) => parts.push(node.textContent ?? ""));
  }
  return norm(parts.filter(Boolean).join("\n"));
}

function parseWordXml(xml: string): { lines: string[]; tables: GridRow[][] } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "application/xml");
  const lines: string[] = [];
  const tables: GridRow[][] = [];

  doc.querySelectorAll("p").forEach((p) => {
    const text = paragraphTextFromXml(p);
    if (text) lines.push(text);
  });

  doc.querySelectorAll("tbl").forEach((table) => {
    const rows: GridRow[] = [];
    table.querySelectorAll(":scope > tr").forEach((row) => {
      const cells = Array.from(row.querySelectorAll(":scope > tc")).map(cellTextFromXml);
      if (cells.some(Boolean)) rows.push(cells);
    });
    if (rows.length) tables.push(rows);
  });

  return { lines: uniqueLines(lines), tables };
}

async function extractDocxStructure(buf: ArrayBuffer): Promise<{ lines: string[]; tables: GridRow[][] }> {
  const zip = await JSZip.loadAsync(buf);
  const files = Object.keys(zip.files)
    .filter((name) => /^word\/(document|header\d+|footer\d+)\.xml$/.test(name))
    .sort((a, b) => (a.includes("document.xml") ? -1 : b.includes("document.xml") ? 1 : a.localeCompare(b)));

  const allLines: string[] = [];
  const allTables: GridRow[][] = [];
  for (const name of files) {
    const xml = await zip.files[name].async("string");
    const parsed = parseWordXml(xml);
    allLines.push(...parsed.lines);
    allTables.push(...parsed.tables);
  }
  return { lines: uniqueLines(allLines), tables: allTables };
}

function setIf(result: ImportedContract, key: keyof ImportedContract, value?: string | null): void {
  if (!value || Array.isArray(result[key])) return;
  const cleaned = cleanFieldValue(value);
  if (cleaned && !result[key]) (result as Record<string, unknown>)[key] = cleaned;
}

function findCnpj(text: string): string | undefined {
  return text.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/)?.[0];
}

function findCpf(text: string): string | undefined {
  return text.match(/\d{3}\.\d{3}\.\d{3}-\d{2}/)?.[0];
}

function parseDateExtenso(line: string): { dataAssinatura: string; cidadeAssinatura?: string; dataAssinaturaIso?: string } | null {
  const m = oneLine(line).match(/^(.+?),\s*(\d{1,2})\s+de\s+([a-zçãé]+)\s+de\s+(\d{4})$/i);
  if (!m) return null;
  const month = MONTHS[m[3].normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()] ?? MONTHS[m[3].toLowerCase()];
  return {
    dataAssinatura: oneLine(line),
    cidadeAssinatura: oneLine(m[1]),
    dataAssinaturaIso: month ? `${m[4]}-${month}-${m[2].padStart(2, "0")}` : undefined,
  };
}

function mergeMultilineValue(lines: string[], start: number, stop: RegExp, max = 8): string {
  const out: string[] = [];
  for (let i = start; i < lines.length && out.length < max; i++) {
    if (i !== start && stop.test(lines[i])) break;
    out.push(stripLabel(lines[i]));
  }
  return norm(out.filter(Boolean).join("\n"));
}

function parseLabelValueLines(lines: string[], result: ImportedContract): void {
  const stop = /^(QUADRO RESUMO|A\)|B\.?\s*[123]\)|C\)|D\)|E\)|CL[ÁA]USULA|ANEXO|TESTEMUNHAS?:?|CONTRATANTE$|CONTRATADA$|_+$|DESCRI[ÇC][ÃA]O\b|VALOR\b)/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const k = keyOf(line);
    const sameLineValue = (label: RegExp) => {
      const m = line.match(label);
      return m?.[1] ? cleanFieldValue(m[1]) : "";
    };

    setIf(result, "numeroContrato", sameLineValue(/(?:CONTRATO|INSTRUMENTO)\s*(?:N[º°O.]|NUMERO|NÚMERO)?\s*[:\-–—]\s*(.+)$/i));
    setIf(result, "contratanteNome", sameLineValue(/(?:RAZ[ÃA]O SOCIAL|NOME\s*\/\s*RAZ[ÃA]O SOCIAL|CLIENTE)\s*:?\s*(.+)$/i));
    setIf(result, "contratanteEndereco", sameLineValue(/ENDERE[ÇC]O\s*:?\s*(.+)$/i));
    setIf(result, "contratanteCnpj", sameLineValue(/CNPJ\s*:?\s*([\d./-]+)/i));
    setIf(result, "contratanteIE", sameLineValue(/(?:I\.?E\.?|INSCRI[ÇC][ÃA]O ESTADUAL)\s*:?\s*(.+)$/i));
    setIf(result, "contratanteRepresentante", sameLineValue(/REPRESENTANTE LEGAL\s*:?\s*(.+)$/i));
    setIf(result, "contratanteCargo", sameLineValue(/(?:CARGO\s*\/\s*FUN[ÇC][ÃA]O|CARGO|FUN[ÇC][ÃA]O)\s*:?\s*(.+)$/i));
    setIf(result, "contratanteAssinRg", sameLineValue(/RG\s*:?\s*([\w.\/-]+)/i));
    setIf(result, "contratanteAssinCpf", sameLineValue(/CPF\s*:?\s*([\d.-]+)/i));

    if (/^A\)\s*CONTRATANTE/i.test(line) || /^CONTRATANTE$/i.test(line)) {
      const block = mergeMultilineValue(lines, i + 1, stop, 7);
      applyPartyBlock(block, result, "contratante");
    } else if (/^CONTRATADA$/i.test(line) || /^B\)?\s*CONTRATADA/i.test(line)) {
      const block = mergeMultilineValue(lines, i + 1, stop, 5);
      applyPartyBlock(block, result, "contratada");
    } else if (/^B\.?\s*1\)/i.test(line) || k === "B.1) DESCRICAO DOS SERVICOS") {
      setIf(result, "descricaoServicos", sameLineValue(/^B\.?\s*1\)?\s*(?:DESCRI[ÇC][ÃA]O DOS SERVI[ÇC]OS)?\s*:?\s*(.+)$/i) || mergeMultilineValue(lines, i + 1, stop, 6));
    } else if (/^B\.?\s*2\)/i.test(line) || k === "B.2) LOCAL DA PRESTACAO") {
      setIf(result, "localPrestacao", sameLineValue(/^B\.?\s*2\)?\s*(?:LOCAL DA PRESTA[ÇC][ÃA]O)?\s*:?\s*(.+)$/i) || mergeMultilineValue(lines, i + 1, stop, 5));
    } else if (/^B\.?\s*3\)/i.test(line) || k === "B.3) DOCUMENTOS APLICAVEIS") {
      setIf(result, "documentosAplicaveis", sameLineValue(/^B\.?\s*3\)?\s*(?:DOCUMENTOS APLIC[ÁA]VEIS)?\s*:?\s*(.+)$/i) || mergeMultilineValue(lines, i + 1, stop, 5));
    } else if (/^C\)\s*VIG/i.test(line)) {
      setIf(result, "vigencia", sameLineValue(/^C\)?\s*VIG[ÊE]NCIA\s*:?\s*(.+)$/i) || mergeMultilineValue(lines, i + 1, stop, 4));
    } else if (/^D\)\s*PRE/i.test(line)) {
      const value = sameLineValue(/^D\)?\s*PRE[ÇC]O TOTAL\s*:?\s*(.+)$/i) || mergeMultilineValue(lines, i + 1, stop, 4);
      applyPriceBlock(value, result);
    } else if (/^E\)\s*FORMA/i.test(line)) {
      setIf(result, "formaPagamento", sameLineValue(/^E\)?\s*FORMA DE PAGAMENTO\s*:?\s*(.+)$/i) || mergeMultilineValue(lines, i + 1, stop, 6));
    }

    const date = parseDateExtenso(line);
    if (date) {
      setIf(result, "dataAssinatura", date.dataAssinatura);
      setIf(result, "cidadeAssinatura", date.cidadeAssinatura);
      setIf(result, "dataAssinaturaIso", date.dataAssinaturaIso);
    }
  }
}

function applyPartyBlock(block: string, result: ImportedContract, party: "contratante" | "contratada"): void {
  const lines = splitTextLines(block);
  if (!lines.length) return;
  const text = oneLine(block);
  const cnpj = findCnpj(text);
  const addressLine = lines.find((l) => /(?:RUA|AV\.?|AVENIDA|RODOVIA|ESTRADA|ALAMEDA|PRA[ÇC]A|TRAVESSA|N[º°]|BAIRRO|CEP)/i.test(l) && !/CNPJ/i.test(l));
  const ieLine = lines.find((l) => /(?:I\.?E\.?|INSCRI[ÇC][ÃA]O ESTADUAL)/i.test(l));
  const repLine = lines.find((l) => /REPRESENTANTE LEGAL/i.test(l));
  const cargoLine = lines.find((l) => /(?:CARGO|FUN[ÇC][ÃA]O)/i.test(l));
  const nameLine = lines.find((l) => !/^(CNPJ|I\.?E\.?|INSCRI[ÇC][ÃA]O|ENDERE[ÇC]O|REPRESENTANTE|CARGO|FUN[ÇC][ÃA]O|RG|CPF)/i.test(l) && !findCnpj(l) && l !== addressLine);

  if (party === "contratante") {
    setIf(result, "contratanteNome", nameLine);
    setIf(result, "contratanteEndereco", addressLine);
    setIf(result, "contratanteCnpj", cnpj);
    setIf(result, "contratanteIE", ieLine ? afterColon(ieLine, /(?:I\.?E\.?|INSCRI[ÇC][ÃA]O ESTADUAL)\s*:?\s*(.+)$/i) : undefined);
    setIf(result, "contratanteRepresentante", repLine ? afterColon(repLine, "Representante Legal") : undefined);
    setIf(result, "contratanteCargo", cargoLine ? afterColon(cargoLine, /(?:Cargo\s*\/?\s*Fun[çc][ãa]o|Cargo|Fun[çc][ãa]o)\s*:?\s*(.+)$/i) : undefined);
  } else {
    setIf(result, "contratadaNome", nameLine);
    setIf(result, "contratadaEndereco", addressLine);
    setIf(result, "contratadaCnpj", cnpj);
  }
}

function applyPriceBlock(block: string, result: ImportedContract): void {
  const text = oneLine(block);
  const price = text.match(/R\$\s*([\d.]+,\d{2}|[\d.,]+)/i)?.[1];
  if (price) setIf(result, "precoTotal", price);
  const extenso = text.match(/\(([^()]+(?:reais|centavos)[^()]*)\)/i)?.[1];
  if (extenso) setIf(result, "precoExtenso", extenso);
  if (!price && text) setIf(result, "precoTotal", text);
}

function parseHtml(html: string, result: ImportedContract): { lines: string[]; tables: GridRow[][] } {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const lines = splitTextLines(doc.body?.innerText ?? doc.body?.textContent ?? "");
  const tables: GridRow[][] = [];

  Array.from(doc.querySelectorAll("table")).forEach((table) => {
    const rows = Array.from(table.querySelectorAll("tr")).map((row) =>
      Array.from(row.querySelectorAll("td,th")).map((cell) => norm(cell.textContent ?? "")),
    ).filter((row) => row.some(Boolean));
    if (rows.length) tables.push(rows);
  });

  parseTables(tables, result);
  parseLabelValueLines(lines, result);
  return { lines, tables };
}

function parseTables(tables: GridRow[][], result: ImportedContract): void {
  for (const rows of tables) {
    const tableText = keyOf(rows.flat().join(" "));
    if (tableText.includes("DESCRICAO") && tableText.includes("VALOR")) {
      const equipamentos = parseEquipmentRows(rows);
      if (equipamentos.length) result.equipamentos = equipamentos;
    }

    for (const row of rows) {
      const cells = row.map(norm).filter((_, idx) => row[idx] != null);
      if (cells.length < 2) continue;
      const label = keyOf(cells[0]);
      const value = norm(cells.slice(1).join("\n"));

      if (/CONTRATANTE/.test(label) && !/CONTRATADA/.test(label)) applyPartyBlock(value, result, "contratante");
      else if (/CONTRATADA/.test(label)) applyPartyBlock(value, result, "contratada");
      else if (/B\.?\s*1|DESCRICAO DOS SERVICOS/.test(label)) setIf(result, "descricaoServicos", value);
      else if (/B\.?\s*2|LOCAL DA PRESTACAO/.test(label)) setIf(result, "localPrestacao", value);
      else if (/B\.?\s*3|DOCUMENTOS APLICAVEIS/.test(label)) setIf(result, "documentosAplicaveis", value);
      else if (/^C\)?|VIGENCIA/.test(label)) setIf(result, "vigencia", value);
      else if (/^D\)?|PRECO TOTAL|VALOR TOTAL/.test(label)) applyPriceBlock(value, result);
      else if (/^E\)?|FORMA DE PAGAMENTO|PAGAMENTO/.test(label)) setIf(result, "formaPagamento", value);
      else if (/NUMERO.*CONTRATO|CONTRATO.*NUMERO|N[ºO.]\s*CONTRATO/.test(label)) setIf(result, "numeroContrato", value);
      else if (/RAZAO SOCIAL|CLIENTE|NOME/.test(label)) setIf(result, "contratanteNome", value);
      else if (/ENDERECO/.test(label)) setIf(result, "contratanteEndereco", value);
      else if (/CNPJ/.test(label)) setIf(result, "contratanteCnpj", findCnpj(value) ?? value);
      else if (/INSCRICAO ESTADUAL|I\.?E/.test(label)) setIf(result, "contratanteIE", value);
      else if (/REPRESENTANTE LEGAL/.test(label)) setIf(result, "contratanteRepresentante", value);
      else if (/CARGO|FUNCAO/.test(label)) setIf(result, "contratanteCargo", value);
    }
  }
}

function parseEquipmentRows(rows: GridRow[]): Equipamento[] {
  const equipamentos: Equipamento[] = [];
  let headerIndex = rows.findIndex((row) => keyOf(row.join(" ")).includes("DESCRICAO") && keyOf(row.join(" ")).includes("VALOR"));
  if (headerIndex < 0) headerIndex = 0;

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const cells = rows[i].map(norm).filter(Boolean);
    if (!cells.length) continue;
    if (keyOf(cells.join(" ")).includes("DESCRICAO") && keyOf(cells.join(" ")).includes("VALOR")) continue;

    const valueIndex = cells.findIndex((c) => /R\$|\d+[.,]\d{2}/.test(c));
    if (valueIndex >= 0) {
      const descricao = cells.filter((_, idx) => idx !== valueIndex).join("\n");
      const valorUnitario = cells[valueIndex];
      if (descricao || valorUnitario) equipamentos.push({ descricao, valorUnitario });
    } else if (cells.length >= 2) {
      equipamentos.push({ descricao: cells.slice(0, -1).join("\n"), valorUnitario: cells[cells.length - 1] });
    } else if (cells[0] && !/^VALOR|^DESCRI/i.test(cells[0])) {
      equipamentos.push({ descricao: cells[0], valorUnitario: "" });
    }
  }
  return equipamentos.filter((e) => e.descricao || e.valorUnitario);
}

function parseEquipmentFromLines(lines: string[], result: ImportedContract): void {
  if (result.equipamentos?.length) return;
  const start = lines.findIndex((l) => /^ANEXO\s+I/i.test(l) || /DESCRI[ÇC][ÃA]O DOS EQUIPAMENTOS/i.test(l));
  if (start < 0) return;
  const equipamentos: Equipamento[] = [];
  let pending = "";
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^CL[ÁA]USULA|^ASSINATURAS?|^CONTRATANTE$|^CONTRATADA$|^TESTEMUNHAS?/i.test(line)) break;
    if (/^(DESCRI[ÇC][ÃA]O|VALOR DE MERCADO|VALOR UNIT)/i.test(line)) continue;
    const combined = line.match(/^(.*?)(R\$\s*[\d.,]+.*)$/i);
    if (combined) {
      equipamentos.push({ descricao: norm([pending, combined[1]].filter(Boolean).join("\n")), valorUnitario: oneLine(combined[2]) });
      pending = "";
    } else if (/^R\$\s*[\d.,]+/i.test(line)) {
      equipamentos.push({ descricao: pending, valorUnitario: line });
      pending = "";
    } else {
      pending = pending ? `${pending}\n${line}` : line;
    }
  }
  if (pending && /EMPILHADEIRA|EQUIPAMENTO|MODELO|CAPACIDADE|TORRE|GLP|EL[ÉE]TRICA|DIESEL/i.test(pending)) {
    equipamentos.push({ descricao: pending, valorUnitario: "" });
  }
  if (equipamentos.length) result.equipamentos = equipamentos;
}

function parseClauses(lines: string[], result: ImportedContract): void {
  const clauseRe = /^CL[ÁA]USULA\s+(\d+)\s*[—\-–:]\s*(.+)$/i;
  const subRe = /^(\d+\.\d+(?:\.\d+)?)\)?\s*(.*)$/;
  const stopRe = /^(ASSINATURAS?|CONTRATANTE$|CONTRATADA$|TESTEMUNHAS?:?|ANEXO\s+I|QUADRO RESUMO)/i;
  const clauses: ImportedClause[] = [];
  let current: ImportedClause | null = null;
  let currentSub: ExtraSub | null = null;

  const flushSub = () => {
    if (current && currentSub) {
      currentSub.texto = norm(currentSub.texto);
      current.subclausulasExtras.push(currentSub);
    }
    currentSub = null;
  };
  const flushClause = () => {
    if (current) {
      flushSub();
      current.corpo = norm(current.corpo);
      clauses.push(current);
    }
    current = null;
  };

  for (const line of lines) {
    const cm = line.match(clauseRe);
    if (cm) {
      flushClause();
      current = { numero: cm[1], titulo: oneLine(cm[2]), corpo: "", subclausulasExtras: [] };
      continue;
    }
    if (!current) continue;
    if (stopRe.test(line)) {
      flushClause();
      continue;
    }
    const sm = line.match(subRe);
    if (sm) {
      flushSub();
      currentSub = { numero: sm[1], texto: oneLine(sm[2]) };
    } else if (currentSub) {
      currentSub.texto = norm(`${currentSub.texto}\n${line}`);
    } else {
      current.corpo = norm(`${current.corpo}\n${line}`);
    }
  }
  flushClause();

  if (clauses.length) result.clausulasExtras = clauses;
}

function parseSignatures(lines: string[], result: ImportedContract): void {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const date = parseDateExtenso(line);
    if (date) {
      setIf(result, "dataAssinatura", date.dataAssinatura);
      setIf(result, "cidadeAssinatura", date.cidadeAssinatura);
      setIf(result, "dataAssinaturaIso", date.dataAssinaturaIso);
    }

    const rep = afterColon(line, "Representante Legal");
    if (rep) {
      setIf(result, "contratanteRepresentante", rep);
      setIf(result, "contratanteAssinNome", rep);
    }
    const cargo = afterColon(line, /(?:Cargo\s*\/?\s*Fun[çc][ãa]o|Cargo|Fun[çc][ãa]o)\s*:?\s*(.+)$/i);
    if (cargo) setIf(result, "contratanteCargo", cargo);
    const cpf = afterColon(line, /CPF\s*:?\s*([\d.-]+)$/i) ?? findCpf(line);
    if (cpf) setIf(result, "contratanteAssinCpf", cpf);
  }

  const contratanteIdx = lines.findIndex((l) => /^CONTRATANTE$/i.test(l));
  if (contratanteIdx >= 0) {
    const block = lines.slice(contratanteIdx + 1, contratanteIdx + 10);
    const name = block.find((l) => !/^Raz[ãa]o Social|^CNPJ|^Representante|^Cargo|^RG|^CPF|^_+/i.test(l) && !findCnpj(l));
    setIf(result, "contratanteAssinNome", name);
    for (const l of block) {
      setIf(result, "contratanteNome", afterColon(l, /Raz[ãa]o Social\s*:?\s*(.+)$/i));
      setIf(result, "contratanteCnpj", findCnpj(l));
      setIf(result, "contratanteRepresentante", afterColon(l, "Representante Legal"));
      setIf(result, "contratanteCargo", afterColon(l, /(?:Cargo\s*\/?\s*Fun[çc][ãa]o|Cargo|Fun[çc][ãa]o)\s*:?\s*(.+)$/i));
      setIf(result, "contratanteAssinRg", afterColon(l, /RG\s*:?\s*(.+)$/i));
      setIf(result, "contratanteAssinCpf", afterColon(l, /CPF\s*:?\s*(.+)$/i) ?? findCpf(l));
    }
  }

  const contratadaIdx = lines.findIndex((l) => /^CONTRATADA$/i.test(l));
  if (contratadaIdx >= 0) {
    const block = lines.slice(contratadaIdx + 1, contratadaIdx + 6);
    setIf(result, "contratadaNome", block.find((l) => !/^CNPJ|^_+/i.test(l) && !findCnpj(l)));
    for (const l of block) {
      setIf(result, "contratadaCnpj", findCnpj(l));
      if (/CNPJ/i.test(l) && /[—-]/.test(l)) setIf(result, "contratadaEndereco", l.split(/[—-]/).slice(1).join("-").trim());
    }
  }

  const tIdx = lines.findIndex((l) => /^TESTEMUNHAS?:?$/i.test(l));
  if (tIdx >= 0) {
    let bloco = 0;
    for (let i = tIdx + 1; i < lines.length; i++) {
      const l = lines[i];
      if (/^1\)/.test(l)) bloco = 1;
      else if (/^2\)/.test(l)) bloco = 2;
      else if (/^CL[ÁA]USULA|^ANEXO/i.test(l)) break;
      const nome = afterColon(l, "Nome");
      const rg = afterColon(l, "RG");
      if (bloco === 1) {
        setIf(result, "testemunha1Nome", nome);
        setIf(result, "testemunha1Rg", rg);
      } else if (bloco === 2) {
        setIf(result, "testemunha2Nome", nome);
        setIf(result, "testemunha2Rg", rg);
      }
    }
  }
}

function detectContratada(lines: string[], result: ImportedContract): void {
  const full = keyOf(lines.join(" "));
  for (const c of CONTRATADA_HINTS) {
    if (full.includes(keyOf(c.cnpj)) || full.includes(keyOf(c.nome).slice(0, 24))) {
      setIf(result, "contratadaNome", c.nome);
      setIf(result, "contratadaCnpj", c.cnpj);
      setIf(result, "contratadaEndereco", c.endereco);
      return;
    }
  }
}

function finalizeCrossFields(result: ImportedContract): void {
  if (!result.contratanteAssinNome && result.contratanteRepresentante) result.contratanteAssinNome = result.contratanteRepresentante;
  if (!result.contratanteRepresentante && result.contratanteAssinNome) result.contratanteRepresentante = result.contratanteAssinNome;
  if (!result.precoTotal && result.equipamentos?.length === 1) {
    const price = result.equipamentos[0].valorUnitario.match(/R\$\s*([\d.]+,\d{2}|[\d.,]+)/)?.[1];
    if (price) result.precoTotal = price;
  }
}

export async function importContractFromDocx(file: File): Promise<{
  data: ImportedContract;
  filledCount: number;
}> {
  const buf = await file.arrayBuffer();
  const result: ImportedContract = {};
  const allLines: string[] = [];
  const allTables: GridRow[][] = [];

  try {
    const structure = await extractDocxStructure(buf);
    allLines.push(...structure.lines);
    allTables.push(...structure.tables);
    parseTables(structure.tables, result);
    parseLabelValueLines(structure.lines, result);
  } catch (e) {
    console.warn("docx XML parse failed:", e);
  }

  try {
    const { value: html } = await mammoth.convertToHtml({ arrayBuffer: buf });
    const parsed = parseHtml(html, result);
    allLines.push(...parsed.lines);
    allTables.push(...parsed.tables);
  } catch (e) {
    console.warn("mammoth HTML parse failed:", e);
  }

  try {
    const { value: rawText } = await mammoth.extractRawText({ arrayBuffer: buf });
    allLines.push(...splitTextLines(rawText));
  } catch (e) {
    console.warn("mammoth rawText parse failed:", e);
  }

  const lines = uniqueLines(allLines.filter(Boolean));
  parseTables(allTables, result);
  parseLabelValueLines(lines, result);
  parseEquipmentFromLines(lines, result);
  parseClauses(lines, result);
  parseSignatures(lines, result);
  detectContratada(lines, result);
  finalizeCrossFields(result);

  const filledCount = Object.values(result).filter((v) => {
    if (v == null) return false;
    if (Array.isArray(v)) return v.length > 0;
    return String(v).trim().length > 0;
  }).length;

  console.log("[importContract] parsed", { filledCount, keys: Object.keys(result), lines: lines.length });

  return { data: result, filledCount };
}