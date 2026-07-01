import mammoth from "mammoth";

type Equipamento = { descricao: string; valorUnitario: string };
type ExtraSub = { numero: string; texto: string };
type ImportedClause = {
  numero: string;
  titulo: string;
  corpo: string;
  subclausulasExtras: ExtraSub[];
};

export type ImportedContract = {
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
  contratanteRepresentante?: string;
  contratanteCargo?: string;
  testemunha1Nome?: string;
  testemunha1Rg?: string;
  testemunha2Nome?: string;
  testemunha2Rg?: string;
  equipamentos?: Equipamento[];
  clausulasExtras?: ImportedClause[];
};

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

const afterColon = (s: string, label: string | RegExp): string | null => {
  const re = typeof label === "string"
    ? new RegExp("^\\s*" + label + "\\s*:?\\s*(.+)$", "i")
    : label;
  const m = s.match(re);
  return m ? norm(m[1]) : null;
};

function parseHtml(html: string, result: ImportedContract): void {
  const doc = new DOMParser().parseFromString(html, "text/html");

  // === Tables ===
  const tables = Array.from(doc.querySelectorAll("table"));
  for (const table of tables) {
    const rows = Array.from(table.querySelectorAll("tr"));
    const firstRowText = norm(rows[0]?.textContent ?? "").toUpperCase();
    if (firstRowText.includes("DESCRIÇÃO") && firstRowText.includes("VALOR")) {
      const equipamentos: Equipamento[] = [];
      for (let i = 1; i < rows.length; i++) {
        const cells = Array.from(rows[i].querySelectorAll("td,th"));
        if (cells.length < 2) continue;
        const descricao = norm(cells[0].textContent ?? "");
        const valorUnitario = norm(cells[1].textContent ?? "");
        if (descricao || valorUnitario) equipamentos.push({ descricao, valorUnitario });
      }
      if (equipamentos.length && !result.equipamentos) result.equipamentos = equipamentos;
      continue;
    }

    for (const row of rows) {
      const cells = Array.from(row.querySelectorAll("td,th"));
      if (cells.length < 2) continue;
      const label = norm(cells[0].textContent ?? "").toUpperCase();
      const valueParas = Array.from(cells[1].querySelectorAll("p"));
      const valueLines = (valueParas.length
        ? valueParas.map((p) => norm(p.textContent ?? ""))
        : norm(cells[1].textContent ?? "").split(/\n/).map(norm)
      ).filter(Boolean);
      const valueText = valueLines.join("\n");

      if (/^A\)\s*CONTRATANTE/.test(label)) {
        if (valueLines[0]) result.contratanteNome ||= valueLines[0];
        if (valueLines[1]) result.contratanteEndereco ||= valueLines[1];
        const cnpjLine = valueLines.find((l) => /CNPJ/i.test(l));
        if (cnpjLine) {
          const cm = cnpjLine.match(/CNPJ\s*:?\s*([\d./-]+)/i);
          if (cm) result.contratanteCnpj ||= cm[1];
          const im = cnpjLine.match(/I\.?\s*E\.?\s*:?\s*(\S.*?)\s*$/i);
          if (im) result.contratanteIE ||= im[1];
        }
      } else if (/^B\.?\s*1/.test(label)) {
        result.descricaoServicos ||= valueText;
      } else if (/^B\.?\s*2/.test(label)) {
        result.localPrestacao ||= valueText;
      } else if (/^B\.?\s*3/.test(label)) {
        result.documentosAplicaveis ||= valueText;
      } else if (/^C\)/.test(label)) {
        result.vigencia ||= valueText;
      } else if (/^D\)/.test(label)) {
        const rsLine = valueLines.find((l) => /R\$/.test(l));
        if (rsLine) {
          const m = rsLine.match(/R\$\s*([\d.,]+)/);
          if (m) result.precoTotal ||= m[1];
        }
        const extLine = valueLines.find((l) => /^\(.*\)$/.test(l));
        if (extLine) result.precoExtenso ||= extLine.replace(/^\(|\)$/g, "").trim();
      } else if (/^E\)/.test(label)) {
        result.formaPagamento ||= valueText;
      }
    }
  }
}

