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
const currentAoiAuxData = ref([{ key: '', value: '' }]);

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
    currentAoiAuxData.value = [{ key: '', value: '' }];
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
    currentAoiAuxData.value = [{ key: '', value: '' }];
};

const addAuxField = () => {
    currentAoiAuxData.value.push({ key: '', value: '' });
};

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

    // Increment counter and reset
    aoiCounter++;
    showAoiConfigModal.value = false;
    currentAoiGeometry.value = null;
    currentAoiName.value = '';
    currentAoiBuffer.value = null;
    currentAoiType.value = '';
    currentAoiAuxData.value = [{ key: '', value: '' }];

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

<template >
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
             class="fixed inset-0 bg-black bg-opacity-70 z-[10000] flex justify-center items-center p-4">
            <div class="w-full max-w-md bg-gray-800 rounded-xl shadow-2xl p-6 text-white">
                <h3 class="text-2xl font-bold mb-4 text-cyan-400">Configure AOI</h3>
                
                <div class="space-y-4">
                    <div class="form-group">
                        <label class="block text-gray-400 mb-1">AOI Name:</label>
                        <input type="text" 
                               v-model="currentAoiName" 
                               placeholder="Enter a name" 
                               required
                               class="w-full p-2 bg-gray-700 text-white rounded border border-gray-600">
                    </div>

                    <div v-if="requiresBuffer" class="form-group">
                        <label class="block text-gray-400 mb-1">Buffer Distance (meters):</label>
                        <input type="number" 
                               v-model.number="currentAoiBuffer" 
                               min="0" 
                               placeholder="0" 
                               required
                               class="w-full p-2 bg-gray-700 text-white rounded border border-gray-600">
                        <p class="text-xs text-gray-500 mt-1">Required for Point/Line geometries.</p>
                    </div>

                    
                    
                    
                    
                </div>

                <div class="mt-6 flex justify-end space-x-3">
                    <button @click="cancelDrawing"
                            class="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg">
                        Cancel
                    </button>
                    <button @click="finalizeAOI"
                            class="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg font-semibold">
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
</style>