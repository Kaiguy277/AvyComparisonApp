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
import { DateField } from "@/components/observation/DateField";
import {
  FieldLabel,
  TextField,
  YesNoSwitch,
} from "@/components/observation/formPrimitives";
import { LocationField } from "@/components/observation/LocationField";
import { PhotoPicker } from "@/components/observation/PhotoPicker";
import {
  MultiSelectField,
  SelectField,
} from "@/components/observation/SelectField";
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
  deserializeDraftForm,
  getDraft,
  submitObservationFlow,
  type SubmitStep,
} from "@/lib/observation/submitFlow";
import { observationApiConfig } from "@/lib/api/observationSubmit";
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

// Section labels for the "Notes" appendix folded into observation_summary.
const NOTE_LABELS: Record<SectionKey, string> = {
  about: "About observer",
  when: "When",
  activity: "Activity",
  where: "Where",
  observation: "Observation",
  photos: "Photos",
  instability: "Instability",
  avalanches: "Avalanches",
  privacy: "Privacy",
};

// Merge per-section notes into observation_summary. Returns a new
// form object the caller passes to submitObservationFlow. Empty notes
// are skipped; if no notes exist, the form passes through unchanged.
function mergeSectionNotes(
  form: ObservationForm,
  notes: Partial<Record<SectionKey, string>>,
): ObservationForm {
  const lines: string[] = [];
  for (const key of SECTION_ORDER) {
    const text = notes[key]?.trim();
    if (!text) continue;
    lines.push(`${NOTE_LABELS[key]}: ${text}`);
  }
  if (lines.length === 0) return form;
  const base = form.observation_summary.trim();
  const appendix = lines.join("\n");
  const merged = base ? `${base}\n\n— Notes —\n${appendix}` : appendix;
  return { ...form, observation_summary: merged };
}

// Derived completion — checked from form state on every render so the
// section header's checkmark turns on the moment the user fills the
// last required field, no explicit "Done" needed.
function isSectionComplete(
  form: ObservationForm,
  key: SectionKey,
): boolean {
  switch (key) {
    case "about":
      return Boolean(form.name && form.email);
    case "when":
      return true; // always has a default
    case "activity":
      return form.activity.length > 0;
    case "where":
      return Boolean(
        form.location_name &&
          !(form.location_point.lat === 0 && form.location_point.lng === 0) &&
          form.center_id,
      );
    case "observation":
      return form.observation_summary.trim().length > 0;
    case "photos":
      return form.images.length > 0;
    case "instability":
      // Defaults are valid (all-no). If the user opened it and turned
      // on cracking/collapsing without picking a distribution, that's
      // a validation failure surfaced at submit.
      return true;
    case "avalanches":
      // Complete when either no avalanches were observed (nothing to
      // record) or every observed avalanche has the required fields.
      if (!form.instability.avalanches_observed) return true;
      return (
        form.avalanches.length > 0 &&
        form.avalanches.every(
          (a) =>
            a.location.trim() &&
            a.elevation.trim() &&
            a.aspect &&
            a.d_size &&
            a.trigger,
        )
      );
    case "privacy":
      return true; // defaults are valid
  }
}

