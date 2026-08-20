/**
 * Prints the oldest seeded logDate for a tenure fixture variant, anchored on
 * the local "today" (same anchor the app uses when the dev-launch preset
 * seeds the database at runtime). Used by scripts/run-tenure-sweep.sh to
 * deep-link the "oldest day" surface during the long-tenure visual sweep.
 *
 * Usage: pnpm exec tsx scripts/print-tenure-oldest-date.ts <variant> [todayIso]
 */
import {
  buildTenureDataset,
  tenureFixtureVariantValues,
  type TenureFixtureVariant,
} from '../src/testing/tenureFixtures';
import { getLocalTodayLogDate } from '../src/features/logging/date';

const variant = process.argv[2] as TenureFixtureVariant | undefined;

if (!variant || !tenureFixtureVariantValues.includes(variant)) {
  process.stderr.write(
    `Usage: tsx scripts/print-tenure-oldest-date.ts <${tenureFixtureVariantValues.join('|')}> [todayIso]\n`,
  );
  process.exit(1);
}

const todayIso = process.argv[3] ?? getLocalTodayLogDate();
const dataset = buildTenureDataset(variant, todayIso);
const oldest = dataset.dailyLogs
  .map((entry) => entry.logDate)
  .sort()[0];

if (!oldest) {
  process.stderr.write(`Variant ${variant} produced no daily logs.\n`);
  process.exit(1);
}

process.stdout.write(`${oldest}\n`);
