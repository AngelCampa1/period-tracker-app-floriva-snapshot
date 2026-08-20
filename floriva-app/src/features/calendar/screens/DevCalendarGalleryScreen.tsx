import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/src/components/primitives/Screen';
import { SectionCard } from '@/src/components/primitives/SectionCard';
import { SelectionChip } from '@/src/components/primitives/SelectionChip';
import { Text } from '@/src/components/primitives/Text';
import { CalendarGridLegendRow } from '@/src/features/calendar/components/CalendarGridLegendRow';
import {
  CalendarMonthGrid,
  type CalendarMonthGridVariant,
} from '@/src/features/calendar/components/CalendarMonthGrid';
import type { CalendarGridLegend } from '@/src/features/calendar/components/gridVariants/gridVariantContract';
import { legend as quietBandsLegend } from '@/src/features/calendar/components/gridVariants/quietBands';
import {
  calendarDirectionFixtureNames,
  calendarDirectionFixtures,
  type CalendarDirectionFixtureName,
} from '@/src/testing/calendarDirectionFixture';
import {
  buildDevCalendarGalleryStateChipTestId,
  buildDevCalendarGalleryVariantChipTestId,
  testIds,
} from '@/src/testing/testIds';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

/**
 * Dev-only gallery for the Phase 2b calendar redesign: renders the shared
 * CalendarMonthGrid under every variant x deterministic fixture state so
 * reviewers can eyeball Classic + Quiet Bands without seeding the app
 * database. Reached only via the direct deep link
 * floriva:///dev-calendar-gallery -- no navigation entry points anywhere --
 * and the route itself is __DEV__-gated (see app/(app)/dev-calendar-gallery
 * .tsx). Deliberately not localized: dev tooling, English-only.
 */

const variantOptions: { value: CalendarMonthGridVariant; label: string }[] = [
  { value: 'classic', label: 'Classic' },
  { value: 'quiet-bands', label: 'Quiet Bands' },
];

const stateLabels: Record<CalendarDirectionFixtureName, string> = {
  standard: 'standard',
  overlap: 'overlap',
  todayInBand: 'today-in-band',
  stale: 'stale',
};

// The classic renderer predates the variant-module contract, so its legend
// lives here rather than in a gridVariants module.
const classicLegend: CalendarGridLegend = {
  items: [
    { key: 'period', label: 'Period', swatch: 'period' },
    { key: 'predicted', label: 'Predicted', swatch: 'predicted' },
    { key: 'fertile', label: 'Fertile', swatch: 'fertile' },
    { key: 'spotting', label: 'Spotting', swatch: 'spotting' },
    { key: 'today', label: 'Today', swatch: 'today' },
  ],
};

const legendsByVariant: Record<CalendarMonthGridVariant, CalendarGridLegend> = {
  classic: classicLegend,
  'quiet-bands': quietBandsLegend,
};

export function DevCalendarGalleryScreen() {
  const theme = useFlorivaTheme();
  const styles = createStyles(theme);
  const [variant, setVariant] = useState<CalendarMonthGridVariant>('classic');
  const [fixtureName, setFixtureName] = useState<CalendarDirectionFixtureName>('standard');
  const fixture = calendarDirectionFixtures[fixtureName];
  const [selectedDate, setSelectedDate] = useState(fixture.selectedDate);

  const selectFixture = (name: CalendarDirectionFixtureName) => {
    setFixtureName(name);
    setSelectedDate(calendarDirectionFixtures[name].selectedDate);
  };

  // Deep-link driving for the capture sweep: chips stay the interactive path,
  // but floriva:///dev-calendar-gallery?variant=<v>&state=<s> selects a combo
  // without taps (Detox chip taps proved flaky after programmatic scrolls).
  const params = useLocalSearchParams<{ variant?: string; state?: string }>();
  useEffect(() => {
    if (variantOptions.some((option) => option.value === params.variant)) {
      setVariant(params.variant as CalendarMonthGridVariant);
    }
    if (calendarDirectionFixtureNames.includes(params.state as CalendarDirectionFixtureName)) {
      selectFixture(params.state as CalendarDirectionFixtureName);
    }
  }, [params.variant, params.state]);

  return (
    <Screen
      description="Direction x state matrix for the calendar redesign. Dev builds only."
      eyebrow="Dev tools"
      testID={testIds.devCalendarGallery.screen}
      title="Calendar gallery"
    >
      <View style={styles.chipGroup}>
        <Text style={styles.chipGroupLabel}>Direction</Text>
        <View style={styles.chipRow}>
          {variantOptions.map((option) => (
            <SelectionChip
              key={option.value}
              label={option.label}
              onPress={() => setVariant(option.value)}
              selected={variant === option.value}
              testID={buildDevCalendarGalleryVariantChipTestId(option.value)}
            />
          ))}
        </View>
      </View>

      <View style={styles.chipGroup}>
        <Text style={styles.chipGroupLabel}>State</Text>
        <View style={styles.chipRow}>
          {calendarDirectionFixtureNames.map((name) => (
            <SelectionChip
              key={name}
              label={stateLabels[name]}
              onPress={() => selectFixture(name)}
              selected={fixtureName === name}
              testID={buildDevCalendarGalleryStateChipTestId(name)}
            />
          ))}
        </View>
      </View>

      <SectionCard title={`${variant} / ${stateLabels[fixtureName]}`}>
        <View testID={testIds.devCalendarGallery.grid}>
          <CalendarMonthGrid
            buildDayCellAccessibilityLabel={(date) => `Preview day ${date}`}
            dayCellAccessibilityHint="Selects this day in the gallery preview"
            isCompactLayout={false}
            onSelectDate={setSelectedDate}
            selectedDate={selectedDate}
            variant={variant}
            weekdayLabels={fixture.weekdayLabels}
            weeks={fixture.weeks}
          />
        </View>
        {/* Dev-only surface: the legend's plain-English labels are fine here;
            the real CalendarScreen passes i18n'd labels to the same shared
            component. */}
        <CalendarGridLegendRow
          legend={legendsByVariant[variant]}
          testID={testIds.devCalendarGallery.legend}
        />
        <Text style={styles.description} testID={testIds.devCalendarGallery.description}>
          {fixture.description}
        </Text>
      </SectionCard>
    </Screen>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    chipGroup: {
      gap: theme.spacing.sm,
    },
    chipGroupLabel: {
      color: theme.colors.textSecondary,
      ...theme.typography.caption,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
    },
    description: {
      color: theme.colors.textSecondary,
      ...theme.typography.caption,
    },
  });
}
