<!-- MapVisualization.vue - Fully Responsive with Buffer Preview -->

<template>
    <div class="map-container flex flex-col h-full bg-gray-900 rounded-lg shadow-inner relative">
        <div id="map" class="map-view flex-grow z-[60]" ref="mapDiv"></div>
        
        <!-- Fullscreen Toggle Button -->
        <button 
            v-if="!isFullscreen"
            @click="enterFullscreen"
            class="fullscreen-btn absolute top-4 right-4 z-[70] bg-gray-800 hover:bg-gray-700 text-white p-2 rounded-lg shadow-lg transition-all duration-200 flex items-center gap-2"
            title="Enter Fullscreen"
        >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path>
            </svg>
            <span class="text-sm font-medium">Fullscreen</span>
        </button>
        
        <!-- Exit Fullscreen Button -->
        <button 
            v-if="isFullscreen"
            @click="exitFullscreen"
            class="exit-fullscreen-btn fixed top-4 right-4 z-[10000] bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg shadow-lg transition-all duration-200 flex items-center gap-2"
            title="Exit Fullscreen"
        >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
            <span class="text-sm font-medium">Exit Fullscreen</span>
        </button>
    </div>
</template>

<script setup>
import { onMounted, ref, nextTick, watch, onBeforeUnmount } from 'vue';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import L from 'leaflet';
import 'leaflet-draw';

const props = defineProps({
    aoisToDisplay: Array,
    isMonitorMode: Boolean,
});

const emit = defineEmits(['aoi-drawn', 'aoi-clicked']);

const map = ref(null);
const drawnItems = ref(null);
const savedAoisLayerGroup = ref(null);
const bufferPreviewGroup = ref(null);
const mapDiv = ref(null);
const isFullscreen = ref(false);

const safePatch = (handler) => {
    if (handler && handler.prototype && !handler.prototype._fireCreatedEvent) {
        handler.prototype._fireCreatedEvent = function (layer) {
            this._map.fire(L.Draw.Event.CREATED, { layer: layer, layerType: this.type });
        };
    }
};

const enterFullscreen = () => {
    const container = mapDiv.value.parentElement;
    if (container.requestFullscreen) {
        container.requestFullscreen();
    } else if (container.webkitRequestFullscreen) {
        container.webkitRequestFullscreen();
    } else if (container.msRequestFullscreen) {
        container.msRequestFullscreen();
    }
};

const exitFullscreen = () => {
    if (document.exitFullscreen) {
        document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
    }
};

const handleFullscreenChange = () => {
    isFullscreen.value = !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
    
    if (map.value) {
        setTimeout(() => {
            map.value.invalidateSize();
        }, 100);
    }
};

const createBufferPreview = (layer, layerType) => {
    console.log('Creating buffer preview for:', layerType);
    
    // Clear existing buffer preview
    if (bufferPreviewGroup.value) {
        bufferPreviewGroup.value.clearLayers();
    }

    // Only create preview for Point and LineString
    if (layerType !== 'marker' && layerType !== 'polyline') {
        console.log('Not a marker or polyline, skipping buffer preview');
        return;
    }

    // Default buffer distance for preview (100 meters)
    const bufferDistance = 100;
    
    try {
        if (layerType === 'marker') {
            const latlng = layer.getLatLng();
            console.log('Creating circle buffer at:', latlng, 'with radius:', bufferDistance);
            
            // Create a visible circle with the buffer distance
            const circle = L.circle(latlng, {
                radius: bufferDistance,
                color: '#fbbf24',
                fillColor: '#fbbf24',
                fillOpacity: 0.3,
                weight: 3,
                dashArray: '10, 5',
                interactive: false,
                pane: 'overlayPane'
            });
            
            bufferPreviewGroup.value.addLayer(circle);
            
            // Add a popup to show it's working
            circle.bindPopup(`<strong>Buffer Preview</strong><br/>Radius: ${bufferDistance}m`);
            
            console.log('Circle buffer added to map');
            
        } else if (layerType === 'polyline') {
            const latlngs = layer.getLatLngs();
            console.log('Creating line buffer for points:', latlngs.length);
            
            // Simplified approach: Create circles at each vertex and connect them
            latlngs.forEach((latlng, index) => {
                const circle = L.circle(latlng, {
                    radius: bufferDistance,
                    color: '#fbbf24',
                    fillColor: '#fbbf24',
                    fillOpacity: 0.2,
                    weight: 3,
                    dashArray: '10, 5',
                    interactive: false,
                    pane: 'overlayPane'
                });
                
                bufferPreviewGroup.value.addLayer(circle);
            });
            
            // Add a thicker version of the line itself
            const thickLine = L.polyline(latlngs, {
                color: '#fbbf24',
                weight: 20,
                opacity: 0.3,
                interactive: false,
                pane: 'overlayPane'
            });
            
            bufferPreviewGroup.value.addLayer(thickLine);
            
            console.log('Line buffer added to map');
        }
        
        // Force map to update
        map.value.invalidateSize();
        
    } catch (error) {
        console.error('Error creating buffer preview:', error);
    }
};

