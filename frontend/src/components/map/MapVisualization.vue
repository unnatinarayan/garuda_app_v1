<!-- frontend/src/components/map/MapVisualization.vue -->

<template>
    <div class="map-container flex flex-col h-full bg-gray-900 rounded-xl shadow-inner">
        <div class="map-header bg-gray-700 rounded-t-xl flex justify-between items-center">
            <span class="text-xs sm:text-sm text-gray-400" v-if="!props.isMonitorMode"></span>
        </div>
        <div id="map" class="map-view flex-grow" ref="mapDiv"></div>
    </div>
</template>
<script setup>
import { onMounted, ref, nextTick, watch } from 'vue';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import L from 'leaflet';
import 'leaflet-draw';
// import HighchartsVue from 'highcharts-vue'; // Import the wrapper
import 'leaflet.gridlayer.googlemutant'; // Keep this for satellite view
const props = defineProps({
    // AOIs to load when viewing an existing project (Create/Update or Monitor)
    aoisToDisplay: Array,
    isMonitorMode: Boolean,
});
const emit = defineEmits(['aoi-drawn', 'aoi-clicked']);
// Reactive State
const map = ref(null);
const drawnItems = ref(null);
const savedAoisLayerGroup = ref(null);
// Utility function to patch Leaflet Draw
const safePatch = (handler) => {
    if (handler && handler.prototype && !handler.prototype._fireCreatedEvent) {
        handler.prototype._fireCreatedEvent = function (layer) {
            this._map.fire(L.Draw.Event.CREATED, { layer: layer, layerType: this.type });
        };
    }
};
const initializeMap = () => {
    if (!document.getElementById('map')) return;
    // Destroy existing map instance if present to avoid reinitialization errors
    if (map.value) {
        map.value.remove();
        map.value = null;
    }
    map.value = L.map('map');
    // Define Layers
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19
    });
    const baseLayers = { 'OpenStreetMap': osmLayer };
    // 1. Set OpenStreetMap as FIRST PRIORITY and default layer
    osmLayer.addTo(map.value);
    L.control.layers(baseLayers).addTo(map.value);
    drawnItems.value = new (L.FeatureGroup)();
    map.value.addLayer(drawnItems.value);
    savedAoisLayerGroup.value = new (L.FeatureGroup)();
    map.value.addLayer(savedAoisLayerGroup.value); // Add this new layer to the map
    if (!props.isMonitorMode) {
        setupDrawingControls();
    }
    // Add existing AOIs if available
    if (props.aoisToDisplay && props.aoisToDisplay.length > 0) {
        loadExistingAOIs(props.aoisToDisplay, true);
    } else {
        // Fit the world view if no AOIs are loaded
        map.value.setView([21.5937, 80.9629], 5);
    }
    L.DomUtil.addClass(map.value.getPane('tilePane'), 'leaflet-pane-hardware-accel');
};
const setupDrawingControls = () => {
    safePatch(L.Draw.Polygon);
    safePatch(L.Draw.Polyline);
    safePatch(L.Draw.Marker);
    safePatch(L.Draw.Circle);
    const drawControl = new (L.Control).Draw({
        edit: {
            featureGroup: drawnItems.value,
            edit: false,
            remove: false
        },
        draw: {
            polygon: true,
            polyline: true, // Line
            marker: true, // Point
            circle: false, // Simplified: Treat circle as a specialized buffer of a point/polygon on the backend
            rectangle: false,
        }
    });
    map.value.addControl(drawControl);
    // Handle Drawing Events
    map.value.on((L.Draw).Event.DRAWSTART, (e) => {
    });
    map.value.on((L.Draw).Event.CREATED, (e) => {
        let layer = e.layer;
        const layerType = e.layerType;
        drawnItems.value.addLayer(layer);
        // Convert to GeoJSON
        const geoJsonFeature = layer.toGeoJSON();
        let geometryType;
        // Normalize geometry type for backend consistency
        switch (layerType) {
            case 'marker':
                geometryType = 'Point';
                break;
            case 'polyline':
                geometryType = 'LineString';
                break;
            case 'polygon':
            default:
                geometryType = 'Polygon';
                break;
        }
        // Emit data. Buffer should only be non-zero for Point/Line.
        // const buffer = requiresBufferInput.value ? bufferDistance.value || 0 : 0;
        const aoiData = {
            geometry: geoJsonFeature.geometry,
            geometryType: geometryType,
        };
        emit('aoi-drawn', aoiData);
    });
};
// defineExpose({
//     drawnItems: drawnItems
// });
// **NEW FUNCTIONALITY: Displaying Existing AOIs**
const loadExistingAOIs = (aois, shouldFitBounds = false) => {
    if (savedAoisLayerGroup.value) {
        savedAoisLayerGroup.value.clearLayers();
    } else {
        return; // Safety exit if not initialized
    }
    const aoiLayers = aois.map(aoi => {
        // CRITICAL: The backend returns geometry as a GeoJSON object inside geomGeoJson property
        const layer = L.geoJSON(aoi.geomGeoJson, {
            style: {
                color: props.isMonitorMode ? '#10b981' : '#f97316', // Green for monitor, Orange for edit
                weight: 3,
                opacity: 0.8,
                fillColor: props.isMonitorMode ? '#10b981' : '#f97316',
                fillOpacity: 0.3
            },
            onEachFeature: (feature, layer) => {
                // Attach details for click event
                layer.options.aoiDetails = aoi;
                // Add tooltip for quick identification
                layer.bindTooltip(`AOI: ${aoi.name} (${aoi.mappedAlgorithms.length} Algos)`, {
                    permanent: false,
                    direction: 'top'
                });
                // Attach click handler for responsiveness in Monitor/Display mode
                if (props.isMonitorMode) {
                    layer.on('click', (e) => {
                        // CRITICAL FIX: Emit the AOI details to the parent component
                        emit('aoi-clicked', aoi);
                        // Center map on the clicked feature
                        map.value.setView(e.latlng, map.value.getZoom());
                    });
                }
            }
        });
        return layer;
    });
    // Add all AOI layers to the map
    const combinedAoiLayer = L.featureGroup(aoiLayers).addTo(drawnItems.value);
    if (!shouldFitBounds) return;
    // Zoom/pan the map to fit all loaded AOIs
    try {
        if (combinedAoiLayer.getLayers().length > 0) {
            const layers = combinedAoiLayer.getLayers();
            const bounds = combinedAoiLayer.getBounds();
            let center = null;
            let zoom = 5;
            // CRITICAL FIX: Check if the bounds are valid before attempting to fit
            if (bounds.isValid()) {
                map.value.fitBounds(bounds, { padding: [50, 50] });
            }
            else if (layers.length >= 1) {
                // Case 2: Single invalid feature (typically a Point/Marker)
                const layer = layers[0];
                if (layer.getLatLng) { // Check if it's a marker or similar point object
                    // center = layer.getLatLng();
                    center = L.Util.toLatLng(layer.getLatLng());
                    zoom = 12; // Zoom in for a single marker
                }
                if (center && center.lat !== 0 && center.lng !== 0) {
                    map.value.setView(center, zoom);
                } else {
                    map.value.setView([21.5937, 80.9629], 5);
                    // console.warn("Marker center read failed. Falling back to default view.");
                }
            }
            else {
                map.value.setView([21.5937, 80.9629], 5); // Fallback
                console.warn("Invalid bounds detected and could not be handled automatically.");
            }
        }
    } catch (e) {
        console.warn("Could not fit bounds of AOIs:", e);
    }
};
onMounted(() => {
    nextTick(initializeMap);
});
// Watch function: Only fit bounds when the layer count changes (i.e., initial load, add, or delete)
watch(() => props.aoisToDisplay.length, (newLength, oldLength) => {
    if (map.value) {
        // We only want to force a fit/center if a new item is added or an item is removed.
        const shouldFit = newLength !== oldLength || newLength === 1;
        loadExistingAOIs(props.aoisToDisplay, shouldFit);
    }
});
watch(() => props.aoisToDisplay, () => {
    if (map.value && props.aoisToDisplay.length > 0) {
        loadExistingAOIs(props.aoisToDisplay, false); // No bounds fitting, just redrawing
    }
}, { deep: true });
</script>
<style scoped>
.map-container {
    min-height: 50vw;
    /* Ensures the map div has a height */
}
.map-view {
    height: 100%;
}
@media (max-width: 1024px) {
    .map-container {
        height: 60vw;
        /* Smaller height for mobile screens */
    }
}
@media (max-width: 640px) {
    .map-container {
        /* Smaller height for mobile screens, but still generous */
        min-height: 58vh;
    }
}
/* Style for Leaflet Draw toolbar buttons */
:global(.leaflet-draw-toolbar a) {
    background-color: var(--color-gray-700) !important;
    color: white !important;
}
:global(.leaflet-draw-toolbar a:hover) {
    background-color: var(--color-gray-600) !important;
}
</style>