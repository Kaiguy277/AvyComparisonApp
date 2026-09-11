// Drop-a-pin map for the observation location. Leaflet in a WebView with
// OpenStreetMap tiles — same approach as ZoneMapPicker, so there's no new
// native dependency and it works offline-degraded (blank tiles, pin still
// places and reports).

import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Modal, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/Text";
import { Touchable } from "@/components/ui/Touchable";
import { palette } from "@/constants/design";

export interface MapPoint {
  lat: number;
  lng: number;
}

function html(start: MapPoint | null): string {
  const lat = start?.lat ?? 60.83;
  const lng = start?.lng ?? -149.0;
  const zoom = start ? 13 : 8;
  const initial = start ? "true" : "false";
  return `<!doctype html><html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>html,body,#map{height:100%;margin:0;background:#EDE5D2}
.hint{position:absolute;top:10px;left:10px;right:10px;z-index:500;background:rgba(27,25,22,.86);color:#F6EFDD;
font:13px/1.35 -apple-system,system-ui,sans-serif;padding:9px 12px;border-radius:10px}</style>
</head><body>
<div class="hint">Tap the map to drop a pin. Drag it to fine-tune.</div>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var map = L.map('map', { zoomControl: true }).setView([${lat}, ${lng}], ${zoom});
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 17, attribution: '© OpenStreetMap' }).addTo(map);
  var marker = null;
  function report(ll) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ lat: ll.lat, lng: ll.lng }));
    }
  }
  function place(ll) {
    if (marker) { marker.setLatLng(ll); }
    else {
      marker = L.marker(ll, { draggable: true }).addTo(map);
      marker.on('dragend', function () { report(marker.getLatLng()); });
    }
    report(ll);
  }
  if (${initial}) { place({ lat: ${lat}, lng: ${lng} }); }
  map.on('click', function (e) { place(e.latlng); });
</script></body></html>`;
}

export function MapPointPicker({
  visible,
  initial,
  onCancel,
  onPick,
}: {
  visible: boolean;
  initial: MapPoint | null;
  onCancel: () => void;
  onPick: (p: MapPoint) => void;
}) {
  const insets = useSafeAreaInsets();
  const [picked, setPicked] = useState<MapPoint | null>(initial);
  const [loading, setLoading] = useState(true);
  const webRef = useRef<WebView>(null);
  const source = useMemo(() => ({ html: html(initial) }), [initial]);

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const p = JSON.parse(e.nativeEvent.data) as MapPoint;
      if (Number.isFinite(p.lat) && Number.isFinite(p.lng)) setPicked(p);
    } catch {
      // Ignore anything that isn't our payload.
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: palette.ink[950], paddingTop: insets.top }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 0.5,
            borderColor: palette.ink[700],
          }}
        >
          <Touchable onPress={onCancel} hitSlop={10}>
            <Text style={{ fontSize: 15, color: palette.ink[300] }}>Cancel</Text>
          </Touchable>
          <Text variant="mono" weight="medium" allowFontScaling={false} style={{ fontSize: 11, letterSpacing: 1.4, color: palette.ink[400] }}>
            PICK A LOCATION
          </Text>
          <Touchable onPress={() => picked && onPick(picked)} disabled={!picked} hitSlop={10}>
            <Text weight="semibold" style={{ fontSize: 15, color: picked ? palette.frost[400] : palette.ink[500] }}>
              Use this
            </Text>
          </Touchable>
        </View>

        <View style={{ flex: 1 }}>
          <WebView
            ref={webRef}
            source={source}
            onMessage={onMessage}
            onLoadEnd={() => setLoading(false)}
            originWhitelist={["*"]}
            style={{ flex: 1, backgroundColor: palette.ink[950] }}
          />
          {loading ? (
            <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator color={palette.ink[300]} />
            </View>
          ) : null}
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: insets.bottom + 12 }}>
          <Text className="text-ink-300" style={{ fontSize: 13 }}>
            {picked
              ? `${picked.lat.toFixed(5)}, ${picked.lng.toFixed(5)}`
              : "No pin yet — tap the map."}
          </Text>
        </View>
      </View>
    </Modal>
  );
}
