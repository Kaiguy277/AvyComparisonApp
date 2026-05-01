import { useMemo, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Text } from "@/components/ui/Text";
import { palette } from "@/constants/design";
import {
  CENTER_COORDS,
  REGION_STRUCTURE,
  type AvalancheCenter,
} from "@/lib/zones";

interface CenterMeta {
  id: string;
  name: string;
  region: string;
  center: AvalancheCenter;
  lat: number;
  lon: number;
}

interface Props {
  selectedZoneIds: string[];
  onSelectionChange: (zoneIds: string[]) => void;
}

const MAP_HEIGHT = 380;

const FLAT_CENTERS: CenterMeta[] = REGION_STRUCTURE.flatMap((r) =>
  r.centers
    .filter((c) => CENTER_COORDS[c.id])
    .map((c) => ({
      id: c.id,
      name: c.name,
      region: r.name,
      center: c,
      lat: CENTER_COORDS[c.id].lat,
      lon: CENTER_COORDS[c.id].lon,
    })),
);

function buildHtml(): string {
  // Inline Leaflet from CDN. OpenTopoMap gives free terrain + contour
  // tiles — exactly what a backcountry user wants. Dark UI chrome
  // around it via Leaflet's container background.
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8" />
<meta name="viewport" content="initial-scale=1.0, maximum-scale=1.0, user-scalable=no, width=device-width" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; background: #070A14; }
  .leaflet-container { background: #070A14; outline: none; }
  .leaflet-control-attribution {
    background: rgba(7, 10, 20, 0.65) !important;
    color: #8794AE !important;
    font-size: 9px !important;
    padding: 2px 6px !important;
    border-radius: 4px !important;
  }
  .leaflet-control-attribution a { color: #67D5F0 !important; }
  .leaflet-control-zoom {
    border: 0.5px solid #2A3550 !important;
    border-radius: 8px !important;
    overflow: hidden !important;
    box-shadow: 0 2px 8px rgba(0,0,0,0.4) !important;
  }
  .leaflet-control-zoom a {
    background: rgba(7, 10, 20, 0.85) !important;
    color: #E1E7F0 !important;
    border-bottom: 0.5px solid #2A3550 !important;
    font-weight: 300 !important;
  }
  .leaflet-control-zoom a:hover { background: rgba(20, 28, 46, 0.95) !important; color: #67D5F0 !important; }
  .center-pin {
    background: transparent;
    border: 0;
    width: auto !important;
    height: auto !important;
  }
  .pin-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-radius: 999px;
    border: 1px solid #3B4A6B;
    background: rgba(7, 10, 20, 0.92);
    color: #E1E7F0;
    font-family: ui-monospace, "JetBrains Mono", Menlo, monospace;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.6px;
    white-space: nowrap;
    box-shadow: 0 2px 8px rgba(0,0,0,0.5);
    transform: translate(-50%, -50%);
    pointer-events: auto;
  }
  .pin-pill.some {
    background: #E8B765;
    color: #1F0F00;
    border-color: #E8B765;
  }
  .pin-pill.all {
    background: #67D5F0;
    color: #070A14;
    border-color: #67D5F0;
  }
  .pin-count {
    background: rgba(7, 10, 20, 0.25);
    padding: 0 4px;
    border-radius: 3px;
    font-size: 9px;
  }
  .pin-pill.none .pin-count { background: rgba(255, 255, 255, 0.1); }
</style>
</head><body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  // Disable rebound on bounce so the basemap stays stable inside a scroll view.
  var map = L.map('map', {
    zoomControl: true,
    attributionControl: true,
    bounceAtZoomLimits: false,
  }).setView([44, -113], 4);

  // OpenTopoMap — free terrain + topo. Slightly heavier tiles but loads fast.
  L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: 14,
    attribution: '© OpenTopoMap (CC-BY-SA), © OSM',
    crossOrigin: true,
  }).addTo(map);

  var pins = {};

  function buildPinHtml(id, state, count, total) {
    var cls = 'pin-pill ' + state;
    var countHtml = count > 0 ? '<span class="pin-count">' + count + '/' + total + '</span>' : '';
    return '<div class="' + cls + '">' + id + countHtml + '</div>';
  }

  function pinState(count, total) {
    if (count === 0) return 'none';
    if (count === total) return 'all';
    return 'some';
  }

  function post(payload) {
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    }
  }

  window.AVY = {
    addCenters: function(centers) {
      centers.forEach(function(c) {
        var state = pinState(c.selectedCount, c.totalZones);
        var icon = L.divIcon({
          className: 'center-pin',
          html: buildPinHtml(c.id, state, c.selectedCount, c.totalZones),
          iconAnchor: [0, 0],
        });
        var marker = L.marker([c.lat, c.lon], { icon: icon, riseOnHover: true });
        marker.on('click', function() { post({ type: 'pin', id: c.id }); });
        marker.addTo(map);
        pins[c.id] = { marker: marker, totalZones: c.totalZones };
      });
      post({ type: 'ready' });
    },

    updateSelection: function(counts) {
      Object.keys(pins).forEach(function(id) {
        var p = pins[id];
        var sel = counts[id] || 0;
        var state = pinState(sel, p.totalZones);
        p.marker.setIcon(L.divIcon({
          className: 'center-pin',
          html: buildPinHtml(id, state, sel, p.totalZones),
          iconAnchor: [0, 0],
        }));
      });
    },

    fitBounds: function(bounds) {
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 6 });
    },
  };

  // Tell RN we're alive — it will send the centers payload back.
  post({ type: 'init' });
