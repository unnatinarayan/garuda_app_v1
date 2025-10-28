<!-- MapVisualization.vue -->
<template>
    <div class="map-container flex flex-col h-full bg-gray-900 rounded-xl shadow-inner">
        <div class="map-header bg-gray-700 p-4 rounded-t-xl flex justify-between items-center">
            <h3 class="text-lg font-semibold text-white">Interactive Map: Draw Your Area of Interest</h3>
            <span class="text-sm text-gray-400" v-if="!props.isMonitorMode">Draw a Point, Line, or Polygon.</span>
        </div>
        <div id="map" class="map-view flex-grow" ref="mapDiv"></div> <div v-if="requiresBufferInput && !props.isMonitorMode" class="buffer-control bg-gray-700 p-3 flex items-center justify-center space-x-3 border-t border-gray-600">
            <label for="buffer" class="text-gray-300 font-medium">Buffer Distance (meters):</label>
            <input 
                type="number" id="buffer" 
                v-model.number="bufferDistance" 
                min="0" placeholder="0" 
                class="p-1 w-24 bg-gray-600 text-white rounded border border-gray-500"
            >
        </div>
        
        <div v-if="selectedAoiDetails && props.isMonitorMode" class="aoi-detail-panel absolute bottom-0 right-0 m-4 p-4 bg-gray-800 text-white rounded-xl w-64 shadow-2xl z-[1000]">
            <h4 class="font-bold text-cyan-400 mb-2">AOI Details</h4>
            <p><strong>Name:</strong> {{ selectedAoiDetails.name }}</p>
            <p><strong>ID:</strong> {{ selectedAoiDetails.aoi_id }}</p>
            <p><strong>Algorithms:</strong> {{ selectedAoiDetails.mappedAlgorithms.length }}</p>
            <p v-if="selectedAoiDetails.geom_properties?.buffer > 0"><strong>Buffer:</strong> {{ selectedAoiDetails.geom_properties.buffer }}m</p>
            <button @click="selectedAoiDetails = null" class="mt-3 text-red-400 text-sm hover:text-red-500">Close</button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref, nextTick, watch } from 'vue';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import L from 'leaflet';
import 'leaflet-draw';
import 'leaflet.gridlayer.googlemutant'; // Keep this for satellite view

// Import the required GeoJSON type for clarity
import type { GeoJsonPolygon } from '@/classes/AreaOfInterestDraft';

const props = defineProps<{
    // AOIs to load when viewing an existing project (Create/Update or Monitor)
    aoisToDisplay?: any[]; 
    isMonitorMode?: boolean; 
}>();

const emit = defineEmits(['aoi-drawn']);

// Reactive State
const map = ref<L.Map | null>(null);
const drawnItems = ref<L.FeatureGroup | null>(null);
const bufferDistance = ref<number | null>(null);
const requiresBufferInput = ref(false);
const selectedAoiDetails = ref<any>(null); // State for responsive detail display

// Utility function to patch Leaflet Draw
const safePatch = (handler: any) => {
    if (handler && handler.prototype && !handler.prototype._fireCreatedEvent) {
        handler.prototype._fireCreatedEvent = function (layer: L.Layer) {
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

    map.value = L.map('map').setView([21.5937, 80.9629], 5);
    
    // Define Layers
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
        attribution: '© OpenStreetMap',
        maxZoom: 19 
    });
    const satelliteLayer = (L as any).gridLayer.googleMutant({ 
        type: 'hybrid', 
        attribution: 'Map data © Google',
        maxZoom: 20
    });
    
    const baseLayers = { 'OpenStreetMap': osmLayer, 'Satellite': satelliteLayer };
    
    // 1. Set OpenStreetMap as FIRST PRIORITY and default layer
    osmLayer.addTo(map.value!);
    L.control.layers(baseLayers).addTo(map.value!);

    drawnItems.value = new (L.FeatureGroup as any)();
    map.value!.addLayer(drawnItems.value);
    
    if (!props.isMonitorMode) {
        setupDrawingControls();
    }
    
    // Add existing AOIs if available
    if (props.aoisToDisplay && props.aoisToDisplay.length > 0) {
        loadExistingAOIs(props.aoisToDisplay);
    } else {
        // Fit the world view if no AOIs are loaded
        map.value!.setView([21.5937, 80.9629], 5);
    }
};

