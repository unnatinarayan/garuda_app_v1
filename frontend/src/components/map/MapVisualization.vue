<!-- MapVisualization.vue - Fully Responsive with Buffer Preview -->

<template>
    <div class="map-container flex flex-col h-full bg-gray-900 rounded-lg shadow-inner relative">
        <div id="map" class="map-view flex-grow z-[0]" ref="mapDiv"></div>

        <button v-if="!isFullscreen && !isMonitorMode" @click="enterFullscreen"
            class="fullscreen-btn absolute bottom-4 right-4 z-[70] bg-gray-800 hover:bg-gray-700 text-white p-2 rounded-lg shadow-lg transition-all duration-200 flex items-center gap-2"
            title="Enter Fullscreen">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4">
                </path>
            </svg>
            <span class="text-sm font-medium">Fullscreen</span>
        </button>

        <button v-if="isFullscreen && !isMonitorMode" @click="exitFullscreen"
            class="exit-fullscreen-btn fixed bottom-4 right-4 z-[10000] bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg shadow-lg transition-all duration-200 flex items-center gap-2"
            title="Exit Fullscreen">
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
import * as turf from '@turf/turf';

const props = defineProps({
    aoisToDisplay: Array,
    accumulatedGeometries: Array, // NEW: Display multi-polygon progress
    isMonitorMode: Boolean,
});

const emit = defineEmits(['aoi-drawn', 'aoi-clicked']);

const map = ref(null);
const drawnItems = ref(null);
const savedAoisLayerGroup = ref(null);
const accumulatedLayerGroup = ref(null); // NEW: Layer for accumulated geometries
const mapDiv = ref(null);
const isFullscreen = ref(false);
const drawControlRef = ref(null);

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

const initializeMap = () => {
    if (!mapDiv.value) return;

    if (map.value) {
        map.value.remove();
        map.value = null;
    }

    map.value = L.map(mapDiv.value, {
        attributionControl: false
    });

    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: false,
        maxZoom: 19
    });

    const baseLayers = { 'OpenStreetMap': osmLayer };
    osmLayer.addTo(map.value);
    L.control.layers(baseLayers).addTo(map.value);

    // Initialize layer groups (bottom to top)
    savedAoisLayerGroup.value = new L.FeatureGroup();
    map.value.addLayer(savedAoisLayerGroup.value);

    accumulatedLayerGroup.value = new L.FeatureGroup(); // NEW
    map.value.addLayer(accumulatedLayerGroup.value);

    drawnItems.value = new L.FeatureGroup();
    map.value.addLayer(drawnItems.value);



    if (!props.isMonitorMode) {
        setupDrawingControls();
    }

    if (props.aoisToDisplay && props.aoisToDisplay.length > 0) {
        loadExistingAOIs(props.aoisToDisplay, true);
        setTimeout(() => {
            if (map.value) map.value.invalidateSize();
        }, 50);
    } else {
        navigator.geolocation.getCurrentPosition(
            p =>
                map.value.setView([p.coords.latitude, p.coords.longitude], 10)
        );

        // map.value.setView([p.coords.latitude, p.coords.longitude], 5);
    }

    L.DomUtil.addClass(map.value.getPane('tilePane'), 'leaflet-pane-hardware-accel');
};

const setupDrawingControls = () => {
    safePatch(L.Draw.Polygon);
    safePatch(L.Draw.Polyline);
    safePatch(L.Draw.Marker);

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
            rectangle: false,
            circle: false,
            circlemarker: false
        }
    });
    drawControlRef.value = drawControl;
    map.value.addControl(drawControl);

    map.value.on(L.Draw.Event.DRAWSTOP, (e) => {
        // User cancelled drawing - do nothing
        initializeMap();
    });

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
            coordinates: geoJsonFeature.geometry.coordinates,
        };

        emit('aoi-drawn', aoiData);
    });
};

