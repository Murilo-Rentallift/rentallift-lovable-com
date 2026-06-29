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

const norm = (s: string) =>
  s.replace(/\s+/g, " ").trim();

const stripLabel = (s: string, label: RegExp) => norm(s.replace(label, ""));

const afterColon = (s: string, label: string): string | null => {
  const re = new RegExp(label + "\\s*:?\\s*(.*)$", "i");
  const m = s.match(re);
  return m ? norm(m[1]) : null;
};

export async function importContractFromDocx(file: File): Promise<{
  data: ImportedContract;
  filledCount: number;
}> {
  const buf = await file.arrayBuffer();
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: buf });

  const doc = new DOMParser().parseFromString(html, "text/html");
  const result: ImportedContract = {};

  // === Process all tables ===
  const tables = Array.from(doc.querySelectorAll("table"));
  for (const table of tables) {
    const rows = Array.from(table.querySelectorAll("tr"));
    // Detect Anexo table by header
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
      if (equipamentos.length) result.equipamentos = equipamentos;
      continue;
    }

    // Quadro resumo: each row has label cell + value cell
    for (const row of rows) {
      const cells = Array.from(row.querySelectorAll("td,th"));
      if (cells.length < 2) continue;
      const label = norm(cells[0].textContent ?? "").toUpperCase();
      // value: preserve line breaks between paragraphs
      const valueParas = Array.from(cells[1].querySelectorAll("p"));
      const valueLines = (valueParas.length
        ? valueParas.map((p) => norm(p.textContent ?? ""))
        : norm(cells[1].textContent ?? "").split(/\n/).map(norm)
      ).filter(Boolean);
      const valueText = valueLines.join("\n");

      if (/^A\)\s*CONTRATANTE/.test(label)) {
        if (valueLines[0]) result.contratanteNome = valueLines[0];
        if (valueLines[1]) result.contratanteEndereco = valueLines[1];
        // CNPJ and IE may be on same line
        const cnpjLine = valueLines.find((l) => /CNPJ/i.test(l));
        if (cnpjLine) {
          const cm = cnpjLine.match(/CNPJ\s*:?\s*([\d./-]+)/i);
          if (cm) result.contratanteCnpj = cm[1];
          const im = cnpjLine.match(/I\.?\s*E\.?\s*:?\s*([^\s].*?)\s*$/i);
          if (im) result.contratanteIE = im[1];
        }
      } else if (/^B\.?1/.test(label)) {
        result.descricaoServicos = valueText;
      } else if (/^B\.?2/.test(label)) {
        result.localPrestacao = valueText;
      } else if (/^B\.?3/.test(label)) {
        result.documentosAplicaveis = valueText;
      } else if (/^C\)/.test(label)) {
        result.vigencia = valueText;
      } else if (/^D\)/.test(label)) {
        // line 1 R$ X ; line 2 (extenso)
        const rsLine = valueLines.find((l) => /R\$/.test(l));
        if (rsLine) {
          const m = rsLine.match(/R\$\s*([\d.,]+)/);
          if (m) result.precoTotal = m[1];
        }
        const extLine = valueLines.find((l) => /^\(.*\)$/.test(l));
        if (extLine) result.precoExtenso = extLine.replace(/^\(|\)$/g, "").trim();
      } else if (/^E\)/.test(label)) {
        result.formaPagamento = valueText;
      }
    }
  }

  // === Process body paragraphs (cláusulas + assinaturas) ===
  const paras = Array.from(doc.querySelectorAll("body > p, body p"))
    .map((p) => norm(p.textContent ?? ""))
    .filter(Boolean);

  // Cláusulas extras (numero > 10 ou não-fixas). Faz parse genérico de todas.
  const clausulasExtras: ImportedClause[] = [];
  let current: ImportedClause | null = null;
  const clauseRe = /^CL[ÁA]USULA\s+(\d+)\s*[—\-–]\s*(.+)$/i;
  const subRe = /^(\d+\.\d+)\)\s*(.*)$/;

  for (const line of paras) {
    const cm = line.match(clauseRe);
    if (cm) {
      if (current) clausulasExtras.push(current);
      current = { numero: cm[1], titulo: cm[2].trim(), corpo: "", subclausulasExtras: [] };
      continue;
    }
    if (current) {
      const sm = line.match(subRe);
      if (sm) {
        current.subclausulasExtras.push({ numero: sm[1], texto: sm[2].trim() });
      } else {
        // ignore lines that look like signature/anexo trailing
        if (/^(CONTRATANTE|CONTRATADA|TESTEMUNHAS?|ANEXO|RENTAL LIFT)/i.test(line)) {
          clausulasExtras.push(current);
          current = null;
        } else {
          current.corpo = current.corpo ? `${current.corpo}\n${line}` : line;
        }
      }
    }
  }
  if (current) clausulasExtras.push(current);
  if (clausulasExtras.length) result.clausulasExtras = clausulasExtras;

  // Signatures: scan from "CONTRATANTE" appearance
  const idxContratante = paras.findIndex((l, i) =>
    /^CONTRATANTE$/i.test(l) && i > 0,
  );
  // Date appears right before CONTRATANTE block. Look for pattern "Cidade, DD de mes de AAAA"
  const dateRe = /^[A-Za-zÀ-ÿ\s.]+,\s*\d{1,2}\s+de\s+[a-zç]+\s+de\s+\d{4}$/i;
  for (let i = Math.max(0, idxContratante - 5); i < (idxContratante === -1 ? paras.length : idxContratante); i++) {
    if (dateRe.test(paras[i])) {
      result.dataAssinatura = paras[i];
      break;
    }
  }

  for (const line of paras) {
    const rep = afterColon(line, "Representante Legal");
    if (rep && !result.contratanteRepresentante) result.contratanteRepresentante = rep;
    const cargo = afterColon(line, "Cargo\\s*/?\\s*Fun[çc][ãa]o");
    if (cargo && !result.contratanteCargo) result.contratanteCargo = cargo;
    const rs = afterColon(line, "Raz[ãa]o Social");
    if (rs && !result.contratanteNome) result.contratanteNome = rs;
  }

  // Testemunhas: find "TESTEMUNHAS" then sequential 1) / 2) blocks
  const tIdx = paras.findIndex((l) => /^TESTEMUNHAS?:?$/i.test(l));
  if (tIdx >= 0) {
    let bloco = 0;
    for (let i = tIdx + 1; i < paras.length; i++) {
      const l = paras[i];
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

  const filledCount = Object.values(result).filter((v) => {
    if (v == null) return false;
    if (Array.isArray(v)) return v.length > 0;
    return String(v).trim().length > 0;
  }).length;

  return { data: result, filledCount };
}
