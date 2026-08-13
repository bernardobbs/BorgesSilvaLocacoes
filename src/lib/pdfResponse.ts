// src/lib/pdfResponse.ts
// Resolve a resposta das rotas /api/pdf/* num href utilizável.
//
// As rotas sobem o PDF ao Storage e devolvem { pdfUrl }. Quando o upload
// falha elas caem no fallback e devolvem { pdfUrl: "", pdfBase64 }.
// Os componentes liam só pdfUrl — que vem string vazia (falsy) — então o
// botão de download nunca aparecia, apesar do toast de sucesso.

export interface PdfResponse {
  pdfUrl?: string | null;
  pdfBase64?: string | null;
}

/** Converte base64 em Blob sem passar por data: URI gigante. */
function base64ParaBlob(base64: string): Blob {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: "application/pdf" });
}

/**
 * Devolve um href para abrir/baixar o PDF, ou null se a resposta não
 * trouxe nem URL assinada nem base64.
 *
 * Quando cria um blob: URL, o chamador deve revogar com URL.revokeObjectURL
 * ao descartar (ver revogarSeBlob).
 */
export function resolverPdfHref(json: PdfResponse): string | null {
  if (json.pdfUrl) return json.pdfUrl;
  if (json.pdfBase64) return URL.createObjectURL(base64ParaBlob(json.pdfBase64));
  return null;
}

/** Revoga o object URL se o href tiver sido criado localmente. */
export function revogarSeBlob(href: string | null | undefined) {
  if (href?.startsWith("blob:")) URL.revokeObjectURL(href);
}

/**
 * Abre o PDF numa nova aba. Como isso acontece depois de um await, o
 * navegador já perdeu o gesto do usuário e costuma bloquear o popup —
 * nesse caso navega na própria aba, para o PDF não sumir silenciosamente.
 * Lança se a resposta não trouxe PDF algum.
 */
export function abrirPdf(json: PdfResponse) {
  const href = resolverPdfHref(json);
  if (!href) throw new Error("O PDF foi gerado mas não pôde ser entregue.");
  const aba = window.open(href, "_blank", "noopener");
  if (!aba || aba.closed) window.location.href = href;
}
