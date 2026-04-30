import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export type CheckboxState = boolean | "indeterminate";

interface CheckboxProps {
  checked: CheckboxState;
  onChange: () => void;
  size?: "sm" | "default";
}

export function Checkbox({ checked, onChange, size = "default" }: CheckboxProps) {
  const dimension = size === "sm" ? 16 : 20;
  const isOn = checked === true;
  const isIndeterminate = checked === "indeterminate";
  const isOff = checked === false;
  return (
    <Pressable
      onPress={onChange}
      hitSlop={8}
      className={`items-center justify-center rounded border ${
        isOn ? "bg-primary border-primary" : isIndeterminate ? "bg-primary/50 border-primary" : "border-border bg-transparent"
      }`}
      style={{ width: dimension, height: dimension }}
    >
      {isOn ? (
        <Ionicons name="checkmark" size={dimension - 4} color="white" />
      ) : isIndeterminate ? (
        <View
          style={{ width: dimension * 0.5, height: 2, backgroundColor: "white" }}
        />
      ) : null}
    </Pressable>
  );
}
