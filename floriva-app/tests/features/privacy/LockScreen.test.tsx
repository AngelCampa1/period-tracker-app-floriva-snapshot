import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Linking, StyleSheet } from 'react-native';
import { t } from '@/tests/helpers/localization';

const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockCanGoBack = jest.fn();
const mockUnlockApp = jest.fn();
const mockAuthenticateBiometricUnlock = jest.fn();
const mockAppShellState = {
  hasCompletedOnboarding: true,
  isLocked: true,
  billingAccessState: 'trial_active',
  mainAppReady: false,
  pendingEntryRoute: null as string | null,
};
let openSettingsSpy: jest.SpiedFunction<typeof Linking.openSettings>;

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: (...args: unknown[]) => mockBack(...args),
    canGoBack: (...args: unknown[]) => mockCanGoBack(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
  }),
}));

jest.mock('@/src/features/app-shell/AppShellProvider', () => ({
  useAppShell: () => ({
    state: mockAppShellState,
    unlockApp: (...args: unknown[]) => mockUnlockApp(...args),
  }),
}));

jest.mock('@/src/lib/security/biometricLock', () => ({
  authenticateBiometricUnlock: (...args: unknown[]) =>
    mockAuthenticateBiometricUnlock(...args),
}));

jest.mock('@/src/localization/localizationContext', () =>
  require('@/tests/helpers/localization'),
);

// eslint-disable-next-line import/first
import { LockScreen } from '@/src/features/privacy/screens/LockScreen';