function parseText(rawText: string, result: ImportedContract): void {
  const rawLines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // --- Quadro Resumo via labels ---
  const findAfter = (labelRe: RegExp, stopRe: RegExp, max = 6): string[] => {
    const i = rawLines.findIndex((l) => labelRe.test(l));
    if (i < 0) return [];
    const out: string[] = [];
    for (let k = i + 1; k < rawLines.length && out.length < max; k++) {
      if (stopRe.test(rawLines[k])) break;
      out.push(rawLines[k]);
    }
    return out;
  };

  const labelStop = /^(QUADRO RESUMO|A\)|B\.?\s*[123]\)|C\)|D\)|E\)|CL[ÁA]USULA|ANEXO|TESTEMUNHAS?:?|CONTRATANTE$|CONTRATADA$|_+$)/i;

  const contratanteBlock = findAfter(/^A\)\s*CONTRATANTE/i, labelStop, 6);
  if (contratanteBlock.length) {
    if (!result.contratanteNome) result.contratanteNome = contratanteBlock[0];
    if (!result.contratanteEndereco && contratanteBlock[1] && !/CNPJ/i.test(contratanteBlock[1])) {
      result.contratanteEndereco = contratanteBlock[1];
    }
    const cnpjLine = contratanteBlock.find((l) => /CNPJ/i.test(l));
    if (cnpjLine) {
      const cm = cnpjLine.match(/CNPJ\s*:?\s*([\d./-]+)/i);
      if (cm && !result.contratanteCnpj) result.contratanteCnpj = cm[1];
      const im = cnpjLine.match(/I\.?\s*E\.?\s*:?\s*(\S.*?)\s*$/i);
      if (im && !result.contratanteIE) result.contratanteIE = im[1];
    }
  }

  const grab1 = (labelRe: RegExp): string | undefined => {
    const block = findAfter(labelRe, labelStop, 4);
    return block.length ? block.join("\n") : undefined;
  };

  result.descricaoServicos ||= grab1(/^B\.?\s*1\)/i);
  result.localPrestacao ||= grab1(/^B\.?\s*2\)/i);
  result.documentosAplicaveis ||= grab1(/^B\.?\s*3\)/i);
  result.vigencia ||= grab1(/^C\)\s*VIG/i);
  const dBlock = findAfter(/^D\)\s*PRE/i, labelStop, 4);
  if (dBlock.length) {
    const rsLine = dBlock.find((l) => /R\$/.test(l));
    if (rsLine) {
      const m = rsLine.match(/R\$\s*([\d.,]+)/);
      if (m && !result.precoTotal) result.precoTotal = m[1];
    }
    const extLine = dBlock.find((l) => /^\(.+\)$/.test(l));
    if (extLine && !result.precoExtenso) result.precoExtenso = extLine.replace(/^\(|\)$/g, "").trim();
  }
  result.formaPagamento ||= grab1(/^E\)\s*FORMA/i);

  // --- Cláusulas ---
  const clauseRe = /^CL[ÁA]USULA\s+(\d+)\s*[—\-–]\s*(.+)$/i;
  const subRe = /^(\d+\.\d+)\)\s*(.*)$/;
  const clausulas: ImportedClause[] = [];
  let current: ImportedClause | null = null;
  for (const line of rawLines) {
    const cm = line.match(clauseRe);
    if (cm) {
      if (current) clausulas.push(current);
      current = { numero: cm[1], titulo: cm[2].trim(), corpo: "", subclausulasExtras: [] };
      continue;
    }
    if (!current) continue;
    const sm = line.match(subRe);
    if (sm) {
      current.subclausulasExtras.push({ numero: sm[1], texto: sm[2].trim() });
    } else if (/^(CONTRATANTE|CONTRATADA|TESTEMUNHAS?|ANEXO|RENTAL LIFT|_+)/i.test(line)) {
      clausulas.push(current);
      current = null;
    } else {
      current.corpo = current.corpo ? `${current.corpo}\n${line}` : line;
    }
  }
  if (current) clausulas.push(current);
  if (clausulas.length && !result.clausulasExtras) result.clausulasExtras = clausulas;

  // --- Assinaturas ---
  const dateRe = /^([A-Za-zÀ-ÿ\s.]+,\s*\d{1,2}\s+de\s+[a-zç]+\s+de\s+\d{4})$/i;
  for (const l of rawLines) {
    const dm = l.match(dateRe);
    if (dm && !result.dataAssinatura) { result.dataAssinatura = dm[1]; break; }
  }
  for (const line of rawLines) {
    const rep = afterColon(line, "Representante Legal");
    if (rep && !result.contratanteRepresentante) result.contratanteRepresentante = rep;
    const cargo = afterColon(line, "Cargo\\s*/?\\s*Fun[çc][ãa]o");
    if (cargo && !result.contratanteCargo) result.contratanteCargo = cargo;
  }
  const tIdx = rawLines.findIndex((l) => /^TESTEMUNHAS?:?$/i.test(l));
  if (tIdx >= 0) {
    let bloco = 0;
    for (let i = tIdx + 1; i < rawLines.length; i++) {
      const l = rawLines[i];
      if (/^1\)/.test(l)) bloco = 1;
      else if (/^2\)/.test(l)) bloco = 2;
      const nome = afterColon(l, "Nome");
      const rg = afterColon(l, "RG");
      if (bloco === 1) {
        if (nome && !result.testemunha1Nome) result.testemunha1Nome = nome;
        if (rg && !result.testemunha1Rg) result.testemunha1Rg = rg;
      } else if (bloco === 2) {
        if (nome && !result.testemunha2Nome) result.testemunha2Nome = nome;
        if (rg && !result.testemunha2Rg) result.testemunha2Rg = rg;
      }
    }
  }

  // --- Equipamentos (fallback): busca linhas após "ANEXO I" com "R$" ---
  if (!result.equipamentos) {
    const aIdx = rawLines.findIndex((l) => /^ANEXO\s+I/i.test(l));
    if (aIdx >= 0) {
      const equipamentos: Equipamento[] = [];
      let pending: string | null = null;
      for (let i = aIdx + 1; i < rawLines.length; i++) {
        const l = rawLines[i];
        if (/^(DESCRI[ÇC][ÃA]O|VALOR)/i.test(l)) continue;
        if (/R\$/.test(l) && !/^R\$/.test(l) === false) {
          // linha só com valor
          if (pending) {
            equipamentos.push({ descricao: pending, valorUnitario: l });
            pending = null;
          }
        } else if (/R\$/.test(l)) {
          // "descrição ... R$ 100,00 (extenso)"
          const m = l.match(/^(.*?)(R\$.*)$/);
          if (m) equipamentos.push({ descricao: m[1].trim(), valorUnitario: m[2].trim() });
        } else {
          pending = l;
        }
      }
      if (equipamentos.length) result.equipamentos = equipamentos;
    }
  }
}

export async function importContractFromDocx(file: File): Promise<{
  data: ImportedContract;
  filledCount: number;
}> {
  const buf = await file.arrayBuffer();
  const result: ImportedContract = {};

  try {
    const { value: html } = await mammoth.convertToHtml({ arrayBuffer: buf });
    parseHtml(html, result);
  } catch (e) {
    console.warn("mammoth HTML parse failed:", e);
  }

  try {
    const { value: rawText } = await mammoth.extractRawText({ arrayBuffer: buf });
    parseText(rawText, result);
  } catch (e) {
    console.warn("mammoth rawText parse failed:", e);
  }

  const filledCount = Object.values(result).filter((v) => {
    if (v == null) return false;
    if (Array.isArray(v)) return v.length > 0;
    return String(v).trim().length > 0;
  }).length;

  console.log("[importContract] parsed", { filledCount, keys: Object.keys(result) });

  return { data: result, filledCount };
}
