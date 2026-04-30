import { View, Text } from "react-native";
import type { ReactNode } from "react";

export type BadgeVariant = "default" | "outline" | "secondary" | "destructive";

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
  textClassName?: string;
}

const variantStyles: Record<BadgeVariant, { container: string; text: string }> = {
  default: { container: "bg-primary", text: "text-primary-foreground" },
  outline: { container: "border border-border bg-transparent", text: "text-foreground" },
  secondary: { container: "bg-secondary", text: "text-secondary-foreground" },
  destructive: { container: "bg-destructive", text: "text-destructive-foreground" },
};

export function Badge({
  children,
  variant = "default",
  className = "",
  textClassName = "",
}: BadgeProps) {
  const styles = variantStyles[variant];
  return (
    <View
      className={`px-2 py-0.5 rounded-md self-start ${styles.container} ${className}`}
    >
      <Text className={`text-xs font-medium ${styles.text} ${textClassName}`}>
        {children}
      </Text>
    </View>
  );
}
