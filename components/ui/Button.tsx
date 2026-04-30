import { Pressable, Text, ActivityIndicator, View } from "react-native";
import type { ReactNode } from "react";

export type ButtonVariant = "default" | "outline" | "ghost" | "destructive";
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
}

const variantStyles: Record<ButtonVariant, { container: string; text: string }> = {
  default: { container: "bg-primary active:opacity-80", text: "text-primary-foreground" },
  outline: {
    container: "border border-border bg-transparent active:bg-muted",
    text: "text-foreground",
  },
  ghost: { container: "bg-transparent active:bg-muted", text: "text-foreground" },
  destructive: {
    container: "bg-destructive active:opacity-80",
    text: "text-destructive-foreground",
  },
};

const sizeStyles: Record<ButtonSize, { container: string; text: string }> = {
  default: { container: "h-10 px-4", text: "text-sm" },
  sm: { container: "h-8 px-3", text: "text-xs" },
  lg: { container: "h-12 px-6", text: "text-base" },
};

export function Button({
  children,
  onPress,
  disabled,
  loading,
  variant = "default",
  size = "default",
  className = "",
  leftIcon,
}: ButtonProps) {
  const v = variantStyles[variant];
  const s = sizeStyles[size];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      className={`flex-row items-center justify-center gap-2 rounded-md ${v.container} ${s.container} ${
        isDisabled ? "opacity-50" : ""
      } ${className}`}
    >
      {loading ? (
        <ActivityIndicator size="small" color="white" />
      ) : (
        <>
          {leftIcon ? <View>{leftIcon}</View> : null}
          {typeof children === "string" ? (
            <Text className={`font-semibold ${v.text} ${s.text}`}>{children}</Text>
          ) : (
            children
          )}
        </>
      )}
    </Pressable>
  );
}
