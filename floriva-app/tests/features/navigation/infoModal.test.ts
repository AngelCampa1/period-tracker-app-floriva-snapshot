import {
  INFO_MODAL_PATHNAME,
  buildInfoModalHref,
  normalizeInfoModalBody,
  openInfoModal,
} from '@/src/features/navigation/infoModal';

describe('normalizeInfoModalBody', () => {
  it('wraps a single string into one paragraph', () => {
    expect(normalizeInfoModalBody('One calm line.')).toEqual(['One calm line.']);
  });

  it('keeps an array of paragraphs in order', () => {
    expect(normalizeInfoModalBody(['First.', 'Second.'])).toEqual(['First.', 'Second.']);
  });

  it('splits double-newline blocks into separate paragraphs', () => {
    expect(normalizeInfoModalBody('First.\n\nSecond.')).toEqual(['First.', 'Second.']);
  });

  it('trims whitespace and drops empty paragraphs', () => {
    expect(normalizeInfoModalBody(['  Kept.  ', '   ', ''])).toEqual(['Kept.']);
  });

  it('returns an empty list for nullish input', () => {
    expect(normalizeInfoModalBody(undefined)).toEqual([]);
    expect(normalizeInfoModalBody('')).toEqual([]);
  });
});

describe('buildInfoModalHref', () => {
  it('targets the modal route and carries the title and body paragraphs', () => {
    const href = buildInfoModalHref({
      title: 'Fertile window',
      body: ['Estimated from your logs.', 'It moves as you log more.'],
    });

    expect(href).toEqual({
      pathname: INFO_MODAL_PATHNAME,
      params: {
        title: 'Fertile window',
        body: ['Estimated from your logs.', 'It moves as you log more.'],
      },
    });
  });

  it('includes the eyebrow only when provided', () => {
    const withEyebrow = buildInfoModalHref({
      title: 'Confidence',
      eyebrow: 'How this works',
      body: 'Built on this device.',
    });

    expect(withEyebrow.params).toEqual({
      title: 'Confidence',
      eyebrow: 'How this works',
      body: ['Built on this device.'],
    });

    const withoutEyebrow = buildInfoModalHref({ title: 'Confidence', body: 'Built on this device.' });

    expect(withoutEyebrow.params).not.toHaveProperty('eyebrow');
  });
});

describe('openInfoModal', () => {
  it('pushes the built href onto the router', () => {
    const push = jest.fn();

    openInfoModal({ push }, { title: 'Fertile window', body: 'Estimated from your logs.' });

    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith({
      pathname: INFO_MODAL_PATHNAME,
      params: { title: 'Fertile window', body: ['Estimated from your logs.'] },
    });
  });
});