const setupDrawingControls = () => {
    safePatch(L.Draw.Polygon);
    safePatch(L.Draw.Polyline);
    safePatch(L.Draw.Marker);
    safePatch(L.Draw.Circle); // Keep circle just in case

    const drawControl = new (L.Control as any).Draw({
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
    map.value!.addControl(drawControl);
    
    // Handle Drawing Events
    map.value!.on((L.Draw as any).Event.DRAWSTART, (e: any) => {
        // Clear all previously drawn items to ensure only one is being defined at a time
        drawnItems.value!.clearLayers(); 
        requiresBufferInput.value = (e.layerType === 'marker' || e.layerType === 'polyline');
        bufferDistance.value = null;
    });

    map.value!.on((L.Draw as any).Event.CREATED, (e: any) => {
        let layer = e.layer;
        const layerType = e.layerType;

        drawnItems.value!.addLayer(layer);
        
        // Convert to GeoJSON
        const geoJsonFeature = layer.toGeoJSON();
        let geometryType: 'Point' | 'LineString' | 'Polygon';
        
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
        const buffer = requiresBufferInput.value ? bufferDistance.value || 0 : 0;
        
        const aoiData = {
            // CRITICAL FIX: Ensure GeoJSON object is cast correctly
            geometry: geoJsonFeature.geometry as GeoJsonPolygon, 
            geometryType: geometryType,
            buffer: buffer
        };

        emit('aoi-drawn', aoiData);
    });
};

// **NEW FUNCTIONALITY: Displaying Existing AOIs**
const loadExistingAOIs = (aois: any[]) => {
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
                        selectedAoiDetails.value = aoi;
                        // Center map on the clicked feature
                        map.value!.setView(e.latlng, map.value!.getZoom());
                    });
                }
            }
        });
        return layer;
    });
    
    // Add all AOI layers to the map
    const combinedAoiLayer = L.featureGroup(aoiLayers).addTo(drawnItems.value!);
    
    // Zoom/pan the map to fit all loaded AOIs
    try {
        if (combinedAoiLayer.getLayers().length > 0) {
            map.value!.fitBounds(combinedAoiLayer.getBounds(), { padding: [50, 50] });
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
        drawnItems.value!.clearLayers(); 
        loadExistingAOIs(newAois);
    }
}, { deep: true });

</script>

<style scoped>
.map-container {
    height: 400px; /* Ensures the map div has a height */
}
.map-view {
    height: 100%;
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
























































































<!-- 
<template>
    <div class="map-container">
        <div class="map-header bg-gray-700 p-4 rounded-t-xl">
            <h3 class="text-lg font-semibold text-white">Interactive Map: Draw Your Area of Interest</h3>
            <p class="text-sm text-gray-400">Draw a Polygon, Point, or Line. Use the tools on the left.</p>
        </div>
        <div id="map" class="map-view"></div>

        <div v-if="requiresBufferInput" class="buffer-control bg-gray-700 p-3 flex items-center justify-center space-x-3 border-t border-gray-600">
            <label for="buffer" class="text-gray-300 font-medium">Buffer Distance (meters):</label>
            <input type="number" id="buffer" v-model.number="bufferDistance" min="0" placeholder="0" class="p-1 w-24 bg-gray-600 text-white rounded border border-gray-500">
        </div>
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref, nextTick } from 'vue';
import 'leaflet/dist/leaflet.css';
 
import 'leaflet-draw/dist/leaflet.draw.css';

// Ensure you have run: npm install leaflet leaflet-draw leaflet-geometryutil leaflet.gridlayer.googlemutant
import L from 'leaflet';
import 'leaflet-draw';
import 'leaflet-geometryutil'; 
import 'leaflet.gridlayer.googlemutant'; 

const emit = defineEmits(['aoi-drawn']);

