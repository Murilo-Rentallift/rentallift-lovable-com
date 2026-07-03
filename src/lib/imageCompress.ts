// Utilitário de compressão/redimensionamento client-side de imagens.
// Reduz uso de memória durante geração do PDF e evita "PDF inválido ou muito grande".

export type CompressOptions = {
  maxWidth?: number;   // largura máxima em px (default 1200)
  maxHeight?: number;  // altura máxima em px (default 1600)
  quality?: number;    // 0..1 (default 0.8) — usado no JPEG
  mimeType?: string;   // default "image/jpeg"
};

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Falha ao decodificar imagem"));
    img.src = dataUrl;
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error(`Falha ao ler arquivo ${file.name}`));
    r.readAsDataURL(file);
  });
}

/**
 * Redimensiona e comprime uma imagem para JPEG (por padrão), retornando data URL.
 * Se a imagem já for menor que os limites, ainda assim é re-encodada como JPEG
 * comprimido para reduzir peso total do PDF.
 */
export async function fileToCompressedJpegDataUrl(
  file: File,
  opts: CompressOptions = {},
): Promise<string> {
  const maxWidth = opts.maxWidth ?? 1200;
  const maxHeight = opts.maxHeight ?? 1600;
  const quality = opts.quality ?? 0.8;
  const mimeType = opts.mimeType ?? "image/jpeg";

  const originalDataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(originalDataUrl);

  let { width, height } = img;
  const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
  width = Math.max(1, Math.round(width * ratio));
  height = Math.max(1, Math.round(height * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D indisponível no navegador");
  // fundo branco (JPEG não tem alpha)
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  const out = canvas.toDataURL(mimeType, quality);
  // libera memória o quanto possível
  canvas.width = 0;
  canvas.height = 0;
  return out;
}

/** Tamanho aproximado (em bytes) de um dataURL base64. */
export function dataUrlByteSize(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  // 4 chars base64 = 3 bytes
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
