import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DraggableFlatList, {
  ScaleDecorator,
  type RenderItemParams,
} from "react-native-draggable-flatlist";
import * as Haptics from "expo-haptics";
import { Text } from "@/components/ui/Text";
import { palette } from "@/constants/design";
import { AVAILABLE_ZONES } from "@/lib/zones";

interface Props {
  // Unified list of currently-displayed zones (favorites + ad-hoc).
  displayedZoneIds: string[];
  // Set of zone IDs that are favorited (persist across launches). Zones in
  // displayedZoneIds but NOT in favoriteIds are session-only ad-hoc picks.
  favoriteIds: Set<string>;
  onReorder: (next: string[]) => void;
  onToggleFavorite: (zoneId: string) => void;
  onRemove: (zoneId: string) => void;
}

interface Row {
  id: string;
  name: string;
}

// Long-press a row to grab it; drag to a new position; release to commit.
// Wrapped in ScaleDecorator so the active row scales up subtly during the
// drag for clear visual feedback.
//
// Each row has a star toggle (filled = favorited/persists, outline =
// session-only) and an × to remove the row from the display entirely.
export function FavoritesReorder({
  displayedZoneIds,
  favoriteIds,
  onReorder,
  onToggleFavorite,
  onRemove,
}: Props) {
  const data: Row[] = displayedZoneIds.map((id) => ({
    id,
    name: AVAILABLE_ZONES.find((z) => z.id === id)?.name || id,
  }));

  const renderItem = ({ item, drag, isActive }: RenderItemParams<Row>) => {
    const isFav = favoriteIds.has(item.id);
    return (
      <ScaleDecorator>
        <Pressable
          onLongPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            drag();
          }}
          delayLongPress={180}
          disabled={isActive}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 10,
            paddingHorizontal: 12,
            backgroundColor: isActive ? palette.ink[700] : palette.ink[900],
            borderTopWidth: 0.5,
            borderColor: palette.ink[700] + "80",
          }}
        >
          <Ionicons
            name="reorder-three-outline"
            size={18}
            color={palette.ink[400]}
            style={{ marginRight: 6 }}
          />
          <Pressable
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onToggleFavorite(item.id);
            }}
            hitSlop={8}
            style={{
              paddingHorizontal: 6,
              paddingVertical: 4,
              marginRight: 4,
            }}
          >
            <Ionicons
              name={isFav ? "star" : "star-outline"}
              size={15}
              color={isFav ? palette.aspen[400] : palette.ink[500]}
            />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text
              className="text-ink-100"
              style={{
                fontSize: 14,
                color: isFav ? palette.ink[100] : palette.ink[200],
              }}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            {!isFav ? (
              <Text
                variant="mono"
                className="text-ink-400"
                style={{ fontSize: 9, letterSpacing: 1.2, marginTop: 1 }}
              >
                STAR TO KEEP
              </Text>
            ) : null}
          </View>
          <Pressable
            onPress={() => onRemove(item.id)}
            hitSlop={8}
            style={{ paddingLeft: 8, paddingRight: 4 }}
          >
            <Ionicons name="close" size={16} color={palette.ink[400]} />
          </Pressable>
        </Pressable>
      </ScaleDecorator>
    );
  };

  return (
    <View
      style={{
        borderRadius: 14,
        borderWidth: 0.5,
        borderColor: palette.ink[700],
        backgroundColor: palette.ink[900],
        overflow: "hidden",
      }}
    >
      <DraggableFlatList
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        onDragEnd={({ data: next }) => {
          onReorder(next.map((d) => d.id));
        }}
        // The list lives inside a parent ScrollView; disable its own
        // scrolling so they don't fight each other. Rows only need to
        // render, not scroll independently.
        scrollEnabled={false}
        activationDistance={8}
      />
    </View>
  );
}