// NEW: Visualize accumulated geometries before finalization
const visualizeAccumulatedGeometries = () => {
    if (!accumulatedLayerGroup.value || !props.accumulatedGeometries) return;

    accumulatedLayerGroup.value.clearLayers();

    props.accumulatedGeometries.forEach((item, index) => {
        const layer = L.geoJSON(item.geometry, {
            style: {
                color: '#10b981', // Green for accumulated
                weight: 3,
                opacity: 0.9,
                fillColor: '#10b981',
                fillOpacity: 0.2,
                dashArray: '5, 10' // Dashed line to differentiate
            }
        });

        layer.bindTooltip(`Part ${index + 1}`, {
            permanent: true,
            direction: 'center',
            className: 'accumulated-tooltip'
        });

        layer.addTo(accumulatedLayerGroup.value);

        // Add buffer visualization if applicable
        if (item.bufferDistance && item.type !== 'Polygon') {
            if (item.type === 'Point') {
                const [lng, lat] = item.geometry.coordinates;
                L.circle([lat, lng], {
                    radius: item.bufferDistance,
                    color: '#00BFFF',
                    fillColor: '#3399ff',
                    fillOpacity: 0.15,
                    weight: 1,
                    dashArray: '3, 6'
                }).addTo(accumulatedLayerGroup.value);
            } else if (item.type === 'LineString') {
                const buffered = turf.buffer(item.geometry, item.bufferDistance, { units: 'meters' });
                L.geoJSON(buffered, {
                    style: {
                        color: '#00BFFF',
                        weight: 1,
                        fillColor: '#3399ff',
                        fillOpacity: 0.15,
                        dashArray: '3, 6'
                    }
                }).addTo(accumulatedLayerGroup.value);
            }
        }
    });
};
// MapVisualization.vue - Fixed loadExistingAOIs method

