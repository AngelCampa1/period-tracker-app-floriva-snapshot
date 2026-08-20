/**
 * Reusable info-modal infrastructure.
 *
 * The `/modal` route is a lightweight, presentation-style screen for surfacing
 * a short explanatory note (a title, an optional eyebrow, and one or more body
 * paragraphs) without committing to a full screen. Callers describe the content
 * declaratively and `openInfoModal` handles navigation; the route reads the
 * params back and renders them, falling back to localized defaults when opened
 * without content (e.g. via a raw deep link).
 */

export const INFO_MODAL_PATHNAME = '/modal' as const;

export type InfoModalContent = {
  title: string;
  body: string | string[];
  eyebrow?: string;
};

export type InfoModalHref = {
  pathname: typeof INFO_MODAL_PATHNAME;
  params: {
    title: string;
    body: string[];
    eyebrow?: string;
  };
};

/** Minimal router surface the helper needs — keeps it test- and type-friendly. */
type PushableRouter = {
  push: (href: InfoModalHref) => void;
};

/**
 * Normalize free-form body content into an ordered list of clean paragraphs.
 * Accepts a single string (optionally containing blank-line separated blocks)
 * or an array of strings. Whitespace is trimmed and empty paragraphs dropped.
 */
export function normalizeInfoModalBody(body: string | string[] | undefined | null): string[] {
  if (body == null) {
    return [];
  }

  const blocks = Array.isArray(body) ? body : body.split('\n\n');

  return blocks.map((block) => block.trim()).filter((block) => block.length > 0);
}

/** Build the typed href for the info modal from declarative content. */
export function buildInfoModalHref(content: InfoModalContent): InfoModalHref {
  const params: InfoModalHref['params'] = {
    title: content.title,
    body: normalizeInfoModalBody(content.body),
  };

  if (content.eyebrow != null) {
    params.eyebrow = content.eyebrow;
  }

  return { pathname: INFO_MODAL_PATHNAME, params };
}

/** Push the info modal onto the navigation stack with the given content. */
export function openInfoModal(router: PushableRouter, content: InfoModalContent): void {
  router.push(buildInfoModalHref(content));
}