// Reactive State
const map = ref<L.Map | null>(null);
const drawnItems = ref<L.FeatureGroup | null>(null);
const bufferDistance = ref<number | null>(null);
const requiresBufferInput = ref(false); 

// Utility function to patch Leaflet Draw (your original code included this, good practice!)
const safePatch = (handler: any) => {
    if (handler && handler.prototype && !handler.prototype._fireCreatedEvent) {
        handler.prototype._fireCreatedEvent = function (layer: L.Layer) {
            this._map.fire(L.Draw.Event.CREATED, { layer: layer, layerType: this.type });
        };
    }
};

onMounted(() => {
    // CRITICAL: Ensure the DOM element is ready and visible before initializing Leaflet
    nextTick(() => {
        // 1. Initialize Map
        if (!document.getElementById('map')) return;

        map.value = L.map('map').setView([21.5937, 80.9629], 5);
        
        const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' });
        // NOTE: Google Mutant requires API key in production, but we use it for visual realism
        const satelliteLayer = (L as any).gridLayer.googleMutant({ type: 'hybrid', attribution: 'Map data © Google' });
        
        const baseLayers = { 'OpenStreetMap': osmLayer, 'Satellite': satelliteLayer };
        L.control.layers(baseLayers).addTo(map.value!);
        osmLayer.addTo(map.value!);
        
        // 2. Setup Drawing Control
        safePatch(L.Draw.Polygon);
        safePatch(L.Draw.Rectangle);
        safePatch(L.Draw.Circle);

        drawnItems.value = new (L.FeatureGroup as any)();
        map.value!.addLayer(drawnItems.value);
        
        const drawControl = new (L.Control as any).Draw({
            draw: {
                polygon: true,
                rectangle: false, // Rectangle creates a polygon, simplify drawing options
                circle: false,    // Circle creates a polygon via calculation, but less common
                polyline: true,   // Enable Line
                marker: true      // Enable Point
            },
            edit: {
                featureGroup: drawnItems.value
            }
        });
        map.value!.addControl(drawControl);
        
        // 3. Handle Drawing Events
        map.value!.on((L.Draw as any).Event.DRAWSTART, (e: any) => {
            drawnItems.value!.clearLayers();
            requiresBufferInput.value = (e.layerType === 'marker' || e.layerType === 'polyline');
            bufferDistance.value = null;
        });

        map.value!.on((L.Draw as any).Event.CREATED, (e: any) => {
            let layer = e.layer;
            const layerType = e.layerType;

            // Handle Circle/Rectangle/Polygon normalization (similar to your provided logic)
            if (layer instanceof L.Circle) {
                // Convert circle to polygon here if needed, but for simplicity, we treat it as a polygon buffer case.
            }
            
            drawnItems.value!.addLayer(layer);
            
            // 4. Convert to GeoJSON and Emit
            const geoJsonFeature = layer.toGeoJSON();
            
            // Final object to emit
            const aoiData = {
                geometry: geoJsonFeature.geometry,
                geometryType: layerType === 'marker' ? 'Point' : (layerType === 'polyline' ? 'LineString' : 'Polygon'),
                buffer: bufferDistance.value || 0
            };

            // Emit the data, allowing the parent (Step 2) to save the draft
            emit('aoi-drawn', aoiData);
        });
    });
});
</script>

<style scoped>
.map-container { position: relative; height: 500px; width: 100%; margin-bottom: 20px; border-radius: 12px; overflow: hidden; background-color: #2c3e50; }
.map-view { height: 100%; width: 100%; }
.buffer-control { position: absolute; bottom: 0; left: 0; z-index: 1000; width: 100%; }
.map-header { z-index: 1000; position: absolute; top: 0; left: 0; width: 100%; }

/* Ensure Leaflet draw controls are visible and work correctly in the dark theme */
:global(.leaflet-draw-toolbar, .leaflet-draw-actions) {
    background-color: #374151 !important;
    border-radius: 4px;
}
:global(.leaflet-control-zoom, .leaflet-control-layers) { 
    background-color: #374151 !important; 
    border-color: #1f2937 !important; 
}
:global(.leaflet-draw-toolbar a) {
    color: #fff !important;
}
</style> -->