describe('LockScreen', () => {
  beforeEach(() => {
    mockBack.mockReset();
    mockCanGoBack.mockReset();
    mockReplace.mockReset();
    mockUnlockApp.mockReset();
    mockAuthenticateBiometricUnlock.mockReset();
    mockCanGoBack.mockReturnValue(false);
    mockAppShellState.billingAccessState = 'trial_active';
    mockAppShellState.mainAppReady = false;
    mockAppShellState.pendingEntryRoute = null;
    openSettingsSpy = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
  });

  afterEach(() => {
    openSettingsSpy.mockRestore();
  });

  it('unlocks the app after successful local authentication', async () => {
    mockAuthenticateBiometricUnlock.mockResolvedValue({ success: true });

    render(<LockScreen />);

    fireEvent.press(screen.getByText(t('privacy.lock.unlockButtonLabel')));

    await waitFor(() => {
      expect(mockUnlockApp).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith('/today');
    });
  });

  it('resumes a queued billing-management route after unlock when there is no back stack', async () => {
    mockAuthenticateBiometricUnlock.mockResolvedValue({ success: true });
    mockAppShellState.billingAccessState = 'trial_active';
    mockAppShellState.pendingEntryRoute = '/import';

    render(<LockScreen />);

    fireEvent.press(screen.getByText(t('privacy.lock.unlockButtonLabel')));

    await waitFor(() => {
      expect(mockUnlockApp).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith('/import');
    });
  });

  it('returns a formerly-unpaid user into the app after unlock (paid gate retired)', async () => {
    mockAuthenticateBiometricUnlock.mockResolvedValue({ success: true });
    mockAppShellState.billingAccessState = 'needs_purchase';
    mockAppShellState.pendingEntryRoute = '/today';

    render(<LockScreen />);

    fireEvent.press(screen.getByText(t('privacy.lock.unlockButtonLabel')));

    await waitFor(() => {
      expect(mockUnlockApp).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith('/today');
    });
  });

  it('describes the honest device-security unlock path, including passcode fallback', () => {
    render(<LockScreen />);

    // UL-18: the unlock instruction appears exactly once as the page
    // subtitle — it is no longer duplicated verbatim inside the card body.
    expect(
      screen.getAllByText(
        'Unlock with the Face ID, fingerprint, or device passcode already set up on this device.',
      ).length,
    ).toBe(1);
    expect(screen.getByText('Face ID, fingerprint, or device passcode')).toBeTruthy();
  });

  it('UL-74: capitalizes the standalone unlock-path value on Android', () => {
    const { Platform } = jest.requireActual<typeof import('react-native')>('react-native');
    const restoreOS = jest.replaceProperty(Platform, 'OS', 'android');

    try {
      render(<LockScreen />);

      // The metric value is a standalone phrase — sentence case, not the
      // mid-sentence lowercase form ("fingerprint, face unlock, …").
      expect(
        screen.getByText('Fingerprint, face unlock, or device passcode'),
      ).toBeTruthy();
      expect(
        screen.queryByText('fingerprint, face unlock, or device passcode'),
      ).toBeNull();
    } finally {
      restoreOS.restore();
    }
  });

  it('keeps the long unlock-path copy in the compact readable metric style', () => {
    render(<LockScreen />);

    const unlockPathValue = screen.getByText('Face ID, fingerprint, or device passcode');
    const flattenedStyle = StyleSheet.flatten(unlockPathValue.props.style);

    expect(flattenedStyle.fontSize).toBe(16);
    expect(flattenedStyle.lineHeight).toBe(22);
  });

  it('returns to the previous route after a successful manual lock unlock when navigation history exists', async () => {
    mockAuthenticateBiometricUnlock.mockResolvedValue({ success: true });
    mockCanGoBack.mockReturnValue(true);

    render(<LockScreen />);

    fireEvent.press(screen.getByText(t('privacy.lock.unlockButtonLabel')));

    await waitFor(() => {
      expect(mockUnlockApp).toHaveBeenCalledTimes(1);
      expect(mockBack).toHaveBeenCalledTimes(1);
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  it('shows an honest fallback message when local authentication is unavailable', async () => {
    mockAuthenticateBiometricUnlock.mockResolvedValue({
      success: false,
      error: 'not_available',
    });

    render(<LockScreen />);

    fireEvent.press(screen.getByText(t('privacy.lock.unlockButtonLabel')));

    await waitFor(() => {
      expect(
        screen.getByText(
          "This device can't unlock Floriva right now because no Face ID, fingerprint, or device passcode is set up.",
        ),
      ).toBeTruthy();
      expect(mockUnlockApp).not.toHaveBeenCalled();
    });
  });

  it('offers a device-settings recovery path when biometric unlock is unavailable', async () => {
    mockAuthenticateBiometricUnlock.mockResolvedValue({
      success: false,
      error: 'not_available',
    });

    render(<LockScreen />);

    fireEvent.press(screen.getByTestId('lock-unlock-button'));

    await waitFor(() => {
      expect(
        screen.getByText(
          "This device can't unlock Floriva right now because no Face ID, fingerprint, or device passcode is set up.",
        ),
      ).toBeTruthy();
      expect(screen.getByText(t('privacy.lock.openDeviceSettings'))).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('lock-recovery-button'));

    await waitFor(() => {
      expect(openSettingsSpy).toHaveBeenCalledTimes(1);
      expect(mockUnlockApp).not.toHaveBeenCalled();
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  it('shows a cancelled message when the user backs out of unlock', async () => {
    mockAuthenticateBiometricUnlock.mockResolvedValue({
      success: false,
      error: 'user_cancel',
    });

    render(<LockScreen />);

    fireEvent.press(screen.getByText(t('privacy.lock.unlockButtonLabel')));

    await waitFor(() => {
      expect(screen.getByText(t('privacy.lock.cancelledBody'))).toBeTruthy();
      expect(mockUnlockApp).not.toHaveBeenCalled();
    });
  });

  it('shows a generic failure message for unexpected unlock errors', async () => {
    mockAuthenticateBiometricUnlock.mockResolvedValue({
      success: false,
      error: 'unknown',
    });

    render(<LockScreen />);

    fireEvent.press(screen.getByText(t('privacy.lock.unlockButtonLabel')));

    await waitFor(() => {
      expect(screen.getByText(t('privacy.lock.failureBody'))).toBeTruthy();
      expect(mockUnlockApp).not.toHaveBeenCalled();
    });
  });

  it('recovers when biometric authentication rejects unexpectedly', async () => {
    mockAuthenticateBiometricUnlock.mockRejectedValue(new Error('biometric exploded'));

    render(<LockScreen />);

    fireEvent.press(screen.getByTestId('lock-unlock-button'));

    await waitFor(() => {
      expect(screen.getByText(t('privacy.lock.failureBody'))).toBeTruthy();
      expect(screen.getByTestId('lock-unlock-button').props.accessibilityState.disabled).toBe(
        false,
      );
      expect(mockUnlockApp).not.toHaveBeenCalled();
      expect(mockBack).not.toHaveBeenCalled();
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  it('keeps the screen stable when opening device settings fails', async () => {
    mockAuthenticateBiometricUnlock.mockResolvedValue({
      success: false,
      error: 'not_available',
    });
    openSettingsSpy.mockRejectedValueOnce(new Error('settings failed'));

    render(<LockScreen />);

    fireEvent.press(screen.getByTestId('lock-unlock-button'));

    await waitFor(() => {
      expect(screen.getByText(t('privacy.lock.openDeviceSettings'))).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('lock-recovery-button'));

    await waitFor(() => {
      expect(openSettingsSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByText(t('privacy.lock.failureBody'))).toBeTruthy();
      expect(screen.queryByText(t('privacy.lock.openDeviceSettings'))).toBeNull();
      expect(mockUnlockApp).not.toHaveBeenCalled();
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  it('disables the unlock action while biometric authentication is already in progress', async () => {
    let resolveUnlock!: (value: { success: boolean }) => void;
    mockAuthenticateBiometricUnlock.mockImplementation(
      () =>
        new Promise<{ success: boolean }>((resolve) => {
          resolveUnlock = resolve;
        }),
    );

    render(<LockScreen />);

    fireEvent.press(screen.getByTestId('lock-unlock-button'));

    expect(screen.getByTestId('lock-unlock-button').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText(t('privacy.lock.unlocking'))).toBeTruthy();

    fireEvent.press(screen.getByTestId('lock-unlock-button'));

    expect(mockAuthenticateBiometricUnlock).toHaveBeenCalledTimes(1);

    resolveUnlock({ success: true });

    await waitFor(() => {
      expect(mockUnlockApp).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith('/today');
    });
  });
});
