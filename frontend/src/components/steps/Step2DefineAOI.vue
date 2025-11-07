<!-- Step2DefineAOI.vue  -->

<script setup>
import { ProjectFormData } from '@/classes/ProjectFormData.js';
import { AreaOfInterestDraft } from '@/classes/AreaOfInterestDraft.js';
import MapVisualization from '@/components/map/MapVisualization.vue';
import { ref, watch, computed, nextTick } from 'vue';

const props = defineProps({
  projectData: ProjectFormData,
});


// Reactive state for the new modal/popup functionality
const showAoiConfigModal = ref(false);
const currentAoiName = ref('');
const currentAoiBuffer = ref(null); // Buffer distance (0 for default, null/0 for none/polygon)
const currentAoiType = ref('');
const currentAoiGeometry = ref(null);
const currentAoiAuxData = ref([{ key: '', value: '' }]); // Auxiliary data fields

// const currentAoiName = ref('');
// Initialize counter based on existing drafts (important for update mode)
let aoiCounter = props.projectData.aoiDrafts.length > 0 
                 ? Math.max(...props.projectData.aoiDrafts.map(a => a.clientAoiId)) + 1 
                 : 1;

// Computed properties for UI logic
const requiresBuffer = computed(() => ['Point', 'LineString'].includes(currentAoiType.value));
const mapVizRef = ref(null);

// The main method called by the MapVisualization component when a geometry is drawn
const handleAoiDrawn = (data) => {
    // 1. Store the raw geometry and type
    currentAoiGeometry.value = data.geometry;
    currentAoiType.value = data.geometry.type; 

    // 2. Reset name/buffer/auxdata fields
    currentAoiName.value = ''; 
    currentAoiBuffer.value = 0; // Default to 0
    currentAoiAuxData.value = [{ key: '', value: '' }];

    // 3. Open the configuration popup
    showAoiConfigModal.value = true;
};

// Adds a new row for auxiliary data in the modal
const addAuxField = () => {
    currentAoiAuxData.value.push({ key: '', value: '' });
};

// Removes an auxiliary data row from the modal
const removeAuxField = (index) => {
    currentAoiAuxData.value.splice(index, 1);
};


// Function to finalize AOI after form submission
const finalizeAOI = async () => {
    if (!currentAoiName.value.trim()) {
        alert('AOI Name is required.');
        return;
    }
    if (!currentAoiGeometry.value) {
        alert('Geometry is missing.');
        return;
    }
    
    const finalBuffer = requiresBuffer.value ? Number(currentAoiBuffer.value) : null;
    
    // Process AuxData into an object for the draft class
    const auxData = {};
    currentAoiAuxData.value.forEach(item => {
        if (item.key.trim() && item.value.trim()) {
            auxData[item.key.trim()] = item.value.trim();
        }
    });

    // 1. Instantiate the AreaOfInterestDraft class
    const newAOI = new AreaOfInterestDraft(
        currentAoiName.value.trim(),
        currentAoiGeometry.value,
        aoiCounter,
        currentAoiType.value,
        finalBuffer
    );
    // 2. Set the auxdata on the draft instance (for backend bundle to pick up)
    newAOI.geomProperties = {
        ...newAOI.geomProperties, // Keep existing properties (originalType, buffer)
        auxData: Object.keys(auxData).length > 0 ? auxData : null // Add the custom auxdata
    }; 
    
    // 3. Add to the ProjectFormData
    props.projectData.aoiDrafts.push(newAOI);

    if (mapVizRef.value?.drawnItems) {
        // Clear all layers managed by Leaflet.Draw's internal FeatureGroup
        mapVizRef.value.drawnItems.clearLayers();
    }
    
    // 4. Clean up and close
    aoiCounter++;
    showAoiConfigModal.value = false;
    currentAoiGeometry.value = null;
    alert(`AOI draft "${newAOI.name}" saved. Draw a new AOI to continue.`);
};

const removeAOI = (clientAoiId) => {
    props.projectData.aoiDrafts = props.projectData.aoiDrafts.filter(
        aoi => aoi.clientAoiId !== clientAoiId
    );
};



</script>


