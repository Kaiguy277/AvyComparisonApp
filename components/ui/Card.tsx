import { View } from "react-native";
import type { ViewProps } from "react-native";
import type { ReactNode } from "react";
import { Text } from "./Text";

interface CardProps extends ViewProps {
  className?: string;
  variant?: "default" | "raised" | "outline";
}

export function Card({
  className = "",
  variant = "default",
  ...props
}: CardProps) {
  const surface =
    variant === "raised"
      ? "bg-ink-800 border-ink-700"
      : variant === "outline"
        ? "bg-transparent border-ink-700"
        : "bg-ink-900 border-ink-700/60";
  return (
    <View
      className={`rounded-2xl border ${surface} ${className}`}
      style={{ borderWidth: 0.5 }}
      {...props}
    />
  );
}

export function CardHeader({
  className = "",
  ...props
}: ViewProps & { className?: string }) {
  return <View className={`px-5 pt-5 pb-3 ${className}`} {...props} />;
}

export function CardTitle({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <Text
      variant="display"
      className={`text-2xl text-ink-50 leading-tight ${className}`}
    >
      {children}
    </Text>
  );
}

export function CardEyebrow({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <Text
      variant="mono"
      className={`text-[10px] uppercase tracking-[0.18em] text-ink-400 ${className}`}
    >
      {children}
    </Text>
  );
}

export function CardDescription({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <Text className={`text-sm text-ink-300 ${className}`}>{children}</Text>
  );
}

export function CardContent({
  className = "",
  ...props
}: ViewProps & { className?: string }) {
  return <View className={`px-5 pb-5 ${className}`} {...props} />;
}