const loadExistingAOIs = (aois, shouldFitBounds = false) => {
    if (!savedAoisLayerGroup.value) return;

    savedAoisLayerGroup.value.clearLayers();

    if (!aois || aois.length === 0) return;

    const validAois = aois.filter(aoi => {
        // CRITICAL FIX: Validate geometry before rendering
        const geom = aoi.geomGeoJson || aoi.geometry;
        if (!geom) {
            console.warn(`AOI ${aoi.name} has no geometry, skipping`);
            return false;
        }

        // Validate geometry has coordinates
        if (geom.type === 'GeometryCollection') {
            if (!geom.geometries || geom.geometries.length === 0) {
                console.warn(`AOI ${aoi.name} has empty GeometryCollection, skipping`);
                return false;
            }
            // Check each geometry in collection
            return geom.geometries.every(g => {
                if (!g.coordinates || g.coordinates.length === 0) {
                    console.warn(`Invalid coordinates in GeometryCollection for ${aoi.name}`);
                    return false;
                }
                return true;
            });
        } else {
            if (!geom.coordinates || geom.coordinates.length === 0) {
                console.warn(`AOI ${aoi.name} has invalid coordinates, skipping`);
                return false;
            }
        }

        return true;
    });

    if (validAois.length === 0) {
        console.warn('No valid AOIs to display');
        return;
    }

    const aoiLayers = validAois.map(aoi => {
        try {
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

                    // FIXED: Handle buffer visualization with proper validation
                    if (aoi.geomProperties?.bufferConfig) {
                        aoi.geomProperties.bufferConfig.forEach((config, idx) => {
                            if (!config.buffer || config.type === 'Polygon') return;

                            try {
                                // Extract specific geometry from collection
                                const geom = aoi.geometry?.geometries
                                    ? aoi.geometry.geometries[idx]
                                    : aoi.geometry;

                                if (!geom || !geom.coordinates) {
                                    console.warn(`No valid geometry for buffer at index ${idx}`);
                                    return;
                                }

                                if (config.type === 'Point') {
                                    const [lng, lat] = geom.coordinates;
                                    if (typeof lng !== 'number' || typeof lat !== 'number') {
                                        console.warn(`Invalid Point coordinates for buffer: [${lng}, ${lat}]`);
                                        return;
                                    }
                                    L.circle([lat, lng], {
                                        radius: config.buffer,
                                        color: '#00BFFF',
                                        fillColor: '#3399ff',
                                        fillOpacity: 0.3,
                                        weight: 2,
                                        dashArray: '5, 5'
                                    }).addTo(savedAoisLayerGroup.value);
                                } else if (config.type === 'LineString') {
                                    const buffered = turf.buffer(geom, config.buffer, { units: 'meters' });
                                    L.geoJSON(buffered, {
                                        style: {
                                            color: '#00BFFF',
                                            weight: 2,
                                            fillColor: '#3399ff',
                                            fillOpacity: 0.3,
                                            dashArray: '5, 5'
                                        }
                                    }).addTo(savedAoisLayerGroup.value);
                                }
                            } catch (bufferError) {
                                console.warn(`Failed to create buffer for index ${idx}:`, bufferError);
                            }
                        });
                    } else if (aoi.geomProperties?.buffer && aoi.geomProperties?.originalType !== 'Polygon') {
                        // Handle single geometry buffer (legacy format)
                        try {
                            const geom = aoi.geomGeoJson || aoi.geometry;
                            const buffer = aoi.geomProperties.buffer;

                            if (aoi.geomProperties.originalType === 'Point') {
                                const [lng, lat] = geom.coordinates;
                                if (typeof lng === 'number' && typeof lat === 'number') {
                                    L.circle([lat, lng], {
                                        radius: buffer,
                                        color: '#00BFFF',
                                        fillColor: '#3399ff',
                                        fillOpacity: 0.3,
                                        weight: 2,
                                        dashArray: '5, 5'
                                    }).addTo(savedAoisLayerGroup.value);
                                }
                            } else if (aoi.geomProperties.originalType === 'LineString') {
                                const buffered = turf.buffer(geom, buffer, { units: 'meters' });
                                L.geoJSON(buffered, {
                                    style: {
                                        color: '#00BFFF',
                                        weight: 2,
                                        fillColor: '#3399ff',
                                        fillOpacity: 0.3,
                                        dashArray: '5, 5'
                                    }
                                }).addTo(savedAoisLayerGroup.value);
                            }
                        } catch (bufferError) {
                            console.warn(`Failed to create single buffer:`, bufferError);
                        }
                    }
                }
            });
            return layer;
        } catch (layerError) {
            console.error(`Failed to create layer for AOI ${aoi.name}:`, layerError);
            return null;
        }
    }).filter(layer => layer !== null);

    if (aoiLayers.length === 0) {
        console.warn('No valid layers created');
        return;
    }

    const combinedAoiLayer = L.featureGroup(aoiLayers).addTo(savedAoisLayerGroup.value);

    if (!shouldFitBounds) return;

    try {
        if (combinedAoiLayer.getLayers().length > 0) {
            const bounds = combinedAoiLayer.getBounds();
            if (bounds && bounds.isValid()) {
                map.value.fitBounds(bounds, { padding: [30, 30] });
            } else {
                console.warn('Invalid bounds, setting default view');
                map.value.setView([21.5937, 80.9629], 5);
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

const clearAccumulatedGeometries = () => {
    if (accumulatedLayerGroup.value) {
        accumulatedLayerGroup.value.clearLayers();
    }
};

defineExpose({
    clearUnsavedLayer,
    clearAccumulatedGeometries,
    drawnItems,
    map
});

onMounted(() => {
    nextTick(() => {
        initializeMap();
        setTimeout(() => {
            if (map.value) map.value.invalidateSize();
        }, 10);

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('msfullscreenchange', handleFullscreenChange);
    });
});

onBeforeUnmount(() => {
    document.removeEventListener('fullscreenchange', handleFullscreenChange);
    document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.removeEventListener('msfullscreenchange', handleFullscreenChange);

    if (map.value) {
        map.value.remove();
        map.value = null;
    }
});

// Watch accumulated geometries and visualize them
watch(() => props.accumulatedGeometries, () => {
    if (map.value) {
        visualizeAccumulatedGeometries();
    }
}, { deep: true, immediate: true });

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
:deep(.accumulated-tooltip) {
    background-color: #10b981;
    border: none;
    color: white;
    font-weight: bold;
    padding: 4px 8px;
    border-radius: 4px;
}

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
</style>