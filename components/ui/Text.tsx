import { Text as RNText } from "react-native";
import type { TextProps } from "react-native";

type Variant = "body" | "display" | "display-italic" | "mono";
type Weight = "regular" | "medium" | "semibold" | "bold";

interface Props extends TextProps {
  variant?: Variant;
  weight?: Weight;
  className?: string;
}

const fontFor = (variant: Variant, weight: Weight): string => {
  if (variant === "display") {
    return "InstrumentSerif_400Regular";
  }
  if (variant === "display-italic") {
    return "InstrumentSerif_400Regular_Italic";
  }
  if (variant === "mono") {
    if (weight === "bold") return "JetBrainsMono_700Bold";
    if (weight === "medium") return "JetBrainsMono_500Medium";
    return "JetBrainsMono_400Regular";
  }
  if (weight === "bold") return "InstrumentSans_700Bold";
  if (weight === "semibold") return "InstrumentSans_600SemiBold";
  if (weight === "medium") return "InstrumentSans_500Medium";
  return "InstrumentSans_400Regular";
};

export function Text({
  variant = "body",
  weight = "regular",
  className = "",
  style,
  ...props
}: Props) {
  return (
    <RNText
      className={`text-ink-100 ${className}`}
      style={[{ fontFamily: fontFor(variant, weight) }, style]}
      {...props}
    />
  );
}
