# Floriva Release-Pass Preflight

- Date: 2026-05-05
- Timezone: America/Monterrey
- Repo: ~/Code/floriva
- App: ~/Code/floriva/floriva-app
- Requested scope: iOS Simulator + Android Emulator, full manual release-pass

## Git Status
## main...origin/main
?? floriva-app/docs/qa/2026-05-05-release-pass/
?? node_modules/

## Runtime
node: v22.22.0
pnpm: 10.33.0

## iOS Simulators
== Devices ==
-- iOS 26.4 --
    iPhone 17 Pro (30F94D47-94E8-4B54-ADDC-1642B8D8E8AA) (Shutdown)
    iPhone 17 Pro Max (21975E81-8228-4DCA-8AA8-6DE8239A6930) (Shutdown)
    iPhone 17e (5BFB50A0-0F9E-4939-8A86-6E72F45AF70A) (Shutdown)
    iPhone Air (2BE32B8A-29F6-46C6-A399-99FBBC116F03) (Shutdown)
    iPhone 17 (2B9F547F-E6A8-409B-85EE-968CBA23DE20) (Shutdown)
    iPhone 17-Detox (838BA66A-AA11-4EAD-BF2A-CC3A554210ED) (Shutdown)
    iPad Pro 13-inch (M5) (284205DE-2021-4366-9CCB-B5A873583365) (Shutdown)
    iPad Pro 11-inch (M5) (FE77A56E-0479-4DDB-ACAC-16991F678C4F) (Shutdown)
    iPad mini (A17 Pro) (7BB01CC2-E7F1-40AE-AA74-BCE2816A3465) (Shutdown)
    iPad Air 13-inch (M4) (CA8FC4DE-54BF-4978-BDCB-40BA6131651B) (Shutdown)
    iPad Air 11-inch (M4) (8757DACD-DA2E-4868-92B7-D355ED48D5A0) (Shutdown)
    iPad (A16) (7C4DC820-F78D-4BCB-80FD-003A27A80777) (Shutdown)
-- watchOS 26.4 --
    Apple Watch Series 11 (46mm) (9CE33B10-26FE-4C45-871F-32F23C6ED7E4) (Shutdown)
    Apple Watch Series 11 (42mm) (9D22CFC3-20E8-4189-A976-F90DD33E4EFA) (Shutdown)
    Apple Watch Ultra 3 (49mm) (735FBBDD-088C-4C51-B744-4F7FFE0F2BCD) (Shutdown)
    Apple Watch SE 3 (44mm) (54C39ABF-5C53-4CAD-967A-047A472664BC) (Shutdown)
    Apple Watch SE 3 (40mm) (3A36B0D4-6294-4FA3-8D0D-F367EF698560) (Shutdown)

## Android Devices
List of devices attached


## App Config
26:    bundleIdentifier: 'app.floriva',
27:    buildNumber: '9',
42:    package: 'app.floriva',
86:      monthlyPriceLabel: '$5.99/month',
87:      annualPriceLabel: '$39.99/year',
88:      lifetimePriceLabel: '$59.99',
92:      privacyPolicyUrl:
94:      supportUrl: process.env.EXPO_PUBLIC_SUPPORT_URL ?? 'https://floriva.app/support',
