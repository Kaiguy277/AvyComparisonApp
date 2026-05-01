import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Text } from "@/components/ui/Text";
import { dangerColors, palette } from "@/constants/design";
import { avalancheApi } from "@/lib/api/avalanche";
import {
  AVAILABLE_ZONES,
  CENTER_COORDS,
  NAC_ZONE_ALIASES,
  REGION_STRUCTURE,
  type AvalancheCenter,
} from "@/lib/zones";
import type { DangerRating } from "@/lib/api/avalanche";

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
  // Optional fixed height. Omit (or pass undefined) to let the picker
  // fill its parent container (used for the full-screen variant).
  height?: number;
}

const ZONE_POLY_MIN_ZOOM = 5;

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

// Built once. Leaflet via CDN, OpenTopoMap basemap, custom pins, plus
// lazy-loaded zone polygons fetched from NAC's public map-layer API.
const HTML = String.raw`<!DOCTYPE html>
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
  .center-pin { background: transparent; border: 0; width: auto !important; height: auto !important; }
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
  .pin-pill.some { background: #E8B765; color: #1F0F00; border-color: #E8B765; }
  .pin-pill.all  { background: #67D5F0; color: #070A14; border-color: #67D5F0; }
  .pin-count { background: rgba(7, 10, 20, 0.25); padding: 0 4px; border-radius: 3px; font-size: 9px; }
  .pin-pill.none .pin-count { background: rgba(255, 255, 255, 0.1); }
  .zone-tooltip {
    background: rgba(7, 10, 20, 0.92) !important;
    border: 0.5px solid #2A3550 !important;
    color: #E1E7F0 !important;
    font-family: ui-monospace, "JetBrains Mono", Menlo, monospace !important;
    font-size: 10px !important;
    letter-spacing: 0.6px !important;
    padding: 4px 8px !important;
    border-radius: 4px !important;
    box-shadow: 0 2px 8px rgba(0,0,0,0.5) !important;
  }
  .zone-tooltip::before { display: none !important; }
</style>
</head><body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var POLY_MIN_ZOOM = __POLY_MIN_ZOOM__;

  var map = L.map('map', {
    zoomControl: true,
    attributionControl: true,
    bounceAtZoomLimits: false,
  }).setView([44, -113], 4);

  L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: 14,
    attribution: '© OpenTopoMap (CC-BY-SA), © OSM',
    crossOrigin: true,
  }).addTo(map);

  var pins = {};                 // centerId -> { marker, totalZones }
  var centerPolys = {};          // centerId -> { fetched, layer, zoneIdByName }
  var pinLayer = L.layerGroup().addTo(map);
  var polyLayer = L.layerGroup().addTo(map);
  var currentSelected = {};
  var centersList = [];

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

  // Style policy
  // - Polygon FILL is the zone's CURRENT ALPINE danger color; falls back
  //   to NAC's overall (worst-of-three) color until alpine fetch arrives.
  // - Polygon STROKE is the SAME danger color but pushed to full saturation
  //   and full opacity at 3px weight, so the outline pops off the topo
  //   basemap regardless of zoom or background terrain.
  // - Selected zones override stroke with a 4px frost-cyan ring and a
  //   black halo underneath for extra contrast.
  var alpineByZone = {}; // zoneId -> hex
  function styleForFeature(feature, zoneId) {
    var sel = !!currentSelected[zoneId];
    var props = (feature && feature.properties) || {};
    var alpine = zoneId ? alpineByZone[zoneId] : null;
    var fill = alpine || props.color || '#5A6B8C';
    return {
      color: sel ? '#67D5F0' : fill,
      weight: sel ? 4 : 3,
      opacity: 1,
      fillColor: fill,
      fillOpacity: sel ? 0.55 : 0.45,
      dashArray: null,
    };
  }

  function hoverStyleFor(feature, zoneId) {
    var s = styleForFeature(feature, zoneId);
    s.weight = (s.weight || 1) + 1;
    s.fillOpacity = Math.min((s.fillOpacity || 0) + 0.15, 0.7);
    return s;
  }

  function normName(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  function fetchCenterPolys(centerId) {
    var slot = centerPolys[centerId];
    if (slot && slot.fetched) return Promise.resolve(slot);
    if (!slot) { centerPolys[centerId] = { fetched: false, layer: null, zoneIdByName: {} }; slot = centerPolys[centerId]; }
    if (slot.fetching) return slot.fetching;

    var url = 'https://api.avalanche.org/v2/public/products/map-layer/' + centerId;
    slot.fetching = fetch(url, { mode: 'cors' })
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(geo) {
        slot.fetched = true;
        slot.fetching = null;
        if (!geo || !geo.features) return slot;
        var byNorm = slot.zoneIdByName;
        var layer = L.geoJSON(geo, {
          style: function(f) {
            var nm = (f.properties && f.properties.name) || '';
            return styleForFeature(f, byNorm[normName(nm)] || '');
          },
          onEachFeature: function(feature, layer) {
            var nm = (feature.properties && feature.properties.name) || '';
            var dangerLabel = (feature.properties && feature.properties.danger) || '';
            var zoneId = byNorm[normName(nm)];
            // Tooltip shows zone name + current danger rating
            var tipParts = [];
            if (nm && nm.toLowerCase() !== 'caic zone') tipParts.push(nm);
            if (dangerLabel) tipParts.push(String(dangerLabel).toUpperCase());
            if (tipParts.length) layer.bindTooltip(tipParts.join(' · '), { className: 'zone-tooltip', sticky: true, direction: 'top' });
            layer.on('click', function(e) {
              if (zoneId) {
                post({ type: 'zoneTap', id: zoneId, name: nm });
              } else {
                // Polygon doesn't map to one of our zones (e.g. CAIC's
                // aggregate features). Treat the tap as toggling the
                // whole center — direct selection, no extra UI step.
                post({ type: 'centerToggleAll', id: centerId });
              }
              if (e && e.originalEvent) L.DomEvent.stopPropagation(e);
            });
            layer.on('mouseover', function() {
              layer.setStyle(hoverStyleFor(feature, zoneId || ''));
            });
            layer.on('mouseout', function() {
              layer.setStyle(styleForFeature(feature, zoneId || ''));
            });
          },
        });
        slot.layer = layer;
        return slot;
      })
      .catch(function(err) {
        slot.fetched = true;
        slot.fetching = null;
        return slot;
      });
    return slot.fetching;
  }

  function refreshPolyVisibility() {
    var z = map.getZoom();
    if (z < POLY_MIN_ZOOM) {
      polyLayer.clearLayers();
      pinLayer.eachLayer(function(l) { l.setOpacity(1); });
      return;
    }
    var bounds = map.getBounds();
    centersList.forEach(function(c) {
      if (!bounds.contains([c.lat, c.lon])) return;
      fetchCenterPolys(c.id).then(function(slot) {
        if (slot && slot.layer && !polyLayer.hasLayer(slot.layer)) {
          polyLayer.addLayer(slot.layer);
        }
      });
    });
    pinLayer.eachLayer(function(l) {
      var cid = l._avyCenterId;
      var slot = centerPolys[cid];
      if (slot && slot.layer && polyLayer.hasLayer(slot.layer)) {
        l.setOpacity(0);
      } else {
        l.setOpacity(1);
      }
    });
  }

  function restyleAllPolys() {
    Object.keys(centerPolys).forEach(function(cid) {
      var slot = centerPolys[cid];
      if (slot && slot.layer) {
        slot.layer.eachLayer(function(featureLayer) {
          var feature = featureLayer.feature;
          var nm = feature && feature.properties && feature.properties.name;
          var zoneId = slot.zoneIdByName[normName(nm)];
          featureLayer.setStyle(styleForFeature(feature, zoneId || ''));
        });
      }
    });
  }

  window.AVY = {
    addCenters: function(centers) {
      centersList = centers;
      centers.forEach(function(c) {
        var state = pinState(c.selectedCount, c.totalZones);
        var icon = L.divIcon({
          className: 'center-pin',
          html: buildPinHtml(c.id, state, c.selectedCount, c.totalZones),
          iconAnchor: [0, 0],
        });
        var marker = L.marker([c.lat, c.lon], { icon: icon, riseOnHover: true });
        marker._avyCenterId = c.id;
        marker.on('click', function() { post({ type: 'pin', id: c.id }); });
        pinLayer.addLayer(marker);
        pins[c.id] = { marker: marker, totalZones: c.totalZones };
        var slot = centerPolys[c.id] || { fetched: false, layer: null, zoneIdByName: {} };
        (c.zones || []).forEach(function(z) {
          slot.zoneIdByName[normName(z.name)] = z.id;
          (z.aliases || []).forEach(function(alias) {
            slot.zoneIdByName[normName(alias)] = z.id;
          });
        });
        centerPolys[c.id] = slot;
      });
      post({ type: 'ready' });
    },

    updateSelection: function(counts, selectedZoneIds) {
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
      currentSelected = {};
      (selectedZoneIds || []).forEach(function(id) { currentSelected[id] = true; });
      restyleAllPolys();
    },

    setAlpineDanger: function(map) {
      alpineByZone = map || {};
      restyleAllPolys();
    },
  };

  map.on('zoomend moveend', function() { refreshPolyVisibility(); });

  post({ type: 'init' });
</script>
</body></html>`.replace("__POLY_MIN_ZOOM__", String(ZONE_POLY_MIN_ZOOM));