const initializeMap = () => {
    if (!mapDiv.value) return;

    if (map.value) {
        map.value.remove();
        map.value = null;
    }

    map.value = L.map(mapDiv.value);

    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19
    });

    const baseLayers = { 'OpenStreetMap': osmLayer };
    osmLayer.addTo(map.value);
    L.control.layers(baseLayers).addTo(map.value);

    // Initialize layer groups in correct order (bottom to top)
    savedAoisLayerGroup.value = new L.FeatureGroup();
    map.value.addLayer(savedAoisLayerGroup.value);

    drawnItems.value = new L.FeatureGroup();
    map.value.addLayer(drawnItems.value);

    // Buffer preview on TOP so it's always visible
    bufferPreviewGroup.value = new L.FeatureGroup();
    bufferPreviewGroup.value.setZIndex(100000);
    map.value.addLayer(bufferPreviewGroup.value);

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

    // Clear preview when starting new drawing
    map.value.on('draw:drawstart', (e) => {
        console.log('Draw started');
        if (bufferPreviewGroup.value) {
            bufferPreviewGroup.value.clearLayers();
        }
    });

    // Handle completed drawing
    map.value.on(L.Draw.Event.CREATED, (e) => {
        const layer = e.layer;
        const layerType = e.layerType;
        
        console.log('Draw created:', layerType);
        
        // Add to drawn items first
        drawnItems.value.addLayer(layer);
        
        // Create buffer preview AFTER adding to map
        setTimeout(() => {
            createBufferPreview(layer, layerType);
        }, 100);

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
    // Also clear buffer preview
    if (bufferPreviewGroup.value) {
        bufferPreviewGroup.value.clearLayers();
    }
};

defineExpose({
    clearUnsavedLayer,
    drawnItems,
    map
});

onMounted(() => {
    nextTick(() => {
        initializeMap();

        setTimeout(() => {
            if (map.value) map.value.invalidateSize();
        }, 10);

        // Listen for fullscreen changes
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('msfullscreenchange', handleFullscreenChange);
    });
});

onBeforeUnmount(() => {
    // Remove fullscreen listeners
    document.removeEventListener('fullscreenchange', handleFullscreenChange);
    document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.removeEventListener('msfullscreenchange', handleFullscreenChange);
    
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

.fullscreen-btn,
.exit-fullscreen-btn {
    backdrop-filter: blur(10px);
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

/* Fullscreen container layout fix */
:global(.leaflet-container:fullscreen) {
    background: #000;
    width: 100vw !important;
    height: 100vh !important;
}

/* Chrome & Safari fullscreen */
:global(.leaflet-container:-webkit-full-screen) {
    background: #000;
    width: 100vw !important;
    height: 100vh !important;
}

/* Ensure map container takes full space in fullscreen */
:global(.map-container:fullscreen),
:global(.map-container:-webkit-full-screen) {
    width: 100vw !important;
    height: 100vh !important;
}

:global(.map-container:fullscreen .map-view),
:global(.map-container:-webkit-full-screen .map-view) {
    width: 100% !important;
    height: 100% !important;
    min-height: 100vh !important;
}

/* Enhanced visibility for buffer preview */
:global(.leaflet-overlay-pane svg) {
    z-index: 40000 !important;
}
</style>