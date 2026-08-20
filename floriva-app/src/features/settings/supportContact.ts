/**
 * Domain logic for the in-app "email us" support/feedback path.
 *
 * Floriva has no backend, so reaching the team is a plain `mailto:` handoff to
 * the device mail client. Kept out of the screen components (per architecture
 * rules) and free of any reproductive data — the only technical metadata added
 * is the app version and platform, to help triage.
 */

export type SupportMailtoParams = {
  email: string;
  version: string;
  platform: string;
  /** Localized subject line. Defaults to a versioned Floriva feedback line. */
  subject?: string;
  /** Localized leading line placed above the technical footer. */
  bodyIntro?: string;
};

/** The subset of `expo-linking` this module needs, injected for testability. */
export type SupportLinking = {
  canOpenURL: (url: string) => Promise<boolean>;
  openURL: (url: string) => Promise<unknown>;
};

export function buildSupportMailtoUrl(params: SupportMailtoParams): string {
  const subject = params.subject ?? `Floriva feedback (v${params.version})`;
  const footer = `— Floriva ${params.version} · ${params.platform}`;
  const body = params.bodyIntro ? `${params.bodyIntro}\n\n\n${footer}` : `\n\n\n${footer}`;
  const query = `subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return `mailto:${params.email}?${query}`;
}

/**
 * Attempts to open the composed support email. Returns `true` when the mail
 * client was launched, `false` when no handler is available or the launch
 * fails — callers surface a copy-the-address fallback on `false`.
 */
export async function openSupportEmail(
  params: SupportMailtoParams,
  linking: SupportLinking,
): Promise<boolean> {
  const url = buildSupportMailtoUrl(params);

  try {
    const canOpen = await linking.canOpenURL(url);
    if (!canOpen) {
      return false;
    }

    await linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
