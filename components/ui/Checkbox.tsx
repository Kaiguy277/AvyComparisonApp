import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { palette } from "@/constants/design";

export type CheckboxState = boolean | "indeterminate";

interface CheckboxProps {
  checked: CheckboxState;
  onChange: () => void;
  size?: "sm" | "default";
}

export function Checkbox({ checked, onChange, size = "default" }: CheckboxProps) {
  const dim = size === "sm" ? 18 : 22;
  const isOn = checked === true;
  const isMid = checked === "indeterminate";

  const handle = () => {
    Haptics.selectionAsync().catch(() => {});
    onChange();
  };

  return (
    <Pressable onPress={handle} hitSlop={8}>
      <View
        style={{
          width: dim,
          height: dim,
          borderRadius: 6,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: isOn ? palette.ink[50] : isMid ? palette.frost[400] : "transparent",
          borderWidth: 1,
          borderColor: isOn || isMid ? "transparent" : palette.ink[500],
        }}
      >
        {isOn ? (
          <Ionicons name="checkmark" size={dim - 6} color={palette.ink[950]} />
        ) : isMid ? (
          <View
            style={{
              width: dim * 0.5,
              height: 2,
              borderRadius: 1,
              backgroundColor: palette.ink[950],
            }}
          />
        ) : null}
      </View>
    </Pressable>
  );
}
