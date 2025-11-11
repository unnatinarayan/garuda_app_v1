<!-- MapVisualization.vue - Fully Responsive -->

<template>
    <div class="map-container flex flex-col h-full bg-gray-900 rounded-lg shadow-inner">
        <div id="map" class="map-view flex-grow z-[60]" ref="mapDiv"></div>
    </div>
</template>

<script setup>
import { onMounted, ref, nextTick, watch, onBeforeUnmount } from 'vue';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet.fullscreen';
import 'leaflet.fullscreen/Control.FullScreen.css';
import L from 'leaflet';
import 'leaflet-draw';
import 'leaflet.gridlayer.googlemutant';


const props = defineProps({
    aoisToDisplay: Array,
    isMonitorMode: Boolean,
});

const emit = defineEmits(['aoi-drawn', 'aoi-clicked']);

const map = ref(null);
const drawnItems = ref(null);
const savedAoisLayerGroup = ref(null);
const mapDiv = ref(null);

const safePatch = (handler) => {
    if (handler && handler.prototype && !handler.prototype._fireCreatedEvent) {
        handler.prototype._fireCreatedEvent = function (layer) {
            this._map.fire(L.Draw.Event.CREATED, { layer: layer, layerType: this.type });
        };
    }
};

const initializeMap = () => {
    if (!mapDiv.value) return;

    if (map.value) {
        map.value.remove();
        map.value = null;
    }

    map.value = L.map(mapDiv.value);
   if (L.Control.Fullscreen) {
    map.value.addControl(new L.Control.Fullscreen({
        position: 'bottomleft',
        title: {
            'false': 'Enter Fullscreen',
            'true': 'Exit Fullscreen'
        }
    }));
}

    map.value.on('fullscreenchange', () => {
        setTimeout(() => map.value.invalidateSize(), 200);
    });

    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19
    });

    const baseLayers = { 'OpenStreetMap': osmLayer };
    osmLayer.addTo(map.value);
    L.control.layers(baseLayers).addTo(map.value);

    drawnItems.value = new L.FeatureGroup();
    map.value.addLayer(drawnItems.value);

    savedAoisLayerGroup.value = new L.FeatureGroup();
    map.value.addLayer(savedAoisLayerGroup.value);

    if (!props.isMonitorMode) {
        setupDrawingControls();
    }

    if (props.aoisToDisplay && props.aoisToDisplay.length > 0) {
        loadExistingAOIs(props.aoisToDisplay, true);
        setTimeout(() => {
  if (map.value) map.value.invalidateSize();
}, 50);
    } else {
        map.value.setView([21.5937, 80.9629], 5);
    }

    L.DomUtil.addClass(map.value.getPane('tilePane'), 'leaflet-pane-hardware-accel');
};

const setupDrawingControls = () => {
    safePatch(L.Draw.Polygon);
    safePatch(L.Draw.Polyline);
    safePatch(L.Draw.Marker);
    safePatch(L.Draw.Circle);

    const drawControl = new L.Control.Draw({
        edit: {
            featureGroup: drawnItems.value,
            edit: false,
            remove: false
        },
        draw: {
            polygon: true,
            polyline: true,
            marker: true,
            circle: false,
            rectangle: false,
        }
    });

    map.value.addControl(drawControl);
    

    map.value.on(L.Draw.Event.CREATED, (e) => {
        const layer = e.layer;
        const layerType = e.layerType;
        
        drawnItems.value.addLayer(layer);

        const geoJsonFeature = layer.toGeoJSON();
        let geometryType;

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

        const aoiData = {
            geometry: geoJsonFeature.geometry,
            geometryType: geometryType,
        };

        emit('aoi-drawn', aoiData);
    });
};

const loadExistingAOIs = (aois, shouldFitBounds = false) => {
    if (!savedAoisLayerGroup.value) return;

    savedAoisLayerGroup.value.clearLayers();

    if (!aois || aois.length === 0) return;

    const aoiLayers = aois.map(aoi => {
        const layer = L.geoJSON(aoi.geomGeoJson || aoi.geometry, {
            style: {
                color: props.isMonitorMode ? '#10b981' : '#f97316',
                weight: 3,
                opacity: 0.8,
                fillColor: props.isMonitorMode ? '#10b981' : '#f97316',
                fillOpacity: 0.3
            },
            onEachFeature: (feature, layer) => {
                layer.options.aoiDetails = aoi;
                
                layer.bindTooltip(`AOI: ${aoi.name} (${aoi.mappedAlgorithms?.length || 0} Algos)`, {
                    permanent: false,
                    direction: 'top'
                });

                if (props.isMonitorMode) {
                    layer.on('click', (e) => {
                        emit('aoi-clicked', aoi);
                        map.value.setView(e.latlng, map.value.getZoom());
                    });
                }
            }
        });
        return layer;
    });

    const combinedAoiLayer = L.featureGroup(aoiLayers).addTo(savedAoisLayerGroup.value);

    if (!shouldFitBounds) return;

    try {
        if (combinedAoiLayer.getLayers().length > 0) {
            const bounds = combinedAoiLayer.getBounds();

            if (bounds.isValid()) {
                map.value.fitBounds(bounds, { padding: [30, 30] });
            } else {
                const layers = combinedAoiLayer.getLayers();
                if (layers.length >= 1) {
                    const layer = layers[0];
                    if (layer.getLatLng) {
                        const center = L.Util.toLatLng(layer.getLatLng());
                        map.value.setView(center, 12);
                    } else {
                        map.value.setView([21.5937, 80.9629], 5);
                    }
                } else {
                    map.value.setView([21.5937, 80.9629], 5);
                }
            }
        }
    } catch (e) {
        console.warn("Could not fit bounds:", e);
        map.value.setView([21.5937, 80.9629], 5);
    }
};

const clearUnsavedLayer = () => {
    if (drawnItems.value) {
        drawnItems.value.clearLayers();
    }
};

defineExpose({
    clearUnsavedLayer,
    drawnItems,
    map
});


// onMounted(() => {
//     nextTick(initializeMap);
// });

onMounted(() => {
  nextTick(() => {
    initializeMap();

    setTimeout(() => {
        initializeMap();
            if (map.value) map.value.invalidateSize();
        }, 10);

    // CRITICAL FIX: Recalculate map whenever window resizes
    
  });
});

onBeforeUnmount(() => {
    if (map.value) {
        map.value.remove();
        map.value = null;
    }
});

watch(() => props.aoisToDisplay, (newAois) => {
    if (map.value && newAois) {
        loadExistingAOIs(newAois, false);
        initializeMap();
    }
}, { deep: true, immediate: true });

watch(() => props.aoisToDisplay?.length, (newLength, oldLength) => {
    if (map.value && newLength !== oldLength) {
        const shouldFit = newLength === 1 || (oldLength === 0 && newLength > 0);
        loadExistingAOIs(props.aoisToDisplay, shouldFit);
    }
});


</script>

<style scoped>


.map-view {
    min-height: 50vh;
    
}


:global(.leaflet-draw-toolbar a) {
    background-color: #ffffff !important;
    color: white !important;
}

:global(.leaflet-draw-toolbar a:hover) {
    background-color: #4b5563 !important;
}

:global(.leaflet-control-container) {
    z-index: 9 !important;
}

/* fullscreen container layout fix */
:global(.leaflet-container:fullscreen) {
    background: #000;
}

/* Chrome & Safari fullscreen */
:global(.leaflet-container:-webkit-full-screen) {
    background: #000;
}
</style>