export function ZoneMapPicker({
  selectedZoneIds,
  onSelectionChange,
  height,
}: Props) {
  const webRef = useRef<WebView>(null);
  const [activeCenterId, setActiveCenterId] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [alpineByZone, setAlpineByZone] = useState<Record<string, string>>({});

  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const c of FLAT_CENTERS) {
      out[c.id] = c.center.zones.filter((z) => selectedZoneIds.includes(z.id))
        .length;
    }
    return out;
  }, [selectedZoneIds]);

  // Fetch all zones' alpine danger via the cached endpoint. Colors polygons
  // by current above-treeline rating; falls back to NAC's overall color
  // until this resolves, so polygons paint instantly either way.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const allZoneIds = AVAILABLE_ZONES.map((z) => z.id);
        const r = await avalancheApi.getCachedForecasts(allZoneIds);
        if (cancelled || !r.success || !r.zones) return;
        const map: Record<string, string> = {};
        for (const z of r.zones) {
          const alpine = z.forecast?.[0]?.danger?.alpine as DangerRating | undefined;
          if (alpine) {
            const c = dangerColors[alpine];
            if (c) map[z.id] = c.fill;
          }
        }
        setAlpineByZone(map);
      } catch (err) {
        console.warn("alpine fetch failed", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Push alpine map into the WebView once both are ready
  useEffect(() => {
    if (!mapReady) return;
    if (Object.keys(alpineByZone).length === 0) return;
    const js = `window.AVY && window.AVY.setAlpineDanger(${JSON.stringify(
      alpineByZone,
    )}); true;`;
    webRef.current?.injectJavaScript(js);
  }, [alpineByZone, mapReady]);

  // Push selection updates to the map after it's ready
  useEffect(() => {
    if (!mapReady) return;
    const js = `window.AVY && window.AVY.updateSelection(${JSON.stringify(
      counts,
    )}, ${JSON.stringify(selectedZoneIds)}); true;`;
    webRef.current?.injectJavaScript(js);
  }, [counts, mapReady, selectedZoneIds]);

  const handleMessage = (event: WebViewMessageEvent) => {
    let msg: any;
    try {
      msg = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === "init") {
      const payload = FLAT_CENTERS.map((c) => ({
        id: c.id,
        name: c.name,
        lat: c.lat,
        lon: c.lon,
        totalZones: c.center.zones.length,
        selectedCount: c.center.zones.filter((z) =>
          selectedZoneIds.includes(z.id),
        ).length,
        zones: c.center.zones.map((z) => ({
          id: z.id,
          name: z.name,
          aliases: NAC_ZONE_ALIASES[z.id] || [],
        })),
      }));
      const js = `window.AVY.addCenters(${JSON.stringify(payload)}); true;`;
      webRef.current?.injectJavaScript(js);
    } else if (msg.type === "ready") {
      setMapReady(true);
    } else if (msg.type === "pin" && typeof msg.id === "string") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setActiveCenterId(msg.id);
    } else if (msg.type === "zoneTap" && typeof msg.id === "string") {
      Haptics.selectionAsync().catch(() => {});
      const zoneId = msg.id;
      if (selectedZoneIds.includes(zoneId)) {
        onSelectionChange(selectedZoneIds.filter((id) => id !== zoneId));
      } else {
        onSelectionChange([...selectedZoneIds, zoneId]);
      }
    } else if (msg.type === "centerToggleAll" && typeof msg.id === "string") {
      // Polygon doesn't disambiguate (e.g. CAIC aggregate features) —
      // toggle every zone in that center as a single action.
      Haptics.selectionAsync().catch(() => {});
      const centerId = msg.id;
      const zoneIds = AVAILABLE_ZONES.filter((z) => z.center === centerId).map(
        (z) => z.id,
      );
      const allOn = zoneIds.every((id) => selectedZoneIds.includes(id));
      if (allOn) {
        onSelectionChange(selectedZoneIds.filter((id) => !zoneIds.includes(id)));
      } else {
        onSelectionChange([...new Set([...selectedZoneIds, ...zoneIds])]);
      }
    }
  };

  const activeCenter = useMemo(
    () => FLAT_CENTERS.find((c) => c.id === activeCenterId) || null,
    [activeCenterId],
  );

  const fixed = typeof height === "number";
  return (
    <View style={fixed ? undefined : { flex: 1 }}>
      <View
        style={{
          ...(fixed
            ? { height }
            : { flex: 1 }),
          borderRadius: fixed ? 14 : 0,
          overflow: "hidden",
          borderWidth: fixed ? 0.5 : 0,
          borderColor: palette.ink[700],
          backgroundColor: palette.ink[900],
        }}
      >
        <WebView
          ref={webRef}
          source={{ html: HTML }}
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
            ZONES COLORED BY ALPINE DANGER · TAP TO TOGGLE
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
