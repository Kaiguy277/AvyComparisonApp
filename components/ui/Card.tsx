import { View, Text } from "react-native";
import type { ViewProps, TextProps } from "react-native";

export function Card({ className = "", ...props }: ViewProps & { className?: string }) {
  return (
    <View
      className={`rounded-xl border border-border bg-card ${className}`}
      {...props}
    />
  );
}

export function CardHeader({
  className = "",
  ...props
}: ViewProps & { className?: string }) {
  return <View className={`p-4 pb-3 ${className}`} {...props} />;
}

export function CardTitle({
  className = "",
  ...props
}: TextProps & { className?: string }) {
  return (
    <Text
      className={`text-lg font-bold text-foreground ${className}`}
      {...props}
    />
  );
}

export function CardDescription({
  className = "",
  ...props
}: TextProps & { className?: string }) {
  return (
    <Text
      className={`text-sm text-muted-foreground ${className}`}
      {...props}
    />
  );
}

export function CardContent({
  className = "",
  ...props
}: ViewProps & { className?: string }) {
  return <View className={`p-4 pt-0 ${className}`} {...props} />;
}
