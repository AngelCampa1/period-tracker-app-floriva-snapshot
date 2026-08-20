import {
  buildSupportMailtoUrl,
  openSupportEmail,
} from '@/src/features/settings/supportContact';

describe('buildSupportMailtoUrl', () => {
  it('builds a mailto url targeting the support email', () => {
    const url = buildSupportMailtoUrl({
      email: 'support@floriva.app',
      version: '1.2.0',
      platform: 'ios',
    });

    expect(url.startsWith('mailto:support@floriva.app?')).toBe(true);
  });

  it('defaults the subject to a versioned Floriva feedback line', () => {
    const url = buildSupportMailtoUrl({
      email: 'support@example.com',
      version: '1.2.0',
      platform: 'android',
    });

    const subject = new URL(url).searchParams.get('subject');
    expect(subject).toBe('Floriva feedback (v1.2.0)');
  });

  it('uses the provided subject when passed', () => {
    const url = buildSupportMailtoUrl({
      email: 'support@example.com',
      version: '1.2.0',
      platform: 'ios',
      subject: 'Idea for Floriva',
    });

    expect(new URL(url).searchParams.get('subject')).toBe('Idea for Floriva');
  });

  it('appends a privacy-safe technical footer with version and platform to the body', () => {
    const url = buildSupportMailtoUrl({
      email: 'support@example.com',
      version: '1.2.0',
      platform: 'ios',
      bodyIntro: 'What happened:',
    });

    const body = new URL(url).searchParams.get('body') ?? '';
    expect(body).toContain('What happened:');
    expect(body).toContain('Floriva 1.2.0');
    expect(body).toContain('ios');
  });

  it('percent-encodes subject and body content', () => {
    const url = buildSupportMailtoUrl({
      email: 'support@example.com',
      version: '1.2.0',
      platform: 'ios',
      subject: 'Bug & crash',
      bodyIntro: 'line one\nline two',
    });

    expect(url).toContain('Bug%20%26%20crash');
    expect(url).not.toContain('line one\nline two');
    expect(url).toContain('line%20one%0Aline%20two');
  });
});

describe('openSupportEmail', () => {
  const params = {
    email: 'support@floriva.app',
    version: '1.2.0',
    platform: 'ios' as const,
  };

  it('opens the mailto url and reports success when a mail app is available', async () => {
    const canOpenURL = jest.fn().mockResolvedValue(true);
    const openURL = jest.fn().mockResolvedValue(undefined);

    const opened = await openSupportEmail(params, { canOpenURL, openURL });

    const expectedUrl = buildSupportMailtoUrl(params);
    expect(canOpenURL).toHaveBeenCalledWith(expectedUrl);
    expect(openURL).toHaveBeenCalledWith(expectedUrl);
    expect(opened).toBe(true);
  });

  it('reports failure without opening when no mail app can handle the url', async () => {
    const canOpenURL = jest.fn().mockResolvedValue(false);
    const openURL = jest.fn().mockResolvedValue(undefined);

    const opened = await openSupportEmail(params, { canOpenURL, openURL });

    expect(openURL).not.toHaveBeenCalled();
    expect(opened).toBe(false);
  });

  it('reports failure when opening the url throws', async () => {
    const canOpenURL = jest.fn().mockResolvedValue(true);
    const openURL = jest.fn().mockRejectedValue(new Error('no handler'));

    const opened = await openSupportEmail(params, { canOpenURL, openURL });

    expect(opened).toBe(false);
  });
});
