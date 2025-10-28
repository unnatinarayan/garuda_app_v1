<!-- MapVisualization.vue -->

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
</style>







