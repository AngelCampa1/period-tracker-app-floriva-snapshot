# Privacy and security

This document is deliberately unflattering in places.

Floriva was built under a project rule: **never make a privacy claim the
implementation cannot support.** In July 2026 an audit was run to check whether
the shipped product actually honoured that rule. It did not: the marketing had
drifted ahead of the code. That audit is in this repository at
[`floriva-app/docs/strategy/`](../floriva-app/docs/strategy/), and this document
is written from it.

What follows separates, precisely, what Floriva does from what it was sometimes
said to do.

---

## 1. What is true

### No server, no account, no sync

There is no Floriva backend. Not "a backend we don't send much to": none
exists, and none ever did. There is no account system, no login, no user
identifier, no sync service.

### No network calls in application code

```bash
grep -rE "\bfetch\(|XMLHttpRequest|new WebSocket|axios|EventSource" \
  src app components constants drizzle
# 0 matches
```

Zero call sites. The app cannot phone home because there is no code that phones.

### Every egress path is an OS hand-off the user initiates

There are exactly eight ways anything leaves the app, and all of them are the
operating system taking over:

| Path | Trigger |
| --- | --- |
| StoreKit / Play Billing (`expo-iap`) | User taps purchase or restore |
| System review sheet (`expo-store-review`) | Review prompt |
| `mailto:` support link | User taps contact support |
| `Linking.openURL` → privacy policy | User taps the link |
| `Linking.openURL` → terms | User taps the link |
| `Linking.openURL` → manage subscription | User taps manage |
| Document picker (import) | User selects a file |
| Share sheet (backup export) | User exports a backup |

None of these carry reproductive-health data. The backup export carries an
encrypted file the user explicitly created and chose where to send.

### No analytics, crash reporting, ad SDK, or session replay

Every one of the 47 runtime dependencies was reviewed individually. None is an
analytics, attribution, crash-reporting, or advertising SDK. None was ever
added and later removed, either.

`ios/Floriva/PrivacyInfo.xcprivacy` declares `NSPrivacyTracking = false` with an
empty `NSPrivacyCollectedDataTypes`. That is a *declaration*; the grep above is
the evidence.

### Notifications are local-only

`expo-notifications` is used purely for locally scheduled reminders. No push
token API is called anywhere in the codebase: no `getExpoPushTokenAsync`, no
`getDevicePushTokenAsync`.

### Android is genuinely locked down

`android/app/src/main/AndroidManifest.xml` sets `android:allowBackup="false"`,
and `res/xml/secure_store_data_extraction_rules.xml` excludes the database,
shared preferences, and files from **both** cloud backup and device transfer:

```xml
<data-extraction-rules>
  <cloud-backup>
    <exclude domain="sharedpref" path="."/>
    <exclude domain="database" path="."/>
    <exclude domain="file" path="."/>
  </cloud-backup>
  <device-transfer>
    <exclude domain="sharedpref" path="."/>
    <exclude domain="database" path="."/>
    <exclude domain="file" path="."/>
  </device-transfer>
</data-extraction-rules>
```

The manifest also actively *removes* permissions the Expo dependency graph
would otherwise contribute (external storage read/write, `RECORD_AUDIO`, and
both foreground-service permissions) using `tools:node="remove"`.

---

## 2. What is not true, and was never claimed here

These are the statements a period-tracker README is tempted to make. Each one is
false for Floriva, with the code that disproves it.

### "Encrypted local storage"

False. The database is an ordinary SQLite file:

```ts
// floriva-app/src/db/client.ts
const sqlite = openDatabaseSync('floriva.db');
sqlite.execSync('PRAGMA foreign_keys = ON;');
```

No SQLCipher, no key, no application-layer cipher. The database, its WAL, and
its SHM files are plaintext on disk, protected only by the OS sandbox and
whatever file-protection class the platform applies by default.

**The true version:** cycle data lives in a local SQLite database inside the
app's private sandbox and never on a server. Application-layer encryption with a
migratable key hierarchy was scoped, designed, and written up as its own
release. The company closed before it shipped.

### "Encrypted with your biometrics"

False. `floriva-app/src/lib/security/biometricLock.ts` stores a random *marker*:

