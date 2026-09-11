import { useState, type ReactNode } from "react";
import {
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

// Pressable with a style function that actually works on device.
//
// This project runs NativeWind v4 with `jsxImportSource: "nativewind"`, so
// every JSX element goes through NativeWind's interop. That interop does
// not apply a *function* `style` on Pressable on native — it does on web,
// which is why layout bugs here rendered correctly in the web preview and
// collapsed on the phone: the Pressable fell back to defaults, so padding,
// borders, backgrounds and `flexDirection: "row"` all disappeared and the
// children stacked at the top-left. Symptoms across this app were
// "transparent" buttons, icons with no boxes, labels outside their pill,
// and section headers stacking vertically.
//
// The codebase already had the safe pattern in a few places (layout on a
// plain child View, `opacity` only in the function). This component makes
// the ergonomic version safe: it resolves the function itself from local
// pressed state and hands Pressable a plain style object.
type TouchableStyle =
  | StyleProp<ViewStyle>
  | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);

interface TouchableProps extends Omit<PressableProps, "style" | "children"> {
  style?: TouchableStyle;
  children?: ReactNode;
}

export function Touchable({
  style,
  children,
  onPressIn,
  onPressOut,
  ...rest
}: TouchableProps) {
  const [pressed, setPressed] = useState(false);
  const resolved = typeof style === "function" ? style({ pressed }) : style;
  return (
    <Pressable
      {...rest}
      style={resolved}
      onPressIn={(e: GestureResponderEvent) => {
        setPressed(true);
        onPressIn?.(e);
      }}
      onPressOut={(e: GestureResponderEvent) => {
        setPressed(false);
        onPressOut?.(e);
      }}
    >
      {children}
    </Pressable>
  );
}
