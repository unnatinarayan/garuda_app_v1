<!-- MapVisualization.vue  -->

<template>
    <div class="map-container flex flex-col h-full bg-gray-900 rounded-xl shadow-inner">
        <!-- <div class="map-header bg-gray-700 p-2 sm:p-4 rounded-t-xl flex justify-between items-center">
            <h3 class="text-base sm:text-lg font-semibold text-white">Interactive Map: Draw Your Area of Interest</h3>             
            <span class="text-xs sm:text-sm text-gray-400" v-if="!props.isMonitorMode"></span>       
        </div> -->
        <div id="map" class="map-view flex-grow" ref="mapDiv"></div> 

        
        
        <div v-if="selectedAoiDetails && props.isMonitorMode" class="aoi-detail-panel absolute bottom-0 right-0 m-4 p-4 bg-gray-800 text-white rounded-xl w-64 shadow-2xl z-[10000]">
            <h4 class="font-bold text-cyan-400 mb-2">AOI Details</h4>
            <p><strong>Name:</strong> {{ selectedAoiDetails.name }}</p>
            <p><strong>ID:</strong> {{ selectedAoiDetails.aoi_id }}</p>
            <p><strong>Algorithms:</strong> {{ selectedAoiDetails.mappedAlgorithms.length }}</p>
            <p v-if="selectedAoiDetails.geom_properties?.buffer > 0"><strong>Buffer:</strong> {{ selectedAoiDetails.geom_properties.buffer }}m</p>
            <button @click="selectedAoiDetails = null" class="mt-3 text-red-400 text-sm hover:text-red-500">Close</button>
        </div>
    </div>
</template>

<script setup>
import { onMounted, ref, nextTick, watch } from 'vue';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import L from 'leaflet';
import 'leaflet-draw';
import 'leaflet.gridlayer.googlemutant'; // Keep this for satellite view

// REMOVED: import type { GeoJsonPolygon } from '@/classes/AreaOfInterestDraft';

const props = defineProps({
    // AOIs to load when viewing an existing project (Create/Update or Monitor)
    aoisToDisplay: Array, 
    isMonitorMode: Boolean, 
});

const emit = defineEmits(['aoi-drawn', 'aoi-clicked']);

// Reactive State
const map = ref(null);
const drawnItems = ref(null);

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

    map.value = L.map('map').setView([21.5937, 80.9629], 8);
    
    // Define Layers
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
        attribution: '© OpenStreetMap',
        maxZoom: 19 
    });
    const satelliteLayer = (L).gridLayer.googleMutant({ 
        type: 'hybrid', 
        attribution: 'Map data © Google',
        maxZoom: 20
    });
    
    const baseLayers = { 'OpenStreetMap': osmLayer, 'Satellite': satelliteLayer };
    
    // 1. Set OpenStreetMap as FIRST PRIORITY and default layer
    osmLayer.addTo(map.value);
    L.control.layers(baseLayers).addTo(map.value);

    drawnItems.value = new (L.FeatureGroup)();
    map.value.addLayer(drawnItems.value);
    
    if (!props.isMonitorMode) {
        setupDrawingControls();
    }
    
    // Add existing AOIs if available
    if (props.aoisToDisplay && props.aoisToDisplay.length > 0) {
        loadExistingAOIs(props.aoisToDisplay);
    } else {
        // Fit the world view if no AOIs are loaded
        map.value.setView([21.5937, 80.9629], 5);
    }
};

const setupDrawingControls = () => {
    safePatch(L.Draw.Polygon);
    safePatch(L.Draw.Polyline);
    safePatch(L.Draw.Marker);
    safePatch(L.Draw.Circle);

    const drawControl = new (L.Control).Draw({
        edit: {
            featureGroup: drawnItems.value,
            // Disable editing/deleting of previous AOIs in the context of creating a new one
            edit: false, 
            remove: false
        },
        draw: {
            polygon: true,
            polyline: true,  // Line
            marker: true,    // Point
            circle: false,   // Simplified: Treat circle as a specialized buffer of a point/polygon on the backend
            rectangle: false,
        }
    });
    map.value.addControl(drawControl);
    
    // Handle Drawing Events
    map.value.on((L.Draw).Event.DRAWSTART, (e) => {
        // Clear all previously drawn items to ensure only one is being defined at a time
        drawnItems.value.clearLayers(); 
        // requiresBufferInput.value = (e.layerType === 'marker' || e.layerType === 'polyline');
        // bufferDistance.value = null;
    });

    map.value.on((L.Draw).Event.CREATED, (e) => {
        let layer = e.layer;
        const layerType = e.layerType;

        drawnItems.value.addLayer(layer);
        
        // Convert to GeoJSON
        const geoJsonFeature = layer.toGeoJSON();
        let geometryType;
        
        // Normalize geometry type for backend consistency
        switch(layerType) {
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
            // CRITICAL FIX: Ensure GeoJSON object is cast correctly
            geometry: geoJsonFeature.geometry, 
            geometryType: geometryType,
            // buffer: buffer
        };

        emit('aoi-drawn', aoiData);
    });
};

// **NEW FUNCTIONALITY: Displaying Existing AOIs**
const loadExistingAOIs = (aois) => {
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
    
    // Zoom/pan the map to fit all loaded AOIs
    try {
        if (combinedAoiLayer.getLayers().length > 0) {
            map.value.fitBounds(combinedAoiLayer.getBounds(), { padding: [50, 50] });
        }
    } catch (e) {
        console.warn("Could not fit bounds of AOIs:", e);
    }
};


onMounted(() => {
    nextTick(initializeMap);
});

// Watch for changes in aoisToDisplay prop when used in Update/Monitor mode
watch(() => props.aoisToDisplay, (newAois) => {
    if (map.value && newAois && newAois.length > 0) {
        // Clear old layers before loading new ones
        drawnItems.value.clearLayers(); 
        loadExistingAOIs(newAois);
    }
}, { deep: true });

</script>

<style scoped>
.map-container {
    min-height: 50vw; /* Ensures the map div has a height */
}
.map-view {
    height: 100%;
}
@media (max-width: 1024px) {
    .map-container {
        height: 60vw; /* Smaller height for mobile screens */
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
