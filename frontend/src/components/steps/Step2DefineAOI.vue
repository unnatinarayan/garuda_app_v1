<!-- frontend/src/components/steps/Step2DefineAOI.vue -->
<script setup>
import { ProjectFormData } from '@/classes/ProjectFormData.js';
import { AreaOfInterestDraft } from '@/classes/AreaOfInterestDraft.js';
import MapVisualization from '@/components/map/MapVisualization.vue';
import { ref, computed } from 'vue';

const props = defineProps({
    projectData: ProjectFormData,
});

// Reactive state for the modal/popup
const showAoiConfigModal = ref(false);
const currentAoiName = ref('');
const currentAoiBuffer = ref(null);
const currentAoiType = ref('');
const currentAoiGeometry = ref(null);
const currentAoiAuxData = ref([]);

// NEW: State for "Add More Fields" functionality
const showNewAuxFields = ref(false);
const newAuxKey = ref('');
const newAuxValue = ref('');

// Initialize counter based on existing drafts
let aoiCounter = props.projectData.aoiDrafts.length > 0
    ? Math.max(...props.projectData.aoiDrafts.map(a => a.clientAoiId)) + 1
    : 1;

// Computed properties
const requiresBuffer = computed(() => ['Point', 'LineString'].includes(currentAoiType.value));

const mapVizRef = ref(null);

// Handler when a geometry is drawn on the map
const handleAoiDrawn = (data) => {
    currentAoiGeometry.value = data.geometry;
    currentAoiType.value = data.geometry.type;
    currentAoiName.value = '';
    currentAoiBuffer.value = 0;
    currentAoiAuxData.value = [];
    showNewAuxFields.value = false;
    newAuxKey.value = '';
    newAuxValue.value = '';
    showAoiConfigModal.value = true;
};

// CRITICAL FIX: Properly cancel drawing
const cancelDrawing = () => {
    // Clear the temporary drawing from the map
    if (mapVizRef.value?.clearUnsavedLayer) {
        mapVizRef.value.clearUnsavedLayer();
    }
    
    // Reset modal state
    showAoiConfigModal.value = false;
    currentAoiGeometry.value = null;
    currentAoiName.value = '';
    currentAoiBuffer.value = null;
    currentAoiType.value = '';
    currentAoiAuxData.value = [];
    showNewAuxFields.value = false;
    newAuxKey.value = '';
    newAuxValue.value = '';
};

// NEW: Add auxiliary data field
const addAuxField = () => {
    if (!newAuxKey.value.trim()) {
        alert('Key cannot be empty.');
        return;
    }
    
    // Check for duplicate keys
    const isDuplicate = currentAoiAuxData.value.some(
        item => item.key.toLowerCase() === newAuxKey.value.trim().toLowerCase()
    );
    
    if (isDuplicate) {
        alert('This key already exists. Please use a different key.');
        return;
    }
    
    currentAoiAuxData.value.push({
        key: newAuxKey.value.trim(),
        value: newAuxValue.value.trim()
    });
    
    // Reset input fields
    newAuxKey.value = '';
    newAuxValue.value = '';
    showNewAuxFields.value = false;
};

// NEW: Remove auxiliary data field
const removeAuxField = (index) => {
    currentAoiAuxData.value.splice(index, 1);
};

