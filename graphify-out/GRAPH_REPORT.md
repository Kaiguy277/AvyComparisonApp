# Graph Report - .  (2026-08-07)

## Corpus Check
- 119 files · ~159,541 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 936 nodes · 1760 edges · 108 communities (51 shown, 57 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 10 edges (avg confidence: 0.87)
- Token cost: 254,038 input · 0 output

## Community Hubs (Navigation)
- Zone Detail & Forecast Screens
- Avalanche Summary Edge Function
- Observation Submit Pipeline
- Metric Charts & Station Tiles
- Expo App Config
- Zone Pickers & Buttons
- Observation Form Screen
- Cache Refresh Edge Functions
- Avalanche Entry Constants
- Home Screen & Branding
- Root Layout & Permissions
- Forecast API Types
- Observation Zod Schemas
- Weather Forecast Edge Function
- Package & Lint Config
- Background Refresh & Offline Cache
- README Architecture Docs
- SNOTEL API Module
- Observation Form Primitives
- Danger Display Components
- Zone Card Component
- TypeScript Config
- Expo Dependencies
- Push Notifications & Supabase Client
- Headline & Mountain Danger
- Date Field & Plugins
- Zone Tile Component
- Problem Card & Badge
- Select Field Components
- Problem Rose Diagram
- Supabase Functions Shared
- Lib Api Avalanche
- Components Observation Photopicker
- Components Visual Topobackground
- Hooks Use Theme
- Lib Debugmode
- Assets Images Icon
- Supabase Migrations 20260504010000
- Metro Config
- Supabase Functions Send
- Supabase Functions Shared
- Supabase Migrations 20260502020000
- Assets Images Android
- Assets Images Android
- Eslint Config
- Readme Eas Build
- Supabase Migrations 20260502000000
- Supabase Migrations 20260506000000
- Assets Images Favicon
- Assets Images Wordmark
- Expo Background Fetch
- Expo Blur
- Expo Constants
- Expo Font
- Expo Google Fonts
- Expo Haptics
- Expo Image
- Expo Image Manipulator
- Expo Linear Gradient
- Expo Linking
- Expo Location
- Expo Notifications
- Expo Router
- Expo Splash Screen
- Expo Status Bar
- Expo Symbols
- Expo System Ui
- Expo Vector Icons
- Expo Web Browser
- Nativewind
- Package Dependencies React
- Package Dependencies React
- Package Dependencies React
- Package Dependencies React
- Package Dependencies React
- Package Dependencies React
- Package Dependencies React
- Package Dependencies React
- Package Dependencies React
- Package Dependencies React
- Package Dependencies React
- Package Dependencies React
- Package Dependencies React
- Package Dependencies React
- Package Dependencies React
- Package Dependencies React
- Package Dependencies React
- Package Dependencies React
- Package Dependencies React
- Package Dependencies Supabase
- Package Dependencies Tailwindcss
- Package Dependencies Tanstack
- Package Dependencies Zod
- Scripts Check Device
- Scripts Tunnel
- Supabase Functions Get
- Supabase Migrations 20260503000000
- Public Device Tokens
- Readme Expo Go

## God Nodes (most connected - your core abstractions)
1. `Text()` - 39 edges
2. `palette` - 37 edges
3. `AVAILABLE_ZONES` - 22 edges
4. `ObservationNewScreen()` - 19 edges
5. `loadSnapshot()` - 18 edges
6. `Index()` - 17 edges
7. `expo` - 16 edges
8. `getZoneSession()` - 15 edges
9. `expo-router` - 14 edges
10. `AvalancheZone` - 14 edges

## Surprising Connections (you probably didn't know these)
- `Index()` --calls--> `toggleDebugMode()`  [EXTRACTED]
  app/index.tsx → lib/debugMode.ts
- `Index()` --calls--> `formatAge()`  [EXTRACTED]
  app/index.tsx → lib/offlineCache.ts
- `Index()` --calls--> `loadFavorites()`  [EXTRACTED]
  app/index.tsx → lib/offlineCache.ts
- `Index()` --calls--> `loadSnapshot()`  [EXTRACTED]
  app/index.tsx → lib/offlineCache.ts
- `Index()` --calls--> `pruneSnapshot()`  [EXTRACTED]
  app/index.tsx → lib/offlineCache.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Features Served via Supabase Edge Functions** — readme_supabase, readme_snotel_data, readme_nws_weather_outlook, readme_quick_take_ai [EXTRACTED 1.00]
- **iOS Distribution Pipeline (EAS Build → eas submit → TestFlight)** — readme_eas_build, readme_eas_json_submit_config, readme_testflight_distribution [EXTRACTED 1.00]

## Communities (108 total, 57 thin omitted)

### Community 0 - "Zone Detail & Forecast Screens"
Cohesion: 0.05
Nodes (64): collectSections(), extractAvgText(), extractNacText(), Section, ZoneFullForecastScreen(), ageColor(), DayColumn(), freshnessColor() (+56 more)

### Community 1 - "Avalanche Summary Edge Function"
Cohesion: 0.05
Nodes (50): ASPECT_MAP, buildZoneDataFromCache(), CacheEntry, CacheStatus, calculateFreshness(), corsHeaders, deriveKeyMessage(), deriveTravelAdvice() (+42 more)

### Community 2 - "Observation Submit Pipeline"
Cohesion: 0.07
Nodes (40): ObservationDraftsBanner(), BusyBody(), busyLabel(), Props, SubmitProgress(), exifDateToYmd(), observationApiConfig, ObservationApiError (+32 more)

### Community 3 - "Metric Charts & Station Tiles"
Cohesion: 0.06
Nodes (28): ChartMode, formatNum(), formatTickTime(), MetricChart(), Props, SeriesSpec, formatFetchedClock(), formatSnowDelta() (+20 more)

### Community 4 - "Expo App Config"
Cohesion: 0.06
Nodes (32): backgroundColor, foregroundImage, monochromeImage, adaptiveIcon, edgeToEdgeEnabled, predictiveBackGestureEnabled, projectId, reactCompiler (+24 more)

### Community 5 - "Zone Pickers & Buttons"
Cohesion: 0.09
Nodes (26): animateNext(), HierarchicalZoneSelector(), Props, CenterMeta, FLAT_CENTERS, HTML, Props, ZoneMapPicker() (+18 more)

### Community 6 - "Observation Form Screen"
Cohesion: 0.15
Nodes (25): firstName(), isSectionComplete(), mergeSectionNotes(), NOTE_LABELS, ObservationNewScreen(), SECTION_ORDER, sectionForPath(), SectionKey (+17 more)

### Community 7 - "Cache Refresh Edge Functions"
Cohesion: 0.10
Nodes (17): AvalancheItem, corsHeaders, MediaItem, NacObsPayload, shapeMedia(), summarize(), ZONE_TO_CENTER, corsHeaders (+9 more)

### Community 8 - "Avalanche Entry Constants"
Cohesion: 0.10
Nodes (23): AvalancheEntryCard(), Props, ActivityValue, ASPECT_OPTIONS, AspectValue, AVALANCHE_TRIGGER_ADVANCED, AVALANCHE_TRIGGER_COMMON, AVALANCHE_TRIGGER_OPTIONS (+15 more)

### Community 9 - "Home Screen & Branding"
Cohesion: 0.13
Nodes (18): Index(), months, viewedDateLabel(), WEEKDAY_SHORT, K.AI Consulting LLC Logo (tree/brain mark), K.AI Consulting LLC Brand Identity, Card(), CardContent() (+10 more)

### Community 10 - "Root Layout & Permissions"
Cohesion: 0.14
Nodes (18): LocationWakeBanner(), navTheme, queryClient, RootLayout(), PermissionsIntro(), PermState, Props, registerBackgroundRefresh() (+10 more)

### Community 11 - "Forecast API Types"
Cohesion: 0.12
Nodes (21): WeatherForecastBundle, Props, WeatherForecastCard(), AvalancheResponse, AvalancheSummary, AvgDiscussion, AvgLocation, CachedForecastResponse (+13 more)

### Community 12 - "Observation Zod Schemas"
Cohesion: 0.09
Nodes (21): activityValueSchema, aspectValueSchema, avalancheEntryFormSchema, avalancheTypeValueSchema, AvalancheWirePayload, avalancheWirePayloadSchema, bedSurfaceValueSchema, distributionValueSchema (+13 more)

### Community 13 - "Weather Forecast Edge Function"
Cohesion: 0.13
Nodes (19): AVG_ZONE_KEYWORDS, corsHeaders, extractShortForecast(), fetchAvgProduct(), fetchNacWeather(), fetchNwsZoneForecast(), isDaytimePeriod(), nacHeaders (+11 more)

### Community 14 - "Package & Lint Config"
Cohesion: 0.10
Nodes (20): eslint, eslint-config-expo, devDependencies, eslint, eslint-config-expo, @types/react, typescript, main (+12 more)

### Community 15 - "Background Refresh & Offline Cache"
Cohesion: 0.16
Nodes (14): BG_TASK_NAME, LastRefreshRecord, refreshFavoritesSnapshot(), writeLastRefresh(), isoDate(), loadFavorites(), looksLikeDateMap(), OFFLINE_HISTORY_DAYS (+6 more)

### Community 16 - "README Architecture Docs"
Cohesion: 0.12
Nodes (20): AsyncStorage (zone & Quick Take preferences), lib/api/avalanche.ts API Wrapper for Edge Functions, AvalancheComparison (Web Version), Avy Comparison iPhone App, Expo Router (file-based routing), Expo SDK 54 + React Native 0.81 + React 19, app/index.tsx Avalanche Summary Screen (single-route app), NativeWind v4 (Tailwind in React Native) (+12 more)

### Community 17 - "SNOTEL API Module"
Cohesion: 0.17
Nodes (18): AWDBDataPoint, AWDBElement, AWDBResponse, fetchMultipleStations(), fetchStationObservations(), getAvg(), getHourlyData(), getLatestValue() (+10 more)

### Community 18 - "Observation Form Primitives"
Cohesion: 0.13
Nodes (12): CollapsibleSection, Props, FieldError(), FormSection, Option, TextField(), TextFieldProps, YesNoSwitch() (+4 more)

### Community 19 - "Danger Display Components"
Cohesion: 0.19
Nodes (8): DangerStack(), DangerStackProps, ELEVATION_LABELS, ElevationPyramid(), ElevationPyramidProps, dangerColors, freshness, DangerRating

### Community 20 - "Zone Card Component"
Cohesion: 0.15
Nodes (11): ageColor(), formatRelativeDate(), hasForecasterDiscussion(), highest(), MONTH, RATING_ABBREV, RATING_ORDER, WEEKDAY (+3 more)

### Community 21 - "TypeScript Config"
Cohesion: 0.13
Nodes (14): expo-env.d.ts, expo/tsconfig.base, .expo/types/**/*.ts, nativewind-env.d.ts, node_modules, supabase, **/*.ts, **/*.tsx (+6 more)

### Community 22 - "Expo Dependencies"
Cohesion: 0.15
Nodes (13): expo, expo-device, @expo-google-fonts/instrument-serif, @expo-google-fonts/jetbrains-mono, expo-image-picker, expo-task-manager, dependencies, expo (+5 more)

### Community 23 - "Push Notifications & Supabase Client"
Cohesion: 0.24
Nodes (10): PushDiagnosticLine(), readLastRefresh(), looksLikeNetworkError(), PUSH_REFRESH_TASK, PushDiagnostic, readPushDiagnostic(), requestAndRegister(), runRegistration() (+2 more)

### Community 24 - "Headline & Mountain Danger"
Cohesion: 0.23
Nodes (8): HeadlineDanger(), highestRating(), Props, titleCase(), MountainDanger(), PATHS, Props, ElevationDanger

### Community 25 - "Date Field & Plugins"
Cohesion: 0.24
Nodes (10): plugins, DateField(), formatLong(), MONTH_LONG, Props, startOfDay(), WEEKDAY_LONG, FieldLabel() (+2 more)

### Community 26 - "Zone Tile Component"
Cohesion: 0.31
Nodes (9): formatFetchedClock(), formatLikelihood(), formatSnowDelta(), formatStationTime(), freshnessColor(), highestStation(), likelihoodColor(), StationStatProps (+1 more)

### Community 27 - "Problem Card & Badge"
Cohesion: 0.27
Nodes (8): AvalancheProblemCard(), formatSize(), Props, Badge(), BadgeProps, BadgeVariant, variantStyles, AvalancheProblem

### Community 28 - "Select Field Components"
Cohesion: 0.25
Nodes (5): MultiSelectField(), MultiSelectFieldProps, Option, SelectField(), SelectFieldProps

### Community 29 - "Problem Rose Diagram"
Cohesion: 0.38
Nodes (6): ASPECT_BASE_ANGLE, ASPECTS, elevationToRingIndex(), ProblemRose(), Props, AspectElevation

### Community 31 - "Lib Api Avalanche"
Cohesion: 0.40
Nodes (6): Props, Props, Props, AvalancheZone, ZoneWeatherForecast, ZoneSnapshot

### Community 32 - "Components Observation Photopicker"
Cohesion: 0.40
Nodes (3): PhotoPicker(), Props, LocalImageWithCaption

### Community 33 - "Components Visual Topobackground"
Cohesion: 0.33
Nodes (5): CONTOURS, PEAKS, Props, TopoBackground(), { width }

### Community 35 - "Lib Debugmode"
Cohesion: 0.47
Nodes (5): listeners, notify(), parse(), toggleDebugMode(), useDebugMode()

### Community 36 - "Assets Images Icon"
Cohesion: 0.40
Nodes (5): App Icon (Tree / Mountain Logo), Avalanche / Backcountry Terrain Theme, Mountain-Tree Hybrid Brand Motif, Splash Icon (Tree/Mountain Split Logo), App Brand Identity: Forest-Alpine Duality

### Community 37 - "Supabase Migrations 20260504010000"
Cohesion: 0.50
Nodes (4): cron.job, cron.job_run_details, public.audit_pipeline_jobs(), public.audit_pipeline_runs()

### Community 38 - "Metro Config"
Cohesion: 0.50
Nodes (3): config, { getDefaultConfig }, { withNativeWind }

### Community 39 - "Supabase Functions Send"
Cohesion: 0.50
Nodes (3): corsHeaders, ExpoPushMessage, ExpoPushTicket

### Community 40 - "Supabase Functions Shared"
Cohesion: 0.83
Nodes (3): ALLOWED_ORIGINS, getCorsHeaders(), handleCorsPreflightRequest()

### Community 42 - "Assets Images Android"
Cohesion: 0.67
Nodes (3): Android Adaptive Icon Foreground (Tree/Mountain Logo), AvyComparisonApp Brand Mark, Mountain / Backcountry Visual Theme

### Community 43 - "Assets Images Android"
Cohesion: 0.67
Nodes (3): Android Monochrome App Icon (Mountain Chevron), Android Adaptive Icon (Themed Monochrome Layer), Mountain Peak / Chevron Brand Motif

### Community 45 - "Readme Eas Build"
Cohesion: 0.67
Nodes (3): EAS Build (production iOS builds), eas.json submit.production.ios Config (ascAppId, appleTeamId), TestFlight Distribution via eas submit

## Ambiguous Edges - Review These
- `App Icon (Tree / Mountain Logo)` → `Splash Icon (Tree/Mountain Split Logo)`  [AMBIGUOUS]
  assets/images/splash-icon.png · relation: semantically_similar_to

## Knowledge Gaps
- **293 isolated node(s):** `name`, `slug`, `version`, `orientation`, `icon` (+288 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **57 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `App Icon (Tree / Mountain Logo)` and `Splash Icon (Tree/Mountain Split Logo)`?**
  _Edge tagged AMBIGUOUS (relation: semantically_similar_to) - confidence is low._
- **Why does `expo-router` connect `Zone Detail & Forecast Screens` to `Metric Charts & Station Tiles`, `Observation Form Screen`, `Home Screen & Branding`, `Root Layout & Permissions`, `Date Field & Plugins`, `Zone Tile Component`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Why does `plugins` connect `Date Field & Plugins` to `Zone Detail & Forecast Screens`, `Expo App Config`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Why does `expo` connect `Expo App Config` to `Date Field & Plugins`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **What connects `name`, `slug`, `version` to the rest of the system?**
  _293 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Zone Detail & Forecast Screens` be split into smaller, more focused modules?**
  _Cohesion score 0.05307950727883538 - nodes in this community are weakly interconnected._
- **Should `Avalanche Summary Edge Function` be split into smaller, more focused modules?**
  _Cohesion score 0.05129561078794289 - nodes in this community are weakly interconnected._