</script>
</body></html>`;
}

export function ZoneMapPicker({ selectedZoneIds, onSelectionChange }: Props) {
  const webRef = useRef<WebView>(null);
  const [activeCenterId, setActiveCenterId] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const html = useMemo(buildHtml, []);

  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const c of FLAT_CENTERS) {
      out[c.id] = c.center.zones.filter((z) => selectedZoneIds.includes(z.id))
        .length;
    }
    return out;
  }, [selectedZoneIds]);

  const handleMessage = (event: WebViewMessageEvent) => {
    let msg: any;
    try {
      msg = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === "init") {
      // Push the centers + initial counts
      const payload = FLAT_CENTERS.map((c) => ({
        id: c.id,
        name: c.name,
        lat: c.lat,
        lon: c.lon,
        totalZones: c.center.zones.length,
        selectedCount: c.center.zones.filter((z) =>
          selectedZoneIds.includes(z.id),
        ).length,
      }));
      const js = `window.AVY.addCenters(${JSON.stringify(payload)}); true;`;
      webRef.current?.injectJavaScript(js);
    } else if (msg.type === "ready") {
      setMapReady(true);
    } else if (msg.type === "pin" && typeof msg.id === "string") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setActiveCenterId(msg.id);
    }
  };

  // Push count updates whenever selection changes (after map is ready)
  useMemo(() => {
    if (!mapReady) return;
    const js = `window.AVY && window.AVY.updateSelection(${JSON.stringify(
      counts,
    )}); true;`;
    webRef.current?.injectJavaScript(js);
  }, [counts, mapReady]);

  const activeCenter = useMemo(
    () => FLAT_CENTERS.find((c) => c.id === activeCenterId) || null,
    [activeCenterId],
  );

  return (
    <View>
      <View
        style={{
          height: MAP_HEIGHT,
          borderRadius: 14,
          overflow: "hidden",
          borderWidth: 0.5,
          borderColor: palette.ink[700],
          backgroundColor: palette.ink[900],
        }}
      >
        <WebView
          ref={webRef}
          source={{ html }}
          originWhitelist={["*"]}
          javaScriptEnabled
          domStorageEnabled
          scrollEnabled={false}
          nestedScrollEnabled
          androidLayerType="hardware"
          onMessage={handleMessage}
          style={{ backgroundColor: palette.ink[950] }}
        />

        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            bottom: 8,
            left: 8,
            right: 8,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 10,
            paddingVertical: 6,
            backgroundColor: "rgba(7, 10, 20, 0.7)",
            borderRadius: 8,
            borderWidth: 0.5,
            borderColor: palette.ink[700],
          }}
        >
          <Text
            variant="mono"
            weight="medium"
            className="text-ink-300"
            style={{ fontSize: 9, letterSpacing: 1.4 }}
          >
            TAP A CENTER · DRAG TO PAN · PINCH TO ZOOM
          </Text>
          <Text
            variant="mono"
            className="text-ink-400"
            style={{ fontSize: 9, letterSpacing: 1.4 }}
          >
            {selectedZoneIds.length} SEL.
          </Text>
        </View>
      </View>

      {/* Center sheet */}
      <Modal
        visible={!!activeCenter}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveCenterId(null)}
      >
        <Pressable
          onPress={() => setActiveCenterId(null)}
          style={{
            flex: 1,
            backgroundColor: "rgba(7,10,20,0.6)",
            justifyContent: "flex-end",
          }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: palette.ink[900],
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderTopWidth: 0.5,
              borderColor: palette.ink[600],
              paddingTop: 12,
              paddingBottom: 36,
              maxHeight: "70%",
            }}
          >
            <View style={{ alignItems: "center", marginBottom: 12 }}>
              <View
                style={{
                  width: 36,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: palette.ink[600],
                }}
              />
            </View>
            {activeCenter ? (
              <SheetContent
                center={activeCenter.center}
                region={activeCenter.region}
                selectedZoneIds={selectedZoneIds}
                onSelectionChange={onSelectionChange}
                onClose={() => setActiveCenterId(null)}
              />
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function SheetContent({
  center,
  region,
  selectedZoneIds,
  onSelectionChange,
  onClose,
}: {
  center: AvalancheCenter;
  region: string;
  selectedZoneIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onClose: () => void;
}) {
  const zoneIds = center.zones.map((z) => z.id);
  const selectedInCenter = zoneIds.filter((id) => selectedZoneIds.includes(id));
  const allOn = selectedInCenter.length === zoneIds.length;
  const allOff = selectedInCenter.length === 0;

  const toggleAll = () => {
    Haptics.selectionAsync().catch(() => {});
    if (allOn) {
      onSelectionChange(selectedZoneIds.filter((id) => !zoneIds.includes(id)));
    } else {
      onSelectionChange([...new Set([...selectedZoneIds, ...zoneIds])]);
    }
  };

  const toggleOne = (zoneId: string) => {
    Haptics.selectionAsync().catch(() => {});
    if (selectedZoneIds.includes(zoneId)) {
      onSelectionChange(selectedZoneIds.filter((id) => id !== zoneId));
    } else {
      onSelectionChange([...selectedZoneIds, zoneId]);
    }
  };

  return (
    <View>
      <View style={{ paddingHorizontal: 24, paddingBottom: 12 }}>
        <Text
          variant="mono"
          weight="medium"
          className="text-frost-400"
          style={{ fontSize: 11, letterSpacing: 2 }}
        >
          {region.toUpperCase()} · {center.id}
        </Text>
        <Text
          variant="display"
          className="text-ink-50"
          style={{ fontSize: 26, lineHeight: 30, marginTop: 2 }}
        >
          {center.name}
        </Text>
      </View>

      <ScrollView
        style={{ maxHeight: 340 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 8 }}
      >
        {center.zones.map((zone) => {
          const sel = selectedZoneIds.includes(zone.id);
          return (
            <Pressable
              key={zone.id}
              onPress={() => toggleOne(zone.id)}
              className="flex-row items-center"
              style={{
                paddingVertical: 14,
                borderBottomWidth: 0.5,
                borderColor: palette.ink[700],
              }}
            >
              <View style={{ marginRight: 14 }}>
                <Checkbox
                  checked={sel}
                  onChange={() => toggleOne(zone.id)}
                />
              </View>
              <Text
                weight={sel ? "medium" : "regular"}
                className={sel ? "text-ink-50" : "text-ink-200"}
                style={{ fontSize: 16 }}
              >
                {zone.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View
        style={{
          flexDirection: "row",
          gap: 10,
          paddingHorizontal: 24,
          paddingTop: 14,
        }}
      >
        <Button
          variant="outline"
          size="default"
          onPress={toggleAll}
          className="flex-1"
        >
          {allOn ? "Deselect all" : allOff ? "Select all" : "Select all"}
        </Button>
        <Button
          variant="primary"
          size="default"
          onPress={onClose}
          className="flex-1"
          leftIcon={
            <Ionicons name="checkmark" size={14} color={palette.ink[950]} />
          }
        >
          Done
        </Button>
      </View>
    </View>
  );
}
