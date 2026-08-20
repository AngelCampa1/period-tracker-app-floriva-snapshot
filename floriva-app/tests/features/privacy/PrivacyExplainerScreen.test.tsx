import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { t } from '@/tests/helpers/localization';

const mockBack = jest.fn();
const mockCanGoBack = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: (...args: unknown[]) => mockBack(...args),
    canGoBack: (...args: unknown[]) => mockCanGoBack(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
  }),
}));

jest.mock('@/src/localization/localizationContext', () =>
  require('@/tests/helpers/localization'),
);

// eslint-disable-next-line import/first
import { PrivacyExplainerScreen } from '@/src/features/privacy/screens/PrivacyExplainerScreen';
// eslint-disable-next-line import/first
import { testIds } from '@/src/testing/testIds';

describe('PrivacyExplainerScreen', () => {
  beforeEach(() => {
    mockBack.mockReset();
    mockCanGoBack.mockReset();
    mockReplace.mockReset();
    mockCanGoBack.mockReturnValue(false);
  });

  it('renders the shared privacy explainer copy', async () => {
    render(<PrivacyExplainerScreen />);

    expect(screen.getByTestId(testIds.privacy.explainerScreen)).toBeTruthy();
    expect(screen.getByText(t('privacy.promise.eyebrow'))).toBeTruthy();
    expect(screen.getByText(t('privacy.promise.title'))).toBeTruthy();
    expect(screen.getByText(t('privacy.promise.body'))).toBeTruthy();
    expect(screen.getByText(t('privacy.promise.footnote'))).toBeTruthy();
    expect(screen.getByText(t('privacy.explainer.deviceStorage.title'))).toBeTruthy();
    expect(screen.getByText(t('privacy.explainer.deviceSecurity.title'))).toBeTruthy();
    expect(screen.getByText(t('privacy.explainer.deleteLocalData.title'))).toBeTruthy();
    expect(screen.getByText(t('privacy.explainer.uninstalling.title'))).toBeTruthy();
    expect(screen.getByText(t('privacy.explainer.imports.body'))).toBeTruthy();
    expect(screen.getByText(t('privacy.explainer.deleteLocalData.body'))).toBeTruthy();
    expect(screen.getByText(t('privacy.explainer.uninstalling.body'))).toBeTruthy();
    expect(screen.queryByText(t('privacy.explainer.imports.title'))).toBeNull();
  });

  it('returns to settings from the explainer', async () => {
    render(<PrivacyExplainerScreen />);

    fireEvent.press(screen.getByTestId(testIds.privacy.explainerBackButton));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/settings');
    });
  });

  it('supports onboarding-specific back navigation', async () => {
    render(
      <PrivacyExplainerScreen
        backHref="/welcome"
      />,
    );

    fireEvent.press(screen.getByTestId(testIds.privacy.explainerBackButton));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/welcome');
    });
  });

  it('pops the current stack when a previous route exists', async () => {
    mockCanGoBack.mockReturnValue(true);

    render(<PrivacyExplainerScreen />);

    fireEvent.press(screen.getByTestId(testIds.privacy.explainerBackButton));

    await waitFor(() => {
      expect(mockBack).toHaveBeenCalledTimes(1);
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });
});
