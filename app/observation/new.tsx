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
import {
  ChipPicker,
  FormSection,
  MultiChipPicker,
  TextField,
} from "@/components/observation/formPrimitives";
import { DateStrip } from "@/components/observation/DateStrip";
import { DetailSection } from "@/components/observation/DetailSection";
import { LocationField } from "@/components/observation/LocationField";
import { PhotoPicker } from "@/components/observation/PhotoPicker";
import { SubmitProgress } from "@/components/observation/SubmitProgress";
import {
  submitObservationFlow,
  type SubmitStep,
} from "@/lib/observation/submitFlow";
import {
  ACTIVITY_OPTIONS,
  type ActivityValue,
} from "@/lib/observation/constants";
import {
  emptyObservationForm,
  observationFormSchema,
  type ObservationForm,
} from "@/lib/observation/schema";
import { useObserverProfile } from "@/lib/observerProfile";
import { AVAILABLE_ZONES, ZONE_TO_CENTER } from "@/lib/zones";

// Section keys used for "scroll to first error" + ref tracking. Order
// matters — sectionForPath returns the first one that owns a given
// error path, so list more-specific keys before generic ones.
type SectionKey =
  | "about"
  | "when"
  | "activity"
  | "where"
  | "observation"
  | "photos"
  | "detail";

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
  // Everything else (instability.*, avalanches.*, private, photoUsage,
  // show_name, phone) lives inside the detail expansion.
  return "detail";
}

function firstName(full: string): string {
  return (full.trim().split(/\s+/)[0] ?? "").slice(0, 24);
}

