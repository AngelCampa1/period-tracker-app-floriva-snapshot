import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { Keyboard, StyleSheet, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';

import { Text } from '@/src/components/primitives/Text';
import { ActionButton } from '@/src/components/primitives/ActionButton';
import { SelectionChip } from '@/src/components/primitives/SelectionChip';
import { SelectionPanel } from '@/src/components/primitives/SelectionPanel';
import { SectionCard } from '@/src/components/primitives/SectionCard';
import { useLocalization } from '@/src/localization/localizationContext';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

type InputFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: TextInputProps['keyboardType'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoCorrect?: boolean;
  error?: string;
  secureTextEntry?: TextInputProps['secureTextEntry'];
  multiline?: boolean;
  numberOfLines?: number;
  testID?: string;
};

type ChoiceChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
};

type ChoicePanelProps = {
  title: string;
  description: string;
  kicker?: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
};

type OptionCardProps = {
  title: string;
  description: string;
  children: ReactNode;
  variant?: 'default' | 'subtle' | 'emphasis';
};

type OnboardingAlertProps = {
  title: string;
  messages: string[];
};

type OnboardingFooterProps = {
  onContinue: () => void;
  continueLabel?: string;
  continueTestID?: string;
  continueDisabled?: boolean;
};

type FreshOnboardingDraft = {
  ttcEnabled: boolean | null;
};

export function InputField({
  autoCapitalize = 'sentences',
  autoCorrect = true,
  error,
  keyboardType = 'default',
  label,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  multiline = false,
  numberOfLines,
  testID,
  value,
}: InputFieldProps) {
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        keyboardType={keyboardType}
        multiline={multiline}
        onChangeText={onChangeText}
        numberOfLines={numberOfLines}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        secureTextEntry={secureTextEntry}
        style={[
          styles.input,
          multiline ? styles.inputMultiline : null,
          error ? styles.inputError : null,
        ]}
        testID={testID}
        textAlignVertical={multiline ? 'top' : 'center'}
        value={value}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

export function ChoiceChip({ label, onPress, selected, testID }: ChoiceChipProps) {
  return (
    <SelectionChip
      label={label}
      onPress={() => {
        Keyboard.dismiss();
        onPress();
      }}
      selected={selected}
      testID={testID}
    />
  );
}

export function ChoicePanel({
  description,
  kicker,
  onPress,
  selected,
  testID,
  title,
}: ChoicePanelProps) {
  const { t } = useLocalization();

  return (
    <SelectionPanel
      description={description}
      kicker={kicker}
      onPress={() => {
        Keyboard.dismiss();
        onPress();
      }}
      selected={selected}
      selectedBadgeLabel={selected ? t('onboarding.shared.selected') : undefined}
      testID={testID}
      title={title}
    />
  );
}

export function OptionCard({
  children,
  description,
  title,
  variant = 'subtle',
}: OptionCardProps) {
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <SectionCard
      description={description}
      presentation={variant === 'subtle' ? 'unframed' : 'card'}
      title={title}
      variant={variant}
    >
      <View style={styles.optionContent}>{children}</View>
    </SectionCard>
  );
}

export function OnboardingAlert({ messages, title }: OnboardingAlertProps) {
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (messages.length === 0) {
    return null;
  }

  return (
    <View accessibilityRole="alert" style={styles.alertPanel}>
      <Text style={styles.alertTitle}>{title}</Text>
      <View style={styles.alertMessages}>
        {messages.map((message) => (
          <Text key={message} style={styles.alertMessage}>
            {message}
          </Text>
        ))}
      </View>
    </View>
  );
}

// UL-53: the footer intentionally has no Back button. Backward navigation is
// the Screen back pill's job — rendering both created two competing Back
// affordances on every step.
export function OnboardingFooter({
  continueDisabled = false,
  continueLabel = 'Continue',
  continueTestID,
  onContinue,
}: OnboardingFooterProps) {
  const sharedOnboardingStyles = useSharedOnboardingStyles();

  return (
    <View style={sharedOnboardingStyles.footerActions}>
      <ActionButton
        disabled={continueDisabled}
        onPress={() => {
          Keyboard.dismiss();
          onContinue();
        }}
        style={[
          sharedOnboardingStyles.primaryAction,
          continueDisabled ? sharedOnboardingStyles.primaryActionDisabled : null,
        ]}
        testID={continueTestID}
      >
        {continueLabel}
      </ActionButton>
    </View>
  );
}

// Accent-tinted lift under the onboarding primary CTA. theme.glass.elevation
// only carries Android dp values, so the iOS shadow spec has no token to map
// to; it is named here instead (see docs/qa/2026-07-22-ui-lift/
// phase-0-delta-ledger.md). Android elevation does map exactly to the glass
// tokens, so those are used.
function createPrimaryCtaShadow(theme: FlorivaTheme) {
  return {
    shadowColor: theme.colors.accentPrimary,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: theme.glass.elevation.raised,
  } as const;
}

export function useSharedOnboardingStyles() {
  const theme = useFlorivaTheme();

  return useMemo(
    () =>
      StyleSheet.create({
        footerActions: {
          flexDirection: 'row',
          gap: theme.spacing.md,
        },
        secondaryAction: {
          flex: 1,
        },
        primaryAction: {
          flex: 1,
          ...createPrimaryCtaShadow(theme),
        },
        primaryActionDisabled: {
          shadowOpacity: 0,
          elevation: theme.glass.elevation.resting,
        },
        rowWrap: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.sm,
        },
        stack: {
          gap: theme.spacing.sm,
        },
      }),
    [theme],
  );
}

export function buildFreshOnboardingProgress(
  draft: FreshOnboardingDraft,
  current: number,
) {
  return {
    current,
    total: draft.ttcEnabled ? 10 : 9,
    variant: 'bar' as const,
  };
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    field: {
      gap: theme.spacing.xs,
    },
    fieldLabel: {
      color: theme.colors.textPrimary,
      ...theme.typography.bodyStrong,
    },
    input: {
      minHeight: 52,
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.colors.inputBorder,
      backgroundColor: theme.colors.inputFill,
      color: theme.colors.textPrimary,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      ...theme.typography.body,
    },
    inputMultiline: {
      minHeight: 132,
    },
    inputError: {
      borderColor: theme.colors.danger,
    },
    errorText: {
      color: theme.colors.danger,
      ...theme.typography.caption,
    },
    alertPanel: {
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.colors.danger,
      backgroundColor: theme.colors.accentSoft,
    },
    alertTitle: {
      color: theme.colors.textPrimary,
      ...theme.typography.bodyStrong,
    },
    alertMessages: {
      gap: theme.spacing.xs,
    },
    alertMessage: {
      color: theme.colors.textSecondary,
      ...theme.typography.body,
    },
    optionContent: {
      gap: theme.spacing.md,
    },
  });
}
