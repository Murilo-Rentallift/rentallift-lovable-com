import { toast } from "sonner";

type Foto = { name?: string; dataUrl: string };

/**
 * Cria um registro "pendente de classificação" em Máquinas Disponíveis
 * reaproveitando os dados e fotos do checklist da Oficina.
 * Tipo e condição ficam em branco — o cadastro só é efetivado após revisão
 * manual na aba "Máquinas Disponíveis" (Vendas).
 */
export async function enviarChecklistParaClassificacao(input: {
  origem: "Saída" | "Retorno";
  frota: string;
  cliente?: string;
  horimetro?: string;
  data?: string;
  obs?: string;
  fotos: Foto[];
}) {
  try {
    const { createMaquinaPendente } = await import("@/lib/maquinas.functions");
    const linhas = [
      `Origem: Checklist de ${input.origem}${input.data ? ` — ${input.data}` : ""}`,
      input.cliente ? `Cliente: ${input.cliente}` : "",
      input.horimetro ? `Horímetro: ${input.horimetro}` : "",
      input.obs?.trim() ? input.obs.trim() : "",
    ].filter(Boolean);
    await createMaquinaPendente({
      data: {
        frota: input.frota,
        modelo: "",
        marca: "",
        observacoes: linhas.join("\n"),
        novasFotos: input.fotos.map((f) => ({ dataUrl: f.dataUrl, name: f.name })),
      },
    });
    toast.info("Máquina enviada para classificação em Vendas › Máquinas Disponíveis");
  } catch (e) {
    console.error("[checklist→maquinas] falha ao criar pendente:", e);
    toast.error("Não foi possível enviar a máquina para classificação");
  }
}