// Submit observation. Hybrid form: essential fields are always visible
// (name/email, when, activity, location, what you saw, photos). The
// "Add more detail" expansion in slice 6 reveals instability +
// avalanches + privacy.
//
// Form state lives at the screen level so both sections write to the
// same ObservationForm. Submission (validate → upload images →
// observation POST → success/error toasts → offline retry) is wired
// up in slice 7.

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

  // When the persisted profile loads (one tick after mount), seed the
  // observer fields. We don't overwrite anything the user may have
  // already typed — useEffect runs once after the profile arrives.
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
  const [detailOpen, setDetailOpen] = useState(false);

  // Submission state.
  const [submitStep, setSubmitStep] = useState<SubmitStep | null>(null);
  const [progressVisible, setProgressVisible] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Section refs — for "scroll to first error" on submit failure.
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
      () => {
        /* measure failed — silent fallback */
      },
    );
  }, []);

  const inFlight =
    submitStep?.kind === "validating" ||
    submitStep?.kind === "uploading-photo" ||
    submitStep?.kind === "submitting";

  const update = <K extends keyof ObservationForm>(
    key: K,
    value: ObservationForm[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    // Clear the error for this field as soon as the user edits it.
    if (errors[key]) setErrors((e) => ({ ...e, [key]: "" }));
  };

  // The form-level validate runs at submit time. We surface field-level
  // errors via the `errors` map, keyed by the path the schema reports.
  const runSubmit = useCallback(async () => {
    // Abort any prior in-flight attempt before starting a new one.
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

      // Map error paths → which section they live in. Used for both
      // "open the detail expansion" and "scroll to the first error".
      const errorKeys = Object.keys(next);
      const isDetailKey = (k: string) =>
        k.startsWith("instability") ||
        k.startsWith("avalanches") ||
        k === "private" ||
        k === "photoUsage" ||
        k === "show_name" ||
        k === "phone";
      if (errorKeys.some(isDetailKey)) {
        setDetailOpen(true);
      }
      const firstSection = sectionForPath(errorKeys[0] ?? "");
      // Defer scroll a tick so the detail expansion has a chance to
      // render (it ships its sub-views into the layout first).
      setTimeout(() => scrollToSection(firstSection), 60);

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
    // Keep observer fields, blank the obs-specific bits.
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
    setDetailOpen(false);
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
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Welcome-back row — only shown when we have a saved profile.
              Quietly acknowledges that the user has reported before so
              the form feels less like a stranger asking for everything
              from scratch. */}
          {profile?.lastSubmittedAt && profile.name ? (
            <View
              style={{
                paddingHorizontal: 14,
                paddingVertical: 10,
                marginBottom: 10,
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
                style={{ fontSize: 12, lineHeight: 17, flex: 1 }}
              >
                Welcome back, {firstName(profile.name)} — thanks for sending
                another one.
              </Text>
            </View>
          ) : null}

          {/* WHO */}
          <FormSection
            ref={setSectionRef("about")}
            eyebrow="ABOUT YOU"
            hint="Stored on this device so you don't have to type it again next time."
          >
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
          </FormSection>

          {/* WHEN */}
          <FormSection
            ref={setSectionRef("when")}
            eyebrow="WHEN"
            hint="When did the observation happen?"
          >
            <DateStrip
              value={form.start_date}
              onChange={(d) => update("start_date", d)}
            />
          </FormSection>

          {/* WHAT YOU WERE DOING */}
          <FormSection
            ref={setSectionRef("activity")}
            eyebrow="ACTIVITY"
            hint="Pick one or more — helps the forecaster picture the conditions you saw."
          >
            <MultiChipPicker
              options={ACTIVITY_OPTIONS}
              selected={form.activity as ActivityValue[]}
              onChange={(v) => update("activity", v)}
            />
            {errors.activity ? (
              <Text
                style={{
                  fontSize: 11,
                  color: palette.aspen[400],
                  marginTop: 6,
                }}
              >
                {errors.activity}
              </Text>
            ) : null}
          </FormSection>

          {/* WHERE */}
          <FormSection ref={setSectionRef("where")} eyebrow="WHERE">
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
              placeholder="Drainage, peak, or route name"
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
          </FormSection>

          {/* WHAT YOU SAW */}
          <FormSection
            ref={setSectionRef("observation")}
            eyebrow="OBSERVATION"
            hint="What did the snow look like? Any signs of instability? What was your impression of stability?"
          >
            <TextField
              label="What did you see?"
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
          </FormSection>

          {/* PHOTOS */}
          <FormSection ref={setSectionRef("photos")} eyebrow="PHOTOS">
            <PhotoPicker
              value={form.images}
              onChange={(imgs) => update("images", imgs)}
            />
          </FormSection>

          {/* Detail expansion — instability, avalanche records, privacy */}
          <View ref={setSectionRef("detail")} collapsable={false}>
            <DetailSection
              open={detailOpen}
              onToggle={() => setDetailOpen((o) => !o)}
              form={form}
              onChange={setForm}
              errors={errors}
            />
          </View>

          {/* SUBMIT */}
          <Pressable
            onPress={onSubmit}
            disabled={inFlight}
            style={({ pressed }) => ({
              paddingVertical: 14,
              borderRadius: 999,
              backgroundColor: inFlight
                ? palette.ink[600]
                : pressed
                  ? palette.frost[500]
                  : palette.frost[400],
              alignItems: "center",
              justifyContent: "center",
              marginTop: 8,
              opacity: inFlight ? 0.7 : 1,
            })}
          >
            <Text
              variant="mono"
              weight="bold"
              style={{
                fontSize: 13,
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
              fontSize: 11,
              lineHeight: 16,
              textAlign: "center",
              marginTop: 12,
            }}
          >
            Your observation is sent to {initialCenter ?? "the relevant avalanche center"} via
            avalanche.org. Email is kept private; photos are uploaded
            with the credit setting you choose in More Detail.
          </Text>

          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            style={{ alignSelf: "center", marginTop: 16, padding: 10 }}
          >
            <Text
              variant="mono"
              style={{
                fontSize: 11,
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

// Center picker — only shown when we don't have one from the entry
// context (i.e. user came from the home FAB without a zone). Lists
// the unique set of centers from our zones config so it stays in sync.
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
      <Text
        variant="mono"
        weight="medium"
        style={{
          fontSize: 10,
          letterSpacing: 1.3,
          color: palette.ink[300],
          marginBottom: 6,
        }}
      >
        WHICH AVALANCHE CENTER? *
      </Text>
      <Text
        className="text-ink-400"
        style={{ fontSize: 11, lineHeight: 15, marginBottom: 8 }}
      >
        Pick the center that covers the area you observed.
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        <View style={{ flexDirection: "row", gap: 8 }}>
          <ChipPicker
            options={centers}
            selected={value || undefined}
            onSelect={onChange}
            size="sm"
          />
        </View>
      </ScrollView>
      {error ? (
        <Text
          style={{
            fontSize: 11,
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
