import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  findNodeHandle,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";

import { Text } from "@/components/ui/Text";
import { palette } from "@/constants/design";
import {
  ZoneScreenContainer,
  ZoneScreenHeader,
} from "@/components/avalanche/ZoneScreenChrome";
import { AvalancheEntryCard } from "@/components/observation/AvalancheEntry";
import { CollapsibleSection } from "@/components/observation/CollapsibleSection";
import { DateStrip } from "@/components/observation/DateStrip";
import {
  ChipPicker,
  FieldLabel,
  MultiChipPicker,
  TextField,
  YesNoSwitch,
} from "@/components/observation/formPrimitives";
import { LocationField } from "@/components/observation/LocationField";
import { PhotoPicker } from "@/components/observation/PhotoPicker";
import { SubmitProgress } from "@/components/observation/SubmitProgress";
import {
  ACTIVITY_OPTIONS,
  HELP_COPY,
  INSTABILITY_DISTRIBUTION_OPTIONS,
  PHOTO_USAGE_OPTIONS,
  type ActivityValue,
} from "@/lib/observation/constants";
import {
  emptyAvalancheEntry,
  emptyObservationForm,
  observationFormSchema,
  type ObservationForm,
} from "@/lib/observation/schema";
import { useObserverProfile } from "@/lib/observerProfile";
import {
  submitObservationFlow,
  type SubmitStep,
} from "@/lib/observation/submitFlow";
import {
  summarizeAbout,
  summarizeActivity,
  summarizeAvalanches,
  summarizeInstability,
  summarizeObservation,
  summarizePhotos,
  summarizePrivacy,
  summarizeWhen,
  summarizeWhere,
} from "@/lib/observation/summaries";
import { AVAILABLE_ZONES, ZONE_TO_CENTER } from "@/lib/zones";

// Submit observation form. Every field a center wants is visible —
// no separate "pro" expansion. Each section is its own collapsible
// card; tapping "Done · Next" closes the current section and opens
// the next one that isn't already complete. Users can re-open any
// section to edit. Required-but-empty sections still block submit.

type SectionKey =
  | "about"
  | "when"
  | "activity"
  | "where"
  | "observation"
  | "photos"
  | "instability"
  | "avalanches"
  | "privacy";

const SECTION_ORDER: SectionKey[] = [
  "about",
  "when",
  "activity",
  "where",
  "observation",
  "photos",
  "instability",
  "avalanches",
  "privacy",
];

// Map zod issue paths to which section the field lives in. Used for
// scroll-to-first-error.
function sectionForPath(path: string): SectionKey {
  if (path === "name" || path === "email") return "about";
  if (path === "start_date") return "when";
  if (path === "activity") return "activity";
  if (
    path === "location_name" ||
    path === "center_id" ||
    path.startsWith("location_point")
  )
    return "where";
  if (path === "observation_summary") return "observation";
  if (path === "images") return "photos";
  if (path.startsWith("instability")) return "instability";
  if (path.startsWith("avalanches")) return "avalanches";
  return "privacy";
}

function firstName(full: string): string {
  return (full.trim().split(/\s+/)[0] ?? "").slice(0, 24);
}