```ts
export async function armBiometricLock() {
  await SecureStore.setItemAsync(
    BIOMETRIC_LOCK_SECRET_KEY,
    `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
  );
}
```

That value is an armed-flag. It is not a key and it decrypts nothing. Unlocking
calls `LocalAuthentication.authenticateAsync` and flips React state.

**The true version:** biometric lock is an app-access screen gate built on the
device's own enrolment, with device-passcode fallback. It gates the UI, not the
bytes.

One thing it does do well is fail closed:

```ts
} catch {
  // Fail CLOSED: if the keychain cannot be read we cannot prove the lock is
  // disarmed, so we must not silently bypass it.
  return true;
}
```

### "Your data never leaves your device" / "no cloud"

Too broad, on iOS. Nothing in the project excludes the app container from
Apple's device backup: there is no `NSURLIsExcludedFromBackupKey` anywhere in
`src`, `app`, `ios/Floriva`, `scripts`, or `app.config.ts`. The plaintext
database and any `.floriva` export written to the documents directory are both
eligible for iCloud and encrypted local backup.

**The true version:** Floriva operates no cloud, no account, and no sync
service. On Android its data is additionally excluded from OS backup and device
transfer. On iOS the database remains eligible for Apple's normal device backup;
Floriva does not control that path.

That distinction (*we run no cloud* rather than *your data touches no cloud*)
is the one the audit landed on, and it is fully provable.

### "Sensitive data loads only after you unlock"

False. In `floriva-app/src/features/app-shell/AppShellProvider.tsx` the user
profile is fetched in the **same `Promise.all`** as the lock check:

```ts
const [nextPreferences, billingSnapshot, profile, persistedPrivacyPreference,
       biometricLockArmed, ...] = await Promise.all([
  appPreferencesRepository.getPreferences(),
  billingSnapshotRepository.getSnapshot(),
  userProfileRepository.getProfile(),      // <- cycle data, in memory
  privacyPreferencesRepository.getPreference(),
  isBiometricLockArmed(),                  // <- lock decision, same pass
  ...
]);
```

The lock decision is computed afterwards. There is also no app-switcher
snapshot cover and no `FLAG_SECURE`. Both were logged as pre-release blockers in
the self-audit. One in-app string still reads "Your data was not read" on a
failed unlock: accurate about the screen, misleading about memory, and the
first thing that should have been fixed.

### "Securely erased"

Overstated. Delete-all is 15 `DELETE` statements wrapped in one transaction
(`floriva-app/src/db/repositories.ts`, `wipeLocalData()` → `clearAllLocalTables()`
at `:706-721`), one per table. There is no `VACUUM`,
no `PRAGMA secure_delete`, no WAL checkpoint, no file recreation.

**The true version:** delete-all removes every row across all 15 tables in a
single transaction and clears the keychain marker, the persisted route, and the
onboarding draft. It does not additionally vacuum or recreate the database file.

Note the precision: the audit recorded this as an *unmeasured* erasure
guarantee, not as "leaves recoverable remnants." Remanence was never tested, so
the negative claim would be as unfounded as the positive one.

### "Zero-knowledge" / "end-to-end encrypted"

Category errors. Zero-knowledge describes a server holding ciphertext it cannot
read; Floriva has no server. End-to-end encryption is a property of a
transmission channel; Floriva has no transmission.

This is the exact claim the audit filed as its only P0: the public marketing was
using "encrypted sync" and "zero-knowledge" for a product with no sync at all.

### "HIPAA compliant"

Not applicable. HIPAA binds covered entities and business associates. A consumer
app with no covered-entity relationship, no BAA, and no compliance artifact
cannot be "HIPAA compliant": the term simply does not attach.

### "Privacy-safe crash reporting"

Inert, not false-by-design. There is a real consent gate and a real redaction
layer in `floriva-app/src/lib/diagnostics/`, and both work. But the transport
is `async () => undefined`, and `setRuntimeDiagnosticTransport` is never called.
The user-facing toggle controls nothing. The audit filed this with a binary fix:
remove the control, or implement a local ring buffer.

---

## 3. The backup export: the one thing that is genuinely encrypted

[`floriva-app/src/features/backup/backupPackage.ts`](../floriva-app/src/features/backup/backupPackage.ts)

- **AES-256-GCM** for the payload
- **PBKDF2-SHA256, 210,000 iterations**, 16-byte random salt, 12-byte nonce
- Randomness from `expo-crypto`'s `getRandomBytes` (CSPRNG on both platforms)
- Fresh salt and nonce per export; no key is persisted anywhere

Three decisions worth reading:

**KDF bounds are enforced at decrypt time.** The envelope declares its own
iteration count, so an attacker could otherwise supply `1` to weaken the KDF or
`10^9` to hang the device:

```ts
// Iteration-count bounds enforced at *decrypt* time so an attacker-controlled
// header cannot be used to weaken KDF cost (low bound) or cause a DoS (high
// bound).
const backupPbkdf2MinIterations = 100_000;
const backupPbkdf2MaxIterations = 10_000_000;
```

**An entire passphrase collision class is refused.** PBKDF2's inner HMAC
zero-pads its key block, so a passphrase of NUL bytes derives the same key as an
empty one:

```ts
function isUsablePassphrase(passphrase: string) {
  const bytes = textEncoder.encode(passphrase);
  return bytes.some((byte) => byte !== 0);
}
```

**The key check is constant-time**, accumulating XOR differences rather than
returning early.

### Its limitations

The envelope header is **cleartext and outside the AEAD**:

```json
{
  "formatVersion": 1,
  "createdAt": "2026-08-18T...",
  "kdf":        { "algorithm": "pbkdf2-sha256", "iterations": 210000, "saltBase64": "..." },
  "encryption": { "algorithm": "aes-256-gcm", "nonceBase64": "...",
                  "ciphertextBase64": "...", "keyCheckBase64": "..." }
}
```

`gcm(derivedKey, nonce).encrypt(plaintextBytes)` is called with no additional
authenticated data. So: **the health payload is encrypted and authenticated; the
metadata describing how to decrypt it is not.** That is a deliberate trade for a
self-describing file format. Header tampering with the salt, nonce, or iteration
count is caught indirectly (decryption simply fails the GCM tag), but the
creation timestamp is readable and forgeable.

Two further notes, stated rather than spun:

- `keyCheckBase64` publishes `sha256(derivedKey ‖ "floriva-backup-key-check")`,
  which gives an offline passphrase-guessing oracle. It does not meaningfully
  weaken the file (the GCM tag already provides one), but it is not a security
  feature either.
- **210,000 iterations is OWASP's figure for PBKDF2-SHA512.** For SHA-256 the
  recommendation is 600,000. The parameters are stated here so a reader can
  judge them rather than take a label for it.

---

## 4. The Firebase footnote

An audit of the *source tree* concluded there was no third-party tracking code.
An audit of the *shipped Android artifact* found something the source could not
show: `expo-notifications` hard-depends on Firebase Cloud Messaging.

```gradle
// node_modules/expo-notifications/android/build.gradle:42
implementation 'com.google.firebase:firebase-messaging:24.0.1'
```

The release AAB therefore contains Firebase messaging, installations, and
Google's datatransport classes. The merged release manifest registers
`FirebaseMessagingService` and requests `c2dm.permission.RECEIVE`.

**Mitigation, stated honestly:** there is no `google-services.json` anywhere in
the project, so `FirebaseInitProvider` cannot construct a default Firebase app,
and no push token is ever requested by any code path. This is a *"does not
fire"* argument, not a *"not present"* argument, and it is static inference: no
packet capture was performed to confirm silence on the wire.

The shipped iOS `Info.plist` also carries `NSAllowsLocalNetworking = true`
(inherited from `expo-dev-client`), alongside `NSAllowsArbitraryLoads = false`.
That permits cleartext to local-network addresses only, not the public internet.

This section exists because it is the kind of thing a portfolio usually omits.
It was found by disassembling our own release build, which is the only way it
*could* have been found.

---

## 5. Known limitations register

Carried forward from the self-audit, none of them fixed before the product was
retired:

| | Limitation |
| --- | --- |
| SEC | Local database is not encrypted at the application layer |
| SEC | No iOS backup exclusion; database is iCloud-backup-eligible |
| PRIV | Profile state hydrates in the same pass as the lock check |
| PRIV | No app-switcher snapshot cover; no `FLAG_SECURE` |
| DATA | Delete-all does not vacuum or recreate the database file |
| DIAG | Diagnostics consent and redaction feed a no-op transport |
| PRED | Cycle-length fallback can average unfiltered intervals with no upper cap |
| A11Y | See the accessibility audit in `floriva-app/docs/qa/` |

Publishing this list is the point. A privacy posture you can only describe in
adjectives is not one that has been examined.