// Finalize and save the AOI
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

    // Process AuxData
    const auxData = {};
    currentAoiAuxData.value.forEach(item => {
        if (item.key.trim() && item.value.trim()) {
            auxData[item.key.trim()] = item.value.trim();
        }
    });

    // Create new AOI draft
    const newAOI = new AreaOfInterestDraft(
        currentAoiName.value.trim(),
        currentAoiGeometry.value,
        aoiCounter,
        currentAoiType.value,
        finalBuffer
    );

    newAOI.geomProperties = {
        ...newAOI.geomProperties,
        auxData: Object.keys(auxData).length > 0 ? auxData : null
    };

    // Add to project data
    props.projectData.aoiDrafts.push(newAOI);

    // Clear the temporary drawing layer
    if (mapVizRef.value?.clearUnsavedLayer) {
        mapVizRef.value.clearUnsavedLayer();
    }

    if (mapVizRef.value?.map && mapVizRef.value.map.invalidateSize) {
    setTimeout(() => {
        mapVizRef.value.map.invalidateSize();
    }, 5);
}

    // Increment counter and reset
    aoiCounter++;
    showAoiConfigModal.value = false;
    currentAoiGeometry.value = null;
    currentAoiName.value = '';
    currentAoiBuffer.value = null;
    currentAoiType.value = '';
    currentAoiAuxData.value = [];
    showNewAuxFields.value = false;
    newAuxKey.value = '';
    newAuxValue.value = '';

    alert(`AOI draft "${newAOI.name}" saved. Draw a new AOI to continue.`);
};

// CRITICAL FIX: Remove AOI from the list
const removeAOI = (clientAoiId) => {
    const index = props.projectData.aoiDrafts.findIndex(
        aoi => aoi.clientAoiId === clientAoiId
    );
    
    if (index !== -1) {
        props.projectData.aoiDrafts.splice(index, 1);
    }
};
</script>