<template>
    <div>
        
        <div>
            <MapVisualization 
                @aoi-drawn="handleAoiDrawn" 
                :aois-to-display="projectData.aoiDrafts"
                :is-monitor-mode="false"
                ref="mapVizRef"
            />
            <!-- <MapVisualization 
                @aoi-drawn="handleAoiDrawn" 
                :aois-to-display="projectData.aoiDrafts"
                :is-monitor-mode="false"
            /> -->
        </div>

        <h4 class="text-lg font-semibold mt-4 text-cyan-400">Draft AOIs ({{ projectData.aoiDrafts.length }})</h4>
        <div class="aoi-list-manager space-y-2 max-h-40 overflow-y-auto">
            <div v-for="aoi in projectData.aoiDrafts" :key="aoi.clientAoiId" class="aoi-draft flex justify-between items-center p-3 bg-gray-700 rounded shadow-md">
                <span>
                    {{ aoi.name }} 
                    <span :class="{'text-yellow-400': aoi.bufferDistance}" class="text-sm ml-2">({{ aoi.geometryType }})</span>
                    <span v-if="aoi.bufferDistance" class="text-sm text-green-400 ml-2"> (+{{ aoi.bufferDistance }}m buffer)</span>
                </span>
                <button @click="removeAOI(aoi.clientAoiId)" class="remove-btn bg-red-600 hover:bg-red-700 text-white p-1 rounded">Remove</button>
            </div>
            <p v-if="projectData.aoiDrafts.length === 0" class="text-center text-gray-400 p-4">Draw an AOI on the map above to begin.</p>
        </div>

        <div v-if="showAoiConfigModal" class="fixed inset-0 bg-black bg-opacity-70 z-[10000] flex justify-center items-center p-4">
            <div class="w-full max-w-md bg-gray-800 rounded-xl shadow-2xl p-6 text-white">
                <h3 class="text-2xl font-bold mb-4 text-cyan-400">Configure AOI</h3>
                <p class="mb-4 text-gray-400">Geometry Type: <span class="font-semibold">{{ currentAoiType }}</span>. Enter details to save this AOI.</p>
                
                <div class="space-y-4">
                    <div class="form-group">
                        <label class="block text-gray-400 mb-1">AOI Name:</label>
                        <input type="text" v-model="currentAoiName" placeholder="Enter a unique name" required class="w-full p-2 bg-gray-700 text-white rounded border border-gray-600">
                    </div>

                    <div v-if="requiresBuffer" class="form-group">
                        <label class="block text-gray-400 mb-1">Buffer Distance (meters):</label>
                        <input type="number" v-model.number="currentAoiBuffer" min="0" placeholder="0" required class="w-full p-2 bg-gray-700 text-white rounded border border-gray-600">
                        <p class="text-xs text-gray-500 mt-1">Required for Point/Line geometries.</p>
                    </div>

                    

                    <h4 class="text-lg font-semibold mt-4 mb-2 text-cyan-400"></h4>
                    <div class="space-y-2 max-h-40 overflow-y-auto pr-1">
                        <div v-for="(field, index) in currentAoiAuxData" :key="index" class="flex gap-2">
                            <input type="text" v-model="field.key" placeholder="Key" class="w-1/3 p-2 bg-gray-700 text-white rounded border border-gray-600 text-sm">
                            <input type="text" v-model="field.value" placeholder="Value" class="w-2/3 p-2 bg-gray-700 text-white rounded border border-gray-600 text-sm">
                            <button @click="removeAuxField(index)" class="text-red-400 hover:text-red-500 font-bold px-2" :disabled="currentAoiAuxData.length === 1">&times;</button>
                        </div>
                    </div>
                    <button @click="addAuxField" class="text-blue-400 hover:text-blue-300 text-sm mt-2 flex items-center">
                        <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                        Add More fields
                    </button>
                </div>

                <div class="mt-6 flex justify-end space-x-3">
                    <button @click="showAoiConfigModal = false" class="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg">Cancel</button>
                    <button @click="finalizeAOI" class="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg font-semibold">Save AOI</button>
                </div>
            </div>
        </div>

    </div>
</template>



<style scoped>
/* .map-container { height: 400px; width: 100%; margin-bottom: 20px; border: 1px solid #ccc; } */
.aoi-draft { display: flex; justify-content: space-between; padding: 8px; border-bottom: 1px dotted #eee; }
.remove-btn { background-color: #f44336; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; }
@media (max-width: 640px) {
    .configure-project-ui { padding-top: 10px !important; }
    .w-full.max-w-6xl.mx-auto { padding-left: 10px; padding-right: 10px; }
}
</style>
