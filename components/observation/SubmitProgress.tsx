import { ActivityIndicator, Modal, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Text } from "@/components/ui/Text";
import { palette } from "@/constants/design";
import type { SubmitStep } from "@/lib/observation/submitFlow";

// Modal chrome for the submission flow. Renders one of three shapes
// based on the latest progress event:
//   - busy (validating / uploading / submitting): spinner + step label + cancel
//   - success: green check + "submit another" + "back to home"
//   - error: warning + message + retry / dismiss
//
// The screen owns the underlying state machine; this component is a
// pure render of `step`.

interface Props {
  visible: boolean;
  step: SubmitStep | null;
  centerLabel?: string;
  onCancel: () => void;
  onRetry: () => void;
  onSubmitAnother: () => void;
  onBackToHome: () => void;
  onDismissError: () => void;
}

export function SubmitProgress({
  visible,
  step,
  centerLabel,
  onCancel,
  onRetry,
  onSubmitAnother,
  onBackToHome,
  onDismissError,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        // Tapping the system back gesture: best to nudge cancel for
        // busy states, dismiss for terminal states.
        if (step?.kind === "success") onBackToHome();
        else if (step?.kind === "error") onDismissError();
        else onCancel();
      }}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(15,13,11,0.55)",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 360,
            backgroundColor: palette.ink[800],
            borderRadius: 14,
            padding: 24,
            borderWidth: 0.5,
            borderColor: palette.ink[500] + "55",
          }}
        >
          {step?.kind === "success" ? (
            <SuccessBody
              centerLabel={centerLabel}
              onSubmitAnother={onSubmitAnother}
              onBackToHome={onBackToHome}
            />
          ) : step?.kind === "error" ? (
            <ErrorBody
              message={step.message}
              offline={step.offline}
              onRetry={onRetry}
              onDismiss={onDismissError}
            />
          ) : (
            <BusyBody step={step} onCancel={onCancel} />
          )}
        </View>
      </View>
    </Modal>
  );
}

function BusyBody({
  step,
  onCancel,
}: {
  step: SubmitStep | null;
  onCancel: () => void;
}) {
  const label = busyLabel(step);
  const isPhotoUpload = step?.kind === "uploading-photo";
  const showCancel = step?.kind === "validating";

  return (
    <View style={{ alignItems: "center", gap: 14 }}>
      <ActivityIndicator size="large" color={palette.frost[400]} />
      <Text
        variant="display"
        className="text-ink-100"
        style={{ fontSize: 17, lineHeight: 22, textAlign: "center" }}
      >
        {label}
      </Text>
      {isPhotoUpload && step ? (
        <Text
          variant="mono"
          style={{
            fontSize: 11,
            letterSpacing: 1.2,
            color: palette.ink[300],
          }}
        >
          {step.scope === "avalanche"
            ? `AVALANCHE ${(step.avalancheIndex ?? 0) + 1} · `
            : ""}
          PHOTO {step.current} OF {step.total}
        </Text>
      ) : null}
      {showCancel ? (
        <Pressable
          onPress={onCancel}
          hitSlop={8}
          style={{ paddingVertical: 8, paddingHorizontal: 12 }}
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
      ) : (
        <Text
          className="text-ink-400"
          style={{ fontSize: 11, lineHeight: 15, textAlign: "center" }}
        >
          Don't close the app until this finishes — your photos are uploading.
        </Text>
      )}
    </View>
  );
}

function busyLabel(step: SubmitStep | null): string {
  if (!step) return "Getting ready…";
  switch (step.kind) {
    case "validating":
      return "Checking the form…";
    case "uploading-photo":
      return step.scope === "avalanche"
        ? "Uploading avalanche photo…"
        : "Uploading photo…";
    case "submitting":
      return "Sending your observation…";
    default:
      return "";
  }
}

function SuccessBody({
  centerLabel,
  onSubmitAnother,
  onBackToHome,
}: {
  centerLabel?: string;
  onSubmitAnother: () => void;
  onBackToHome: () => void;
}) {
  return (
    <View style={{ alignItems: "center", gap: 14 }}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: "#52BA4A",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="checkmark" size={32} color="#0A2008" />
      </View>
      <Text
        variant="display"
        className="text-ink-100"
        style={{ fontSize: 20, lineHeight: 26, textAlign: "center" }}
      >
        Thank you!
      </Text>
      <Text
        className="text-ink-300"
        style={{ fontSize: 13, lineHeight: 19, textAlign: "center" }}
      >
        Your observation is on its way to{" "}
        {centerLabel ?? "the avalanche center"}. Forecasters use these
        reports to keep the rest of the community informed.
      </Text>

      <Pressable
        onPress={onBackToHome}
        style={({ pressed }) => ({
          marginTop: 8,
          paddingHorizontal: 18,
          paddingVertical: 12,
          borderRadius: 999,
          backgroundColor: pressed ? palette.frost[500] : palette.frost[400],
          alignSelf: "stretch",
          alignItems: "center",
        })}
      >
        <Text
          variant="mono"
          weight="bold"
          style={{
            fontSize: 12,
            letterSpacing: 1.4,
            color: palette.ink[950],
          }}
        >
          DONE
        </Text>
      </Pressable>
      <Pressable
        onPress={onSubmitAnother}
        hitSlop={8}
        style={{ paddingVertical: 6 }}
      >
        <Text
          variant="mono"
          weight="medium"
          style={{
            fontSize: 11,
            letterSpacing: 1.2,
            color: palette.ink[300],
          }}
        >
          SUBMIT ANOTHER
        </Text>
      </Pressable>
    </View>
  );
}

function ErrorBody({
  message,
  offline,
  onRetry,
  onDismiss,
}: {
  message: string;
  offline: boolean;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  return (
    <View style={{ alignItems: "center", gap: 14 }}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: palette.aspen[400],
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons
          name={offline ? "cloud-offline-outline" : "alert"}
          size={28}
          color="#FFF"
        />
      </View>
      <Text
        variant="display"
        className="text-ink-100"
        style={{ fontSize: 18, lineHeight: 23, textAlign: "center" }}
      >
        {offline ? "Saved locally" : "Couldn't submit"}
      </Text>
      <Text
        className="text-ink-300"
        style={{ fontSize: 13, lineHeight: 19, textAlign: "center" }}
      >
        {message}
      </Text>

      {!offline ? (
        <Pressable
          onPress={onRetry}
          style={({ pressed }) => ({
            marginTop: 8,
            paddingHorizontal: 18,
            paddingVertical: 12,
            borderRadius: 999,
            backgroundColor: pressed ? palette.frost[500] : palette.frost[400],
            alignSelf: "stretch",
            alignItems: "center",
          })}
        >
          <Text
            variant="mono"
            weight="bold"
            style={{
              fontSize: 12,
              letterSpacing: 1.4,
              color: palette.ink[950],
            }}
          >
            TRY AGAIN
          </Text>
        </Pressable>
      ) : null}
      <Pressable
        onPress={onDismiss}
        hitSlop={8}
        style={{ paddingVertical: 6 }}
      >
        <Text
          variant="mono"
          weight="medium"
          style={{
            fontSize: 11,
            letterSpacing: 1.2,
            color: palette.ink[300],
          }}
        >
          {offline ? "OK" : "DISMISS"}
        </Text>
      </Pressable>
    </View>
  );
}