<template>
    <div>
        <div class="min-h-[50vh]">
            <MapVisualization 
                @aoi-drawn="handleAoiDrawn" 
                :aois-to-display="projectData.aoiDrafts"
                :is-monitor-mode="false" 
                ref="mapVizRef" 
            />
        </div>

        <h4 class="text-lg font-semibold mt-4 text-cyan-400">
            Draft AOIs ({{ projectData.aoiDrafts.length }})
        </h4>
        
        <div class="aoi-list-manager space-y-2 max-h-40 overflow-y-auto">
            <div v-for="aoi in projectData.aoiDrafts" 
                 :key="aoi.clientAoiId"
                 class="aoi-draft flex justify-between items-center p-3 bg-gray-700 rounded shadow-md">
                <span>
                    {{ aoi.name }}
                    <span :class="{ 'text-yellow-400': aoi.bufferDistance }" 
                          class="text-sm ml-2">
                        ({{ aoi.geometryType }})
                    </span>
                    <span v-if="aoi.bufferDistance" 
                          class="text-sm text-green-400 ml-2">
                        (+{{ aoi.bufferDistance }}m buffer)
                    </span>
                    <span v-if="aoi.geomProperties?.auxData" 
                          class="text-sm text-blue-400 ml-2">
                        ({{ Object.keys(aoi.geomProperties.auxData).length }} custom fields)
                    </span>
                </span>
                <button @click="removeAOI(aoi.clientAoiId)"
                        class="remove-btn bg-red-600 hover:bg-red-700 text-white p-1 rounded">
                    Remove
                </button>
            </div>
            <p v-if="projectData.aoiDrafts.length === 0" 
               class="text-center text-gray-400 p-4">
                Draw an AOI on the map above to begin.
            </p>
        </div>

        <!-- AOI Configuration Modal -->
        <div v-if="showAoiConfigModal"
             class="show-aoi-config-modal fixed inset-0 bg-black bg-opacity-70 z-[10000] flex justify-center items-center p-4">
            <div class="w-full max-w-md bg-gray-800 rounded-xl shadow-2xl p-6 text-white max-h-[90vh] overflow-y-auto">
                <h3 class="text-2xl font-bold mb-4 text-cyan-400">Configure AOI</h3>
                
                <div class="space-y-4">
                    <!-- AOI Name -->
                    <div class="form-group">
                        <label class="block text-gray-400 mb-1">AOI Name: <span class="text-red-400">*</span></label>
                        <input type="text" 
                               v-model="currentAoiName" 
                               placeholder="Enter a name" 
                               required
                               class="w-full p-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-cyan-400 focus:outline-none">
                    </div>

                    <!-- Buffer Distance (if required) -->
                    <div v-if="requiresBuffer" class="form-group">
                        <label class="block text-gray-400 mb-1">Buffer Distance (meters): <span class="text-red-400">*</span></label>
                        <input type="number" 
                               v-model.number="currentAoiBuffer" 
                               min="0" 
                               placeholder="0" 
                               required
                               class="w-full p-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-cyan-400 focus:outline-none">
                        <p class="text-xs text-gray-500 mt-1">Required for Point/Line geometries.</p>
                    </div>

                    <!-- Auxiliary Data Section -->
                    <div class="form-group">
                        <label class="block text-gray-400 mb-2">Custom Fields (Optional):</label>
                        
                        <!-- List of saved auxiliary fields -->
                        <div v-if="currentAoiAuxData.length > 0" class="space-y-2 mb-3">
                            <div v-for="(item, index) in currentAoiAuxData" 
                                 :key="index"
                                 class="flex items-center justify-between p-2 bg-gray-700 rounded border border-gray-600">
                                <div class="flex-grow mr-2">
                                    <span class="text-cyan-400 font-semibold text-sm">{{ item.key }}:</span>
                                    <span class="text-white text-sm ml-2">{{ item.value }}</span>
                                </div>
                                <button @click="removeAuxField(index)"
                                        class="text-red-400 hover:text-red-300 font-bold text-xl leading-none"
                                        title="Remove field">
                                    &times;
                                </button>
                            </div>
                        </div>

                        <!-- Add More Fields Button -->
                        <button 
                            @click="showNewAuxFields = true" 
                            v-if="!showNewAuxFields"
                            class="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition duration-200 w-full justify-center"
                        >
                            <svg class="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                            </svg>
                            Add More Fields
                        </button>

                        <!-- Input fields for new auxiliary data -->
                        <div v-if="showNewAuxFields" class="aux-data-entry p-3 bg-gray-700 rounded-lg border border-gray-600">
                            <div class="flex flex-col gap-2 mb-2">
                                <input 
                                    type="text" 
                                    v-model="newAuxKey" 
                                    placeholder="Key (e.g., Sensor Type)" 
                                    class="w-full p-2 bg-gray-600 text-white rounded border border-gray-500 focus:border-cyan-400 focus:outline-none text-sm"
                                />
                                <input 
                                    type="text" 
                                    v-model="newAuxValue" 
                                    placeholder="Value (e.g., Satellite)" 
                                    class="w-full p-2 bg-gray-600 text-white rounded border border-gray-500 focus:border-cyan-400 focus:outline-none text-sm"
                                />
                            </div>
                            
                            <div class="flex justify-end items-center gap-2">
                                <button 
                                    @click="showNewAuxFields = false; newAuxKey = ''; newAuxValue = '';" 
                                    class="text-red-400 hover:text-red-500 font-bold p-1 leading-none text-xl transition duration-150" 
                                    title="Cancel"
                                >
                                    &times;
                                </button>
                                
                                <button 
                                    @click="addAuxField" 
                                    class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition duration-150"
                                    title="Save this custom field"
                                >
                                    Save Field
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Modal Action Buttons -->
                <div class="mt-6 flex justify-end space-x-3">
                    <button @click="cancelDrawing"
                            class="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition duration-150">
                        Cancel
                    </button>
                    <button @click="finalizeAOI"
                            class="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg font-semibold transition duration-150">
                        Save AOI
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.aoi-draft {
    display: flex;
    justify-content: space-between;
    padding: 8px;
    border-bottom: 1px dotted #eee;
}

.remove-btn {
    background-color: #f44336;
    color: white;
    border: none;
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
}

@media (max-width: 640px) {
    .configure-project-ui {
        padding-top: 10px !important;
    }
    .w-full.max-w-6xl.mx-auto {
        padding-left: 10px;
        padding-right: 10px;
    }
}

:global(.show-aoi-config-modal) {
    z-index: 12000 !important;
}

/* Custom scrollbar for the modal */
.max-h-\[90vh\]::-webkit-scrollbar {
    width: 6px;
}

.max-h-\[90vh\]::-webkit-scrollbar-track {
    background: #1f2937;
}

.max-h-\[90vh\]::-webkit-scrollbar-thumb {
    background: #4b5563;
    border-radius: 3px;
}
</style>