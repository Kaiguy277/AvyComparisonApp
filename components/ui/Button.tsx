import { ActivityIndicator, Pressable, View } from "react-native";
import * as Haptics from "expo-haptics";
import type { ReactNode } from "react";
import { Text } from "./Text";
import { palette } from "@/constants/design";

export type ButtonVariant = "primary" | "outline" | "ghost" | "frost";
export type ButtonSize = "default" | "sm" | "lg";

interface ButtonProps {
  children: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  haptic?: boolean;
}

// Spinner color must match the variant's TEXT color (from the palette),
// or the loading indicator is invisible. The old hardcoded hexes were
// pre-migration dark-theme values: near-black on the dark primary button,
// near-white on the light paper background for outline/ghost — a blank
// pill in three of four variants.
const variantStyles: Record<ButtonVariant, { container: string; text: string; spinner: string }> = {
  primary: {
    container: "bg-ink-50 active:bg-ink-100",
    text: "text-ink-950",
    spinner: palette.ink[950],
  },
  outline: {
    container: "border border-ink-600 bg-transparent active:bg-ink-800",
    text: "text-ink-100",
    spinner: palette.ink[100],
  },
  ghost: {
    container: "bg-transparent active:bg-ink-800",
    text: "text-ink-200",
    spinner: palette.ink[200],
  },
  frost: {
    container: "bg-frost-400/15 border border-frost-400/40 active:bg-frost-400/25",
    text: "text-frost-400",
    spinner: palette.frost[400],
  },
};

const sizeStyles: Record<ButtonSize, { container: string; text: string }> = {
  default: { container: "h-11 px-5", text: "text-sm" },
  sm: { container: "h-9 px-4", text: "text-xs" },
  lg: { container: "h-14 px-6", text: "text-base tracking-[0.06em]" },
};

export function Button({
  children,
  onPress,
  disabled,
  loading,
  variant = "primary",
  size = "default",
  className = "",
  leftIcon,
  rightIcon,
  haptic = true,
}: ButtonProps) {
  const v = variantStyles[variant];
  const s = sizeStyles[size];
  const isDisabled = disabled || loading;

  const handlePress = () => {
    if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress?.();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      className={`flex-row items-center justify-center gap-2.5 rounded-full ${v.container} ${s.container} ${
        isDisabled ? "opacity-40" : ""
      } ${className}`}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.spinner} />
      ) : (
        <>
          {leftIcon ? <View>{leftIcon}</View> : null}
          {typeof children === "string" ? (
            <Text
              variant="mono"
              weight="medium"
              className={`uppercase tracking-[0.16em] ${v.text} ${s.text}`}
            >
              {children}
            </Text>
          ) : (
            children
          )}
          {rightIcon ? <View>{rightIcon}</View> : null}
        </>
      )}
    </Pressable>
  );
}