export default function ObservationNewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    zoneId?: string;
    lat?: string;
    lng?: string;
  }>();
  const { profile, loaded: profileLoaded } = useObserverProfile();

  // Zone context (if entered from a zone Observations screen).
  const initialZone = params.zoneId
    ? AVAILABLE_ZONES.find((z) => z.id === params.zoneId)
    : undefined;
  const initialCenter = params.zoneId
    ? ZONE_TO_CENTER[params.zoneId]
    : undefined;
  const initialLat = params.lat ? Number(params.lat) : undefined;
  const initialLng = params.lng ? Number(params.lng) : undefined;

  const [form, setForm] = useState<ObservationForm>(() =>
    emptyObservationForm({
      center_id: initialCenter ?? "",
      location_point:
        initialLat !== undefined && initialLng !== undefined
          ? { lat: initialLat, lng: initialLng }
          : undefined,
    }),
  );

  // Pre-fill from observer profile once it loads.
  useEffect(() => {
    if (!profileLoaded || !profile) return;
    setForm((f) => ({
      ...f,
      name: f.name || profile.name,
      email: f.email || profile.email,
      phone: f.phone || profile.phone,
      show_name: f.show_name || profile.showName,
      photoUsage: f.photoUsage || profile.photoUsage,
    }));
  }, [profileLoaded, profile]);

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Section state — one open at a time, with a set of completed keys.
  // First open section: the first that's not already implicitly complete.
  const [openSection, setOpenSection] = useState<SectionKey | null>(null);
  const [completed, setCompleted] = useState<Set<SectionKey>>(
    () => new Set<SectionKey>(),
  );
  // Open the first incomplete section once profile load resolves
  // (so users with a saved profile skip "About you" automatically).
  useEffect(() => {
    if (!profileLoaded) return;
    setOpenSection((current) => {
      if (current !== null) return current;
      const next = firstIncompleteSection(form, completed);
      return next;
    });
  }, [profileLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Submission state.
  const [submitStep, setSubmitStep] = useState<SubmitStep | null>(null);
  const [progressVisible, setProgressVisible] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const inFlight =
    submitStep?.kind === "validating" ||
    submitStep?.kind === "uploading-photo" ||
    submitStep?.kind === "submitting";

  // Section refs for scroll-to-error.
  const scrollViewRef = useRef<ScrollView>(null);
  const sectionRefs = useRef<Partial<Record<SectionKey, View | null>>>({});
  const setSectionRef = (key: SectionKey) => (node: View | null) => {
    sectionRefs.current[key] = node;
  };
  const scrollToSection = useCallback((key: SectionKey) => {
    const node = sectionRefs.current[key];
    const sv = scrollViewRef.current;
    if (!node || !sv) return;
    const handle = findNodeHandle(sv);
    if (handle == null) return;
    node.measureLayout(
      handle,
      (_x, y) => sv.scrollTo({ y: Math.max(0, y - 12), animated: true }),
      () => undefined,
    );
  }, []);

  const update = <K extends keyof ObservationForm>(
    key: K,
    value: ObservationForm[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: "" }));
  };
  const updateInstability = <
    K extends keyof ObservationForm["instability"],
  >(
    key: K,
    value: ObservationForm["instability"][K],
  ) => update("instability", { ...form.instability, [key]: value });

  // Section toggle + advance.
  const toggleSection = (key: SectionKey) => {
    setOpenSection((cur) => (cur === key ? null : key));
  };
  const completeSection = (key: SectionKey) => {
    const nextCompleted = new Set(completed);
    nextCompleted.add(key);
    setCompleted(nextCompleted);
    const nextOpen = nextSectionAfter(form, nextCompleted, key);
    setOpenSection(nextOpen);
    if (nextOpen) {
      // Defer scroll a frame so the layout settles after the previous
      // section collapses.
      setTimeout(() => scrollToSection(nextOpen), 80);
    }
  };

  // Submission.
  const runSubmit = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setProgressVisible(true);
    setSubmitStep({ kind: "validating" });
    await submitObservationFlow({
      form,
      onProgress: setSubmitStep,
      signal: controller.signal,
    });
  }, [form]);

  const onSubmit = useCallback(() => {
    const result = observationFormSchema.safeParse(form);
    if (!result.success) {
      const next: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const path = issue.path.join(".");
        if (!next[path]) next[path] = issue.message;
      }
      setErrors(next);
      const firstSection = sectionForPath(
        Object.keys(next)[0] ?? "",
      ) as SectionKey;
      setOpenSection(firstSection);
      setTimeout(() => scrollToSection(firstSection), 80);
      Alert.alert(
        "A few fields need attention",
        Object.values(next).slice(0, 4).join("\n"),
      );
      return;
    }
    setErrors({});
    void runSubmit();
  }, [form, runSubmit, scrollToSection]);

  const onCancelSubmission = useCallback(() => {
    abortRef.current?.abort();
    setProgressVisible(false);
    setSubmitStep(null);
  }, []);
  const onRetry = useCallback(() => {
    void runSubmit();
  }, [runSubmit]);
  const onSubmitAnother = useCallback(() => {
    setProgressVisible(false);
    setSubmitStep(null);
    setForm((prev) => ({
      ...prev,
      start_date: new Date(),
      activity: [],
      location_name: "",
      observation_summary: "",
      avalanches: [],
      avalanches_summary: undefined,
      images: [],
      instability: {
        avalanches_observed: false,
        avalanches_triggered: false,
        avalanches_caught: false,
        cracking: false,
        collapsing: false,
      },
    }));
    setCompleted(new Set());
    setOpenSection("when");
  }, []);
  const onBackToHome = useCallback(() => {
    setProgressVisible(false);
    setSubmitStep(null);
    router.back();
  }, [router]);
  const onDismissError = useCallback(() => {
    setProgressVisible(false);
    setSubmitStep(null);
  }, []);

  const headerTitle = useMemo(() => {
    if (initialZone) return initialZone.name;
    return "New observation";
  }, [initialZone]);

  return (
    <ZoneScreenContainer>
      <Stack.Screen options={{ headerShown: false }} />
      <ZoneScreenHeader
        eyebrow={initialCenter ? `REPORT · ${initialCenter}` : "REPORT"}
        title={headerTitle}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled"
        >
          {profile?.lastSubmittedAt && profile.name ? (
            <View
              style={{
                paddingHorizontal: 14,
                paddingVertical: 10,
                marginBottom: 12,
                borderRadius: 10,
                backgroundColor: palette.frost[400] + "15",
                borderWidth: 0.5,
                borderColor: palette.frost[400] + "55",
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={16}
                color={palette.frost[400]}
              />
              <Text
                className="text-ink-200"
                style={{ fontSize: 13, lineHeight: 18, flex: 1 }}
              >
                Welcome back, {firstName(profile.name)} — thanks for sending
                another one.
              </Text>
            </View>
          ) : null}

          {/* ABOUT YOU */}
          <CollapsibleSection
            ref={setSectionRef("about")}
            eyebrow="ABOUT YOU"
            summary={summarizeAbout(form)}
            open={openSection === "about"}
            complete={completed.has("about")}
            onToggle={() => toggleSection("about")}
            onDone={() => completeSection("about")}
          >
            <Text
              className="text-ink-300"
              style={{ fontSize: 12, lineHeight: 17 }}
            >
              Stored on this device so you don't have to type it again next
              time.
            </Text>
            <TextField
              label="Name"
              required
              value={form.name}
              onChangeText={(t) => update("name", t)}
              placeholder="Jane Doe"
              autoCapitalize="words"
              autoComplete="name"
              error={errors.name}
            />
            <TextField
              label="Email"
              required
              hint="Never shared publicly. The center may follow up."
              value={form.email}
              onChangeText={(t) => update("email", t)}
              placeholder="you@domain.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              error={errors.email}
            />
          </CollapsibleSection>

          {/* WHEN */}
          <CollapsibleSection
            ref={setSectionRef("when")}
            eyebrow="WHEN"
            summary={summarizeWhen(form)}
            open={openSection === "when"}
            complete={completed.has("when")}
            onToggle={() => toggleSection("when")}
            onDone={() => completeSection("when")}
          >
            <Text
              className="text-ink-300"
              style={{ fontSize: 12, lineHeight: 17 }}
            >
              When did the observation happen?
            </Text>
            <DateStrip
              value={form.start_date}
              onChange={(d) => update("start_date", d)}
            />
          </CollapsibleSection>

          {/* ACTIVITY */}
          <CollapsibleSection
            ref={setSectionRef("activity")}
            eyebrow="ACTIVITY"
            summary={summarizeActivity(form)}
            open={openSection === "activity"}
            complete={completed.has("activity")}
            onToggle={() => toggleSection("activity")}
            onDone={() => completeSection("activity")}
          >
            <Text
              className="text-ink-300"
              style={{ fontSize: 12, lineHeight: 17 }}
            >
              Pick one or more — helps the forecaster picture the conditions.
            </Text>
            <MultiChipPicker
              options={ACTIVITY_OPTIONS}
              selected={form.activity as ActivityValue[]}
              onChange={(v) => update("activity", v)}
            />
            {errors.activity ? (
              <Text
                style={{
                  fontSize: 12,
                  color: palette.aspen[400],
                  marginTop: 4,
                }}
              >
                {errors.activity}
              </Text>
            ) : null}
          </CollapsibleSection>

          {/* WHERE */}
          <CollapsibleSection
            ref={setSectionRef("where")}
            eyebrow="WHERE"
            summary={summarizeWhere(form)}
            open={openSection === "where"}
            complete={completed.has("where")}
            onToggle={() => toggleSection("where")}
            onDone={() => completeSection("where")}
          >
            <LocationField
              value={form.location_point}
              onChange={(p) => update("location_point", p)}
              error={errors["location_point.lat"] ?? errors.location_point}
            />
            <TextField
              label="Place name"
              required
              hint="Drainage, peak, route — e.g. 'Tincan Ridge' or 'Sunburst NE bowl'."
              value={form.location_name}
              onChangeText={(t) => update("location_name", t)}
              placeholder="Drainage, peak, or route"
              autoCapitalize="words"
              error={errors.location_name}
            />
            {!form.center_id ? (
              <CenterPicker
                value={form.center_id}
                onChange={(v) => update("center_id", v)}
                error={errors.center_id}
              />
            ) : null}
          </CollapsibleSection>

          {/* OBSERVATION */}
          <CollapsibleSection
            ref={setSectionRef("observation")}
            eyebrow="WHAT YOU SAW"
            summary={summarizeObservation(form)}
            open={openSection === "observation"}
            complete={completed.has("observation")}
            onToggle={() => toggleSection("observation")}
            onDone={() => completeSection("observation")}
          >
            <TextField
              label="What did you observe?"
              required
              value={form.observation_summary}
              onChangeText={(t) => update("observation_summary", t)}
              placeholder={
                "• Signs of instability?\n" +
                "• Amount of new snow / total snow?\n" +
                "• Weather observations?\n" +
                "• Snowpack test results?\n" +
                "• Overall impression of stability?"
              }
              multiline
              rows={6}
              error={errors.observation_summary}
            />
          </CollapsibleSection>

          {/* PHOTOS */}
          <CollapsibleSection
            ref={setSectionRef("photos")}
            eyebrow="PHOTOS"
            summary={summarizePhotos(form)}
            open={openSection === "photos"}
            complete={completed.has("photos")}
            onToggle={() => toggleSection("photos")}
            onDone={() => completeSection("photos")}
          >
            <PhotoPicker
              value={form.images}
              onChange={(imgs) => update("images", imgs)}
            />
          </CollapsibleSection>

          {/* INSTABILITY */}
          <CollapsibleSection
            ref={setSectionRef("instability")}
            eyebrow="SIGNS OF INSTABILITY"
            summary={summarizeInstability(form)}
            open={openSection === "instability"}
            complete={completed.has("instability")}
            onToggle={() => toggleSection("instability")}
            onDone={() => completeSection("instability")}
          >
            <YesNoQuestion
              label="Did you see avalanches?"
              value={form.instability.avalanches_observed}
              onChange={(v) => updateInstability("avalanches_observed", v)}
            />
            {form.instability.avalanches_observed ? (
              <View style={{ gap: 16, paddingLeft: 8 }}>
                <Text
                  className="text-ink-300"
                  style={{ fontSize: 12, lineHeight: 17 }}
                >
                  Add details for each slide in the Avalanches section below.
                </Text>
                <YesNoQuestion
                  label="Did you trigger one?"
                  value={form.instability.avalanches_triggered}
                  onChange={(v) =>
                    updateInstability("avalanches_triggered", v)
                  }
                />
                {form.instability.avalanches_triggered ? (
                  <YesNoQuestion
                    label="Were you caught?"
                    value={form.instability.avalanches_caught}
                    onChange={(v) =>
                      updateInstability("avalanches_caught", v)
                    }
                  />
                ) : null}
              </View>
            ) : null}

            <YesNoQuestion
              label="Cracking?"
              hint="Shooting cracks in the snow as you traveled."
              help={{ title: "Cracking", body: HELP_COPY.cracking }}
              value={form.instability.cracking}
              onChange={(v) => {
                updateInstability("cracking", v);
                if (!v) updateInstability("cracking_description", undefined);
              }}
            />
            {form.instability.cracking ? (
              <View style={{ paddingLeft: 8 }}>
                <FieldLabel
                  label="How widespread was the cracking?"
                  required
                />
                <ChipPicker
                  options={INSTABILITY_DISTRIBUTION_OPTIONS}
                  selected={form.instability.cracking_description}
                  onSelect={(v) => updateInstability("cracking_description", v)}
                />
                {errors["instability.cracking_description"] ? (
                  <Text
                    style={{
                      fontSize: 12,
                      color: palette.aspen[400],
                      marginTop: 6,
                    }}
                  >
                    {errors["instability.cracking_description"]}
                  </Text>
                ) : null}
              </View>
            ) : null}

            <YesNoQuestion
              label="Collapsing / 'whumpfing'?"
              hint="Felt the snow settle under you with a thump."
              help={{ title: "Collapsing", body: HELP_COPY.collapsing }}
              value={form.instability.collapsing}
              onChange={(v) => {
                updateInstability("collapsing", v);
                if (!v) updateInstability("collapsing_description", undefined);
              }}
            />
            {form.instability.collapsing ? (
              <View style={{ paddingLeft: 8 }}>
                <FieldLabel
                  label="How widespread was the collapsing?"
                  required
                />
                <ChipPicker
                  options={INSTABILITY_DISTRIBUTION_OPTIONS}
                  selected={form.instability.collapsing_description}
                  onSelect={(v) =>
                    updateInstability("collapsing_description", v)
                  }
                />
                {errors["instability.collapsing_description"] ? (
                  <Text
                    style={{
                      fontSize: 12,
                      color: palette.aspen[400],
                      marginTop: 6,
                    }}
                  >
                    {errors["instability.collapsing_description"]}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </CollapsibleSection>

          {/* AVALANCHES — only when avalanches_observed is true */}
          <CollapsibleSection
            ref={setSectionRef("avalanches")}
            eyebrow="AVALANCHE DETAILS"
            summary={summarizeAvalanches(form)}
            open={openSection === "avalanches"}
            complete={completed.has("avalanches")}
            disabled={!form.instability.avalanches_observed}
            onToggle={() => toggleSection("avalanches")}
            onDone={
              form.instability.avalanches_observed
                ? () => completeSection("avalanches")
                : undefined
            }
          >
            {!form.instability.avalanches_observed ? (
              <Text
                className="text-ink-300"
                style={{ fontSize: 13, lineHeight: 18 }}
              >
                Skipped — you didn't see any avalanches. Toggle "Did you see
                avalanches?" in the previous section to add records here.
              </Text>
            ) : (
              <>
                <Text
                  className="text-ink-300"
                  style={{ fontSize: 12, lineHeight: 17 }}
                >
                  Add a record per slide. Trigger, aspect, size, and elevation
                  are most useful for forecasters.
                </Text>
                {form.avalanches.map((entry, i) => (
                  <AvalancheEntryCard
                    key={i}
                    index={i}
                    total={form.avalanches.length}
                    value={entry}
                    onChange={(next) => {
                      const list = [...form.avalanches];
                      list[i] = next;
                      update("avalanches", list);
                    }}
                    onRemove={() =>
                      update(
                        "avalanches",
                        form.avalanches.filter((_, idx) => idx !== i),
                      )
                    }
                    errors={errors}
                  />
                ))}
                <Pressable
                  onPress={() =>
                    update("avalanches", [
                      ...form.avalanches,
                      emptyAvalancheEntry(form.start_date),
                    ])
                  }
                  style={({ pressed }) => ({
                    paddingVertical: 16,
                    paddingHorizontal: 14,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderStyle: "dashed",
                    borderColor: palette.ink[500] + "AA",
                    backgroundColor: pressed ? palette.ink[900] : "transparent",
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "row",
                    gap: 8,
                    minHeight: 56,
                  })}
                >
                  <Ionicons name="add" size={18} color={palette.ink[300]} />
                  <Text
                    variant="mono"
                    weight="medium"
                    style={{
                      fontSize: 13,
                      letterSpacing: 1.4,
                      color: palette.ink[300],
                    }}
                  >
                    ADD AVALANCHE
                  </Text>
                </Pressable>
                {errors.avalanches ? (
                  <Text
                    style={{
                      fontSize: 12,
                      color: palette.aspen[400],
                      marginTop: 6,
                    }}
                  >
                    {errors.avalanches}
                  </Text>
                ) : null}
                <TextField
                  label="Avalanche summary"
                  hint="Optional — anything that didn't fit in the per-slide records."
                  value={form.avalanches_summary ?? ""}
                  onChangeText={(t) => update("avalanches_summary", t)}
                  multiline
                  rows={3}
                  placeholder="e.g. We crossed crowns from a previous wind event"
                />
              </>
            )}
          </CollapsibleSection>

          {/* PRIVACY & CONTACT */}
          <CollapsibleSection
            ref={setSectionRef("privacy")}
            eyebrow="PRIVACY & CONTACT"
            summary={summarizePrivacy(form)}
            open={openSection === "privacy"}
            complete={completed.has("privacy")}
            onToggle={() => toggleSection("privacy")}
            onDone={() => completeSection("privacy")}
          >
            <YesNoQuestion
              label="Make this observation private?"
              hint="Private observations are only visible to forecasters at the avalanche center."
              value={form.private}
              onChange={(v) => update("private", v)}
            />
            <View>
              <FieldLabel label="Photo usage" required />
              <ChipPicker
                options={PHOTO_USAGE_OPTIONS}
                selected={form.photoUsage}
                onSelect={(v) => update("photoUsage", v)}
              />
            </View>
            <YesNoQuestion
              label="Show your name publicly?"
              hint="If no, your observation appears as 'Anonymous'. Email is always private."
              value={form.show_name}
              onChange={(v) => update("show_name", v)}
            />
            <TextField
              label="Phone"
              hint="Optional. Never shared. The center may call to follow up."
              value={form.phone ?? ""}
              onChangeText={(t) => update("phone", t)}
              keyboardType="phone-pad"
              placeholder="(555) 555-5555"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </CollapsibleSection>

          {/* SUBMIT */}
          <Pressable
            onPress={onSubmit}
            disabled={inFlight}
            style={({ pressed }) => ({
              paddingVertical: 18,
              borderRadius: 999,
              backgroundColor: inFlight
                ? palette.ink[600]
                : pressed
                  ? palette.frost[500]
                  : palette.frost[400],
              alignItems: "center",
              justifyContent: "center",
              marginTop: 16,
              opacity: inFlight ? 0.7 : 1,
              minHeight: 56,
            })}
          >
            <Text
              variant="mono"
              weight="bold"
              style={{
                fontSize: 14,
                letterSpacing: 1.6,
                color: palette.ink[950],
              }}
            >
              {inFlight ? "SENDING…" : "SUBMIT OBSERVATION"}
            </Text>
          </Pressable>

          <Text
            className="text-ink-400"
            style={{
              fontSize: 12,
              lineHeight: 17,
              textAlign: "center",
              marginTop: 14,
            }}
          >
            Sent to {form.center_id || initialCenter || "the relevant center"} via
            avalanche.org. Email kept private; photos use the credit setting
            you choose above.
          </Text>

          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            style={{ alignSelf: "center", marginTop: 18, padding: 12 }}
          >
            <Text
              variant="mono"
              style={{
                fontSize: 12,
                letterSpacing: 1.2,
                color: palette.ink[400],
              }}
            >
              CANCEL
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <SubmitProgress
        visible={progressVisible}
        step={submitStep}
        centerLabel={form.center_id || initialCenter}
        onCancel={onCancelSubmission}
        onRetry={onRetry}
        onSubmitAnother={onSubmitAnother}
        onBackToHome={onBackToHome}
        onDismissError={onDismissError}
      />
    </ZoneScreenContainer>
  );
}

// ───────────────────────────── helpers ──────────────────────────────────

// "Implicit complete" — sections that have valid defaults so they don't
// block submit just because the user didn't tap into them. Privacy and
// instability default to public/no-signs respectively.
const IMPLICITLY_COMPLETE: Set<SectionKey> = new Set(["instability", "privacy"]);

function firstIncompleteSection(
  form: ObservationForm,
  completed: Set<SectionKey>,
): SectionKey {
  for (const key of SECTION_ORDER) {
    if (completed.has(key)) continue;
    if (sectionEmpty(form, key)) return key;
  }
  // Everything's filled — open the first one anyway as a fallback.
  return SECTION_ORDER[0];
}

function nextSectionAfter(
  form: ObservationForm,
  completed: Set<SectionKey>,
  justCompleted: SectionKey,
): SectionKey | null {
  const idx = SECTION_ORDER.indexOf(justCompleted);
  for (let i = idx + 1; i < SECTION_ORDER.length; i++) {
    const key = SECTION_ORDER[i];
    if (completed.has(key)) continue;
    // Skip avalanches if user said no avalanches observed.
    if (key === "avalanches" && !form.instability.avalanches_observed) continue;
    if (sectionEmpty(form, key) || !IMPLICITLY_COMPLETE.has(key)) return key;
  }
  return null;
}

function sectionEmpty(form: ObservationForm, key: SectionKey): boolean {
  switch (key) {
    case "about":
      return !(form.name && form.email);
    case "when":
      return false; // always has a default
    case "activity":
      return form.activity.length === 0;
    case "where":
      return (
        !form.location_name ||
        (form.location_point.lat === 0 && form.location_point.lng === 0) ||
        !form.center_id
      );
    case "observation":
      return form.observation_summary.trim().length === 0;
    case "photos":
      return form.images.length === 0;
    case "instability":
      return false; // defaults are valid
    case "avalanches":
      return (
        form.instability.avalanches_observed && form.avalanches.length === 0
      );
    case "privacy":
      return false; // defaults are valid
  }
}

// ───────────────────────────── small UI bits ────────────────────────────

function YesNoQuestion({
  label,
  hint,
  help,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  help?: { title: string; body: string };
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <View style={{ gap: 10 }}>
      <FieldLabel label={label} hint={hint} help={help} />
      <YesNoSwitch value={value} onChange={onChange} />
    </View>
  );
}

function CenterPicker({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (next: string) => void;
  error?: string;
}) {
  const centers = useMemo(() => {
    const seen = new Set<string>();
    const list: { value: string; label: string }[] = [];
    for (const z of AVAILABLE_ZONES) {
      const c = z.center;
      if (seen.has(c)) continue;
      seen.add(c);
      list.push({ value: c, label: c });
    }
    return list.sort((a, b) => a.label.localeCompare(b.label));
  }, []);

  return (
    <View>
      <FieldLabel
        label="Which avalanche center?"
        required
        hint="Pick the center that covers the area you observed."
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        <ChipPicker
          options={centers}
          selected={value || undefined}
          onSelect={onChange}
          size="sm"
        />
      </ScrollView>
      {error ? (
        <Text
          style={{
            fontSize: 12,
            color: palette.aspen[400],
            marginTop: 6,
          }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}
