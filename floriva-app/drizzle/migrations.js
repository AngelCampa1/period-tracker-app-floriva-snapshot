// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import journal from './meta/_journal.json';
import m0000 from './0000_natural_power_pack.sql';
import m0001 from './0001_wise_killmonger.sql';
import m0002 from './0002_wave4_control_surfaces.sql';
import m0003 from './0003_phase3_ttc_tracking_preferences.sql';
import m0004 from './0004_phase4_billing_snapshot.sql';
import m0005 from './0005_phase9_diagnostics_consent.sql';
import m0006 from './0006_phase10_theme_preference.sql';
import m0007 from './0007_phase11_locale_preference.sql';
import m0008 from './0008_phase12_review_prompt_state.sql';
import m0009 from './0009_phase12_complimentary_access.sql';
import m0010 from './0010_phase13_native_store_billing.sql';
import m0011 from './0011_phase14_interaction_feedback.sql';
import m0012 from './0012_phase15_tailoring_checklist.sql';
import m0013 from './0013_fertility_estimates_preference.sql';
import m0014 from './0014_floriva_plus_timeline.sql';
import m0015 from './0015_birth_control_setup.sql';
import m0016 from './0016_grandfather_trial_applied.sql';
import m0017 from './0017_dismissed_anomaly_ids.sql';
import m0018 from './0018_iud_subtype.sql';
import m0019 from './0019_lifetime_trial_started_at.sql';

export default {
  journal,
  migrations: {
    m0000,
    m0001,
    m0002,
    m0003,
    m0004,
    m0005,
    m0006,
    m0007,
    m0008,
    m0009,
    m0010,
    m0011,
    m0012,
    m0013,
    m0014,
    m0015,
    m0016,
    m0017,
    m0018,
    m0019,
  },
};
