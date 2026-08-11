import { toast } from "sonner";
import { compressDataUrl, dataUrlByteSize } from "@/lib/imageCompress";

type Foto = { name?: string; dataUrl: string };

export type ClassificacaoInput = {
  origem: "Saída" | "Retorno";
  frota: string;
  cliente?: string;
  horimetro?: string;
  data?: string;
  obs?: string;
  fotos: Foto[];
};

// Nessa etapa as fotos servem apenas para identificação visual da máquina,
// então enviamos poucas e bem leves para não estourar o payload da server function.
const MAX_FOTOS = 6;
const MAX_DIMENSAO = 900;
const QUALIDADE = 0.55;

async function prepararFotos(fotos: Foto[]): Promise<Foto[]> {
  const selecionadas = fotos.slice(0, MAX_FOTOS);
  const out: Foto[] = [];
  for (const f of selecionadas) {
    try {
      const dataUrl = await compressDataUrl(f.dataUrl, {
        maxWidth: MAX_DIMENSAO,
        maxHeight: MAX_DIMENSAO,
        quality: QUALIDADE,
      });
      out.push({ name: f.name, dataUrl });
    } catch {
      // se falhar a recompressão, só envia a original se ela já for pequena
      if (dataUrlByteSize(f.dataUrl) < 500 * 1024) out.push(f);
    }
  }
  return out;
}

/**
 * Cria um registro "pendente de classificação" em Máquinas Disponíveis
 * reaproveitando os dados e fotos do checklist da Oficina.
 * Tipo e condição ficam em branco — o cadastro só é efetivado após revisão
 * manual na aba "Máquinas Disponíveis" (Vendas).
 *
 * Retorna true quando o registro foi criado; false quando falhou (nesse caso
 * exibe um toast persistente com a opção de tentar novamente).
 */
export async function enviarChecklistParaClassificacao(
  input: ClassificacaoInput,
): Promise<boolean> {
  try {
    const { createMaquinaPendente } = await import("@/lib/maquinas.functions");
    const linhas = [
      `Origem: Checklist de ${input.origem}${input.data ? ` — ${input.data}` : ""}`,
      input.cliente ? `Cliente: ${input.cliente}` : "",
      input.horimetro ? `Horímetro: ${input.horimetro}` : "",
      input.obs?.trim() ? input.obs.trim() : "",
    ].filter(Boolean);
    const fotos = await prepararFotos(input.fotos);
    await createMaquinaPendente({
      data: {
        frota: input.frota,
        modelo: "",
        marca: "",
        observacoes: linhas.join("\n"),
        novasFotos: fotos.map((f) => ({ dataUrl: f.dataUrl, name: f.name })),
      },
    });
    toast.info("Máquina enviada para classificação em Vendas › Máquinas Disponíveis");
    return true;
  } catch (e) {
    console.error("[checklist→maquinas] falha ao criar pendente:", e);
    const detalhe = e instanceof Error && e.message ? ` (${e.message})` : "";
    toast.error(
      `Não foi possível enviar a máquina${input.frota ? ` ${input.frota}` : ""} para classificação${detalhe}`,
      {
        duration: 12000,
        description: "A máquina NÃO entrou em Vendas › Máquinas Disponíveis.",
        action: {
          label: "Tentar novamente",
          onClick: () => {
            void enviarChecklistParaClassificacao(input);
          },
        },
      },
    );
    return false;
  }
}
