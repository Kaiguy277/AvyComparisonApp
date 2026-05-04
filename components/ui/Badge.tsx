import { View } from "react-native";
import type { ReactNode } from "react";
import { Text } from "./Text";

export type BadgeVariant =
  | "default"
  | "outline"
  | "subtle"
  | "frost"
  | "aspen"
  | "danger";

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
  textClassName?: string;
  fill?: string;
  ink?: string;
}

const variantStyles: Record<BadgeVariant, { container: string; text: string }> = {
  default: { container: "bg-ink-100", text: "text-ink-950" },
  outline: { container: "border border-ink-600 bg-transparent", text: "text-ink-200" },
  subtle: { container: "bg-ink-700/60", text: "text-ink-200" },
  frost: { container: "bg-frost-400/15 border border-frost-400/30", text: "text-frost-400" },
  aspen: { container: "bg-aspen-500/15 border border-aspen-500/30", text: "text-aspen-400" },
  danger: { container: "bg-danger-high/15 border border-danger-high/40", text: "text-[#DC2626]" },
};

export function Badge({
  children,
  variant = "default",
  className = "",
  textClassName = "",
  fill,
  ink,
}: BadgeProps) {
  const v = variantStyles[variant];
  const useCustom = !!fill;
  return (
    <View
      className={`px-2 py-0.5 rounded-md self-start ${useCustom ? "" : v.container} ${className}`}
      style={useCustom ? { backgroundColor: fill, borderWidth: 0 } : undefined}
    >
      <Text
        variant="mono"
        weight="medium"
        className={`text-[10px] uppercase tracking-[0.14em] ${useCustom ? "" : v.text} ${textClassName}`}
        style={useCustom && ink ? { color: ink } : undefined}
      >
        {children}
      </Text>
    </View>
  );
}
