# Avy Comparison

iPhone app for comparing avalanche forecasts side by side, with live SNOTEL
weather station data and NWS mountain weather outlooks.

Native port of [AvalancheComparison](../AvalancheComparison) (the web version).
The Supabase backend is shared between web and mobile — no backend changes were
needed.

## Stack

- Expo SDK 54 + React Native 0.81 + React 19
- Expo Router (file-based routing)
- NativeWind v4 (Tailwind classes in RN)
- Supabase (forecast cache, edge functions for SNOTEL / weather / Quick Take AI)
- TanStack Query
- AsyncStorage (zone & Quick Take preferences)
- react-native-svg (temperature sparklines)

## Develop with Expo Go

```sh
npm install
npx expo start
```

Scan the QR code with the Expo Go app on iOS. All current dependencies are
included in Expo Go's standard runtime, so no dev client is required for
day-to-day work.

## Distribute through TestFlight

Production builds run on [EAS Build](https://docs.expo.dev/build/introduction/)
and submit to App Store Connect via `eas submit`.

```sh
# Build a release IPA on EAS' macOS workers
eas build --platform ios --profile production

# Upload to App Store Connect → TestFlight
eas submit --platform ios --latest
```

Before the first submit, fill in the `submit.production.ios` block in
`eas.json`:

- `ascAppId` — App Store Connect app ID (create the app shell first at
  appstoreconnect.apple.com, then copy the numeric ID from the URL)
- `appleTeamId` — Apple Developer team ID (Membership page in
  developer.apple.com)

EAS will prompt for an App Store Connect API key on the first build — generate
one in App Store Connect → Users and Access → Integrations → App Store Connect
API.

Bundle identifier: `com.kaimyers.avycomparison`

## Project layout

```
app/                       Expo Router screens
  _layout.tsx              Root stack + providers (QueryClient, theme)
  index.tsx                Avalanche summary screen (single-route app)
components/
  avalanche/               Domain components (zone selector, cards, sparkline)
  ui/                      Generic UI primitives (Card, Badge, Button, etc.)
constants/                 Theme tokens
hooks/                     Color scheme hook
lib/
  supabase.ts              Supabase client (AsyncStorage-backed auth)
  api/avalanche.ts         API wrapper around the Supabase edge functions
  zones.ts                 Region/center/zone hierarchy
```

## Environment

`.env` holds the public Supabase URL and anon key (intentionally public; RLS
gates write access). Expo exposes any var prefixed with `EXPO_PUBLIC_` to the
client bundle.