export default function ObservationNewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    zoneId?: string;
    lat?: string;
    lng?: string;
    draftId?: string;
  }>();
  const { profile, loaded: profileLoaded } = useObserverProfile();

  // Zone context (if entered from a zone Observations screen).
  const initialZone = params.zoneId
    ? AVAILABLE_ZONES.find((z) => z.id === params.zoneId)
    : undefined;
  const initialCenter = params.zoneId
    ? ZONE_TO_CENTER[params.zoneId]
    : undefined;
  // Malformed params yield NaN, which is `!== undefined` — guard with
  // isFinite so junk coordinates never seed the form as a "valid" fix.
  const parsedLat = params.lat ? Number(params.lat) : undefined;
  const parsedLng = params.lng ? Number(params.lng) : undefined;
  const initialLat = Number.isFinite(parsedLat) ? parsedLat : undefined;
  const initialLng = Number.isFinite(parsedLng) ? parsedLng : undefined;

  const [form, setForm] = useState<ObservationForm>(() =>
    emptyObservationForm({
      center_id: initialCenter ?? "",
      location_point:
        initialLat !== undefined && initialLng !== undefined
          ? { lat: initialLat, lng: initialLng }
          : undefined,
    }),
  );

  // Pre-fill from observer profile once it loads. Text fields keep
  // anything already typed (`||`); show_name/photoUsage always have a
  // non-empty default, so the saved profile preference must win — the
  // old `f.photoUsage || profile.photoUsage` never applied it and
  // silently reset "anonymous"/"private" users to "credit".
  useEffect(() => {
    if (!profileLoaded || !profile) return;
    setForm((f) => ({
      ...f,
      name: f.name || profile.name,
      email: f.email || profile.email,
      phone: f.phone || profile.phone,
      show_name: profile.showName,
      photoUsage: profile.photoUsage,
    }));
  }, [profileLoaded, profile]);

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Section state — every section starts open and stays open until
  // the user explicitly collapses it. Multiple can be open at once.
  // "Complete" is derived from form content, so a section header
  // shows a checkmark the moment its required fields are filled —
  // no explicit "Done" button needed.
  const [openSections, setOpenSections] = useState<Set<SectionKey>>(
    () => new Set<SectionKey>(SECTION_ORDER),
  );

  // Per-section freeform notes. Folded into observation_summary at
  // submit time so the wire format stays unchanged.
  const [sectionNotes, setSectionNotes] = useState<
    Partial<Record<SectionKey, string>>
  >({});
  const setNoteFor = (key: SectionKey) => (next: string) =>
    setSectionNotes((p) => ({ ...p, [key]: next }));

  // Submission state.
  const [submitStep, setSubmitStep] = useState<SubmitStep | null>(null);
  const [progressVisible, setProgressVisible] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Draft being retried, if any. Set from the route param (offline-drafts
  // banner) or from a failed submission this session; cleared by the
  // flow itself on success. Carrying the id through retries means a
  // second failure updates the queued record instead of duplicating it.
  const draftIdRef = useRef<string | null>(params.draftId ?? null);
  useEffect(() => {
    const id = params.draftId;
    if (!id) return;
    let cancelled = false;
    getDraft(id).then((record) => {
      if (cancelled || !record) return;
      // Photos' local URIs may have been evicted by the OS since the
      // draft was saved; the picker will show any survivors and the
      // user can re-add the rest.
      setForm(deserializeDraftForm(record.snapshot.form));
    });
    return () => {
      cancelled = true;
    };
  }, [params.draftId]);

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
  // Functional update — two calls in the same tick (e.g. turning
  // "Cracking?" off also clears its description) must not clobber each
  // other with a stale `form.instability` spread.
  const updateInstability = <
    K extends keyof ObservationForm["instability"],
  >(
    key: K,
    value: ObservationForm["instability"][K],
  ) =>
    setForm((prev) => ({
      ...prev,
      instability: { ...prev.instability, [key]: value },
    }));

  // Toggle: tap a header to flip that one section's open state.
  // Other sections are unaffected.
  const toggleSection = (key: SectionKey) => {
    setOpenSections((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Submission. Section notes get folded into observation_summary
  // here so the wire format stays unchanged.
  const runSubmit = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setProgressVisible(true);
    setSubmitStep({ kind: "validating" });
    const merged = mergeSectionNotes(form, sectionNotes);
    const result = await submitObservationFlow({
      form: merged,
      onProgress: (step) => {
        // A superseded attempt (cancelled or replaced by a retry) must
        // not drive the modal — its late "cancelled" error would paint
        // over the live attempt's progress.
        if (abortRef.current === controller) setSubmitStep(step);
      },
      signal: controller.signal,
      draftId: draftIdRef.current ?? undefined,
    });
    if (abortRef.current !== controller) return;
    if (result.ok) draftIdRef.current = null;
    else if (result.draftId) draftIdRef.current = result.draftId;
  }, [form, sectionNotes]);

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
      // Make sure the offending section is open so the user can see
      // the error highlight.
      setOpenSections((s) => {
        if (s.has(firstSection)) return s;
        const next = new Set(s);
        next.add(firstSection);
        return next;
      });
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
    draftIdRef.current = null;
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
    setOpenSections(new Set<SectionKey>(SECTION_ORDER));
    setSectionNotes({});
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
            open={openSections.has("about")}
            complete={isSectionComplete(form, "about")}
            onToggle={() => toggleSection("about")}
            notes={sectionNotes.about}
            onNotesChange={setNoteFor("about")}
          >
            <Text
              className="text-ink-300"
              style={{ fontSize: 12, lineHeight: 17 }}
            >
              Stored on this device so you don’t have to type it again next
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
            open={openSections.has("when")}
            complete={isSectionComplete(form, "when")}
            onToggle={() => toggleSection("when")}
            notes={sectionNotes.when}
            onNotesChange={setNoteFor("when")}
          >
            <DateField
              label="Observation date"
              required
              hint="When did the observation happen?"
              value={form.start_date}
              onChange={(d) => update("start_date", d)}
            />
          </CollapsibleSection>

          {/* ACTIVITY */}
          <CollapsibleSection
            ref={setSectionRef("activity")}
            eyebrow="ACTIVITY"
            summary={summarizeActivity(form)}
            open={openSections.has("activity")}
            complete={isSectionComplete(form, "activity")}
            onToggle={() => toggleSection("activity")}
            notes={sectionNotes.activity}
            onNotesChange={setNoteFor("activity")}
          >
            <MultiSelectField
              label="What were you doing?"
              required
              hint="Pick one or more — helps the forecaster picture the conditions."
              pickerTitle="Activity"
              options={ACTIVITY_OPTIONS}
              value={form.activity as ActivityValue[]}
              onChange={(v) => update("activity", v)}
              error={errors.activity}
            />
          </CollapsibleSection>

          {/* WHERE */}
          <CollapsibleSection
            ref={setSectionRef("where")}
            eyebrow="WHERE"
            summary={summarizeWhere(form)}
            open={openSections.has("where")}
            complete={isSectionComplete(form, "where")}
            onToggle={() => toggleSection("where")}
            notes={sectionNotes.where}
            onNotesChange={setNoteFor("where")}
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
            open={openSections.has("observation")}
            complete={isSectionComplete(form, "observation")}
            onToggle={() => toggleSection("observation")}
            notes={sectionNotes.observation}
            onNotesChange={setNoteFor("observation")}
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
            open={openSections.has("photos")}
            complete={isSectionComplete(form, "photos")}
            onToggle={() => toggleSection("photos")}
            notes={sectionNotes.photos}
            onNotesChange={setNoteFor("photos")}
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
            open={openSections.has("instability")}
            complete={isSectionComplete(form, "instability")}
            onToggle={() => toggleSection("instability")}
            notes={sectionNotes.instability}
            onNotesChange={setNoteFor("instability")}
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
                <SelectField
                  label="How widespread?"
                  required
                  pickerTitle="Cracking distribution"
                  options={INSTABILITY_DISTRIBUTION_OPTIONS}
                  value={form.instability.cracking_description}
                  onChange={(v) => updateInstability("cracking_description", v)}
                  error={errors["instability.cracking_description"]}
                />
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
                <SelectField
                  label="How widespread?"
                  required
                  pickerTitle="Collapsing distribution"
                  options={INSTABILITY_DISTRIBUTION_OPTIONS}
                  value={form.instability.collapsing_description}
                  onChange={(v) =>
                    updateInstability("collapsing_description", v)
                  }
                  error={errors["instability.collapsing_description"]}
                />
              </View>
            ) : null}
          </CollapsibleSection>

          {/* AVALANCHES — only when avalanches_observed is true */}
          <CollapsibleSection
            ref={setSectionRef("avalanches")}
            eyebrow="AVALANCHE DETAILS"
            summary={summarizeAvalanches(form)}
            open={openSections.has("avalanches")}
            complete={isSectionComplete(form, "avalanches")}
            disabled={!form.instability.avalanches_observed}
            onToggle={() => toggleSection("avalanches")}
            notes={sectionNotes.avalanches}
            onNotesChange={setNoteFor("avalanches")}
          >
            {!form.instability.avalanches_observed ? (
              <Text
                className="text-ink-300"
                style={{ fontSize: 13, lineHeight: 18 }}
              >
                Skipped — you didn’t see any avalanches. Toggle “Did you see
                avalanches?” in the previous section to add records here.
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
            open={openSections.has("privacy")}
            complete={isSectionComplete(form, "privacy")}
            onToggle={() => toggleSection("privacy")}
            notes={sectionNotes.privacy}
            onNotesChange={setNoteFor("privacy")}
          >
            <YesNoQuestion
              label="Make this observation private?"
              hint="Private observations are only visible to forecasters at the avalanche center."
              value={form.private}
              onChange={(v) => update("private", v)}
            />
            <SelectField
              label="Photo usage"
              required
              pickerTitle="How can the center use your photos?"
              options={PHOTO_USAGE_OPTIONS}
              value={form.photoUsage}
              onChange={(v) => update("photoUsage", v)}
            />
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
            {observationApiConfig.isStaging
              ? "\nTEST MODE — this build submits to NAC's staging system, not the live center."
              : ""}
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
    <SelectField
      label="Avalanche center"
      required
      hint="Pick the center that covers the area you observed."
      pickerTitle="Choose avalanche center"
      options={centers}
      value={value || undefined}
      onChange={onChange}
      error={error}
    />
  );
}
