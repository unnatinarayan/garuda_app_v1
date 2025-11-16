<!-- frontend/src/components/steps/Step2DefineAOI.vue -->
<script setup>
import { ProjectFormData } from '@/classes/ProjectFormData.js';
import { AreaOfInterestDraft } from '@/classes/AreaOfInterestDraft.js';
import MapVisualization from '@/components/map/MapVisualization.vue';
import { ref, computed, onMounted } from 'vue';
import { useMessageStore } from '@/stores/MessageStore.js';
const messageStore = useMessageStore();

const props = defineProps({
    projectData: ProjectFormData,
});

// ==================== Multi-Polygon State ====================
const accumulatedGeometries = ref([]);
const showDecisionModal = ref(false);
const showNameModal = ref(false);

// Modal state
const currentAoiName = ref('');
const currentAoiBuffer = ref(100);
const currentAoiType = ref('');
const currentAoiGeometry = ref(null);
const currentAoiAuxData = ref([]);
const showNewAuxFields = ref(false);
const newAuxKey = ref('');
const newAuxValue = ref('');

// CRITICAL FIX: Initialize counter based on ALL AOIs (including deleted ones)
const aoiCounter = ref(1);

onMounted(() => {
    // Calculate the highest AOI counter value from existing drafts
    // This includes both active and soft-deleted AOIs
    if (props.projectData.aoiDrafts.length > 0) {
        const maxId = Math.max(...props.projectData.aoiDrafts.map(a => a.clientAoiId));
        aoiCounter.value = maxId + 1;
        console.log(`[Step2] Initialized AOI counter to ${aoiCounter.value} (max existing: ${maxId})`);
    }
});

const mapVizRef = ref(null);

// ==================== Decision Modal Logic ====================
const handleAoiDrawn = (data) => {
    currentAoiGeometry.value = data.geometry;
    currentAoiType.value = data.geometry.type;
    currentAoiBuffer.value = 100;
    
    showDecisionModal.value = true;
};

const continueDrawing = () => {
    const requiresBuffer = ['Point', 'LineString'].includes(currentAoiType.value);
    const bufferValue = requiresBuffer ? Number(currentAoiBuffer.value) : null;

    accumulatedGeometries.value.push({
        geometry: currentAoiGeometry.value,
        type: currentAoiType.value,
        bufferDistance: bufferValue
    });

    if (mapVizRef.value?.clearUnsavedLayer) {
        mapVizRef.value.clearUnsavedLayer();
    }

    showDecisionModal.value = false;
    currentAoiGeometry.value = null;
    currentAoiBuffer.value = 100;
    currentAoiType.value = '';

    messageStore.showMessage(
        `Polygon added (${accumulatedGeometries.value.length} total). Draw next polygon.`,
        "info"
    );
};

const proceedToNaming = () => {
    const requiresBuffer = ['Point', 'LineString'].includes(currentAoiType.value);
    const bufferValue = requiresBuffer ? Number(currentAoiBuffer.value) : null;

    accumulatedGeometries.value.push({
        geometry: currentAoiGeometry.value,
        type: currentAoiType.value,
        bufferDistance: bufferValue
    });

    showDecisionModal.value = false;
    showNameModal.value = true;
    currentAoiName.value = '';
    currentAoiAuxData.value = [];
};

// ==================== Finalize Multi-Polygon AOI ====================
const finalizeAOI = async () => {
    if (!currentAoiName.value.trim()) {
        messageStore.showMessage("AOI Name is required.", "error");
        return;
    }

    if (accumulatedGeometries.value.length === 0) {
        messageStore.showMessage("No geometries drawn.", "error");
        return;
    }

    const auxData = {};
    currentAoiAuxData.value.forEach(item => {
        if (item.key.trim() && item.value.trim()) {
            auxData[item.key.trim()] = item.value.trim();
        }
    });

    let finalGeometry;
    let finalGeometryType;

    if (accumulatedGeometries.value.length === 1) {
        finalGeometry = accumulatedGeometries.value[0].geometry;
        finalGeometryType = accumulatedGeometries.value[0].type;
    } else {
        finalGeometry = {
            type: 'GeometryCollection',
            geometries: accumulatedGeometries.value.map(g => g.geometry)
        };
        finalGeometryType = 'GeometryCollection';
    }

    const bufferConfig = accumulatedGeometries.value.map((g, idx) => ({
        index: idx,
        type: g.type,
        buffer: g.bufferDistance
    }));

    // CRITICAL FIX: Use and increment the counter
    const newClientAoiId = aoiCounter.value;
    console.log(`[Step2] Creating new AOI with clientAoiId: ${newClientAoiId}`);

    const newAOI = new AreaOfInterestDraft(
        currentAoiName.value.trim(),
        finalGeometry,
        newClientAoiId, // Use the counter
        finalGeometryType,
        null
    );

    newAOI.geomProperties = {
        ...newAOI.geomProperties,
        auxData: Object.keys(auxData).length > 0 ? auxData : null,
        bufferConfig: bufferConfig,
        geometryCount: accumulatedGeometries.value.length
    };

    props.projectData.aoiDrafts.push(newAOI);

    // CRITICAL FIX: Increment counter AFTER creating AOI
    aoiCounter.value++;

    if (mapVizRef.value?.clearUnsavedLayer) {
        mapVizRef.value.clearUnsavedLayer();
    }
    if (mapVizRef.value?.clearAccumulatedGeometries) {
        mapVizRef.value.clearAccumulatedGeometries();
    }

    accumulatedGeometries.value = [];
    showNameModal.value = false;
    currentAoiName.value = '';
    currentAoiAuxData.value = [];
    showNewAuxFields.value = false;
    newAuxKey.value = '';
    newAuxValue.value = '';

    messageStore.showMessage(
        `AOI "${newAOI.name}" saved with ${bufferConfig.length} polygon(s).`,
        "success"
    );
};

// ==================== Cancel Operations ====================
const cancelDecision = () => {
    if (mapVizRef.value?.clearUnsavedLayer) {
        mapVizRef.value.clearUnsavedLayer();
    }
    showDecisionModal.value = false;
    currentAoiGeometry.value = null;
    currentAoiBuffer.value = 100;
    currentAoiType.value = '';
};

const cancelNaming = () => {
    accumulatedGeometries.value = [];
    if (mapVizRef.value?.clearAccumulatedGeometries) {
        mapVizRef.value.clearAccumulatedGeometries();
    }
    showNameModal.value = false;
    currentAoiName.value = '';
    currentAoiAuxData.value = [];
};

// ==================== Auxiliary Data Functions ====================
const addAuxField = () => {
    if (!newAuxKey.value.trim()) {
        messageStore.showMessage("Key cannot be empty.", "error");
        return;
    }

    const isDuplicate = currentAoiAuxData.value.some(
        item => item.key.toLowerCase() === newAuxKey.value.trim().toLowerCase()
    );

    if (isDuplicate) {
        messageStore.showMessage("This key already exists.", "error");
        return;
    }

    currentAoiAuxData.value.push({
        key: newAuxKey.value.trim(),
        value: newAuxValue.value.trim()
    });

    newAuxKey.value = '';
    newAuxValue.value = '';
    showNewAuxFields.value = false;
};

const removeAuxField = (index) => {
    currentAoiAuxData.value.splice(index, 1);
};

// ==================== Remove AOI ====================
const removeAOI = (clientAoiId) => {
    const aoi = props.projectData.aoiDrafts.find(a => a.clientAoiId === clientAoiId);
    
    if (aoi) {
        if (aoi.dbId) {
            // CRITICAL FIX: For existing AOIs, mark for deletion instead of removing
            console.log(`[Step2] Marking existing AOI ${aoi.aoiId} for deletion`);
            aoi.markForDeletion();
        } else {
            // For new AOIs (no dbId), remove from array entirely
            console.log(`[Step2] Removing new AOI ${aoi.aoiId} from draft`);
            const index = props.projectData.aoiDrafts.findIndex(a => a.clientAoiId === clientAoiId);
            if (index !== -1) {
                props.projectData.aoiDrafts.splice(index, 1);
            }
        }
        
        messageStore.showMessage(`AOI removed`, "info");
    }
};

const requiresBuffer = computed(() => 
    ['Point', 'LineString'].includes(currentAoiType.value)
);

// CRITICAL FIX: Filter out soft-deleted AOIs for display
const visibleAoiDrafts = computed(() => 
    props.projectData.aoiDrafts.filter(aoi => aoi.status !== 2)
);
</script>

<template>
    <div>
        <div class="min-h-[50vh]">
            <MapVisualization 
                @aoi-drawn="handleAoiDrawn" 
                :aois-to-display="visibleAoiDrafts"
                :accumulated-geometries="accumulatedGeometries"
                :is-monitor-mode="false" 
                ref="mapVizRef" 
            />
        </div>

        <h4 class="text-lg font-semibold mt-2 text-cyan-400" style="font-size: 2vh;">
            Draft AOIs ({{ visibleAoiDrafts.length }})
        </h4>

        <div class="aoi-list-manager space-y-2 h-[12vh] overflow-y-auto">
            <div v-for="(aoi, index) in visibleAoiDrafts" :key="aoi.clientAoiId"
                class="aoi-draft flex justify-between h-[6vh] items-center px-3 text-left bg-gray-700 rounded shadow-md">
                <span class="flex flex-col">
                    <div>
                        <span class="text-white font-bold p-0 text-xs mr-3">
                            {{ index + 1 }}.
                        </span>
                        {{ aoi.name }}
                        <span class="text-sm ml-2 text-yellow-400">
                            ({{ aoi.geomProperties?.geometryCount || 1 }} polygon{{ aoi.geomProperties?.geometryCount > 1 ? 's' : '' }})
                        </span>
                    </div>
                    <div>
                        <span v-if="aoi.geomProperties?.auxData" class="text-sm text-blue-400 ml-2">
                            ({{ Object.keys(aoi.geomProperties.auxData).length }} custom fields)
                        </span>
                    </div>
                </span>
                <button @click="removeAOI(aoi.clientAoiId)"
                    class="remove-btn bg-red-600 hover:bg-red-700 text-white p-1 rounded">
                    Remove
                </button>
            </div>
            <p v-if="visibleAoiDrafts.length === 0" class="text-center text-gray-400 p-4">
                Draw an AOI on the map above to begin.
            </p>
        </div>

        <!-- Decision Modal - unchanged -->
        <Teleport to="body">
            <div v-if="showDecisionModal"
                class="fixed inset-0 bg-black bg-opacity-70 z-[100000] flex justify-center items-center p-4">
                <div class="w-full max-w-md bg-gray-800 rounded-xl shadow-2xl p-6 text-white">
                    <h3 class="text-2xl font-bold mb-4 text-cyan-400">
                        Polygon Drawn ({{ accumulatedGeometries.length + 1 }})
                    </h3>

                    <div v-if="requiresBuffer" class="form-group mb-4">
                        <label class="block text-gray-400 mb-1">
                            Buffer Distance (meters):
                        </label>
                        <input type="number" v-model.number="currentAoiBuffer" 
                            min="1" step="10" placeholder="100"
                            class="w-full p-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-cyan-400 focus:outline-none">
                    </div>

                    <p class="text-gray-300 mb-6">
                        What would you like to do next?
                    </p>

                    <div class="flex flex-col gap-3">
                        <button @click="continueDrawing"
                            class="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition">
                            ➕ Draw Another Polygon for This AOI
                        </button>
                        <button @click="proceedToNaming"
                            class="w-full px-4 py-3 bg-cyan-600 hover:bg-cyan-700 rounded-lg font-semibold transition">
                            ✏️ Name This AOI & Finalize
                        </button>
                        <button @click="cancelDecision"
                            class="w-full px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition">
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </Teleport>

        <!-- Naming Modal - unchanged -->
        <Teleport to="body">
            <div v-if="showNameModal"
                class="fixed inset-0 bg-black bg-opacity-70 z-[100000] flex justify-center items-center p-4">
                <div class="w-full max-w-md bg-gray-800 rounded-xl shadow-2xl p-6 text-white max-h-[90vh] overflow-y-auto">
                    <h3 class="text-2xl font-bold mb-4 text-cyan-400">
                        Name Your AOI ({{ accumulatedGeometries.length }} Polygons)
                    </h3>

                    <div class="form-group mb-4">
                        <label class="block text-gray-400 mb-1">
                            AOI Name: <span class="text-red-400">*</span>
                        </label>
                        <input type="text" v-model="currentAoiName" 
                            placeholder="e.g., Andaman & Nicobar Islands"
                            class="w-full p-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-cyan-400 focus:outline-none">
                    </div>

                    <div class="form-group mb-4">
                        <label class="block text-gray-400 mb-2">Custom Fields (Optional):</label>

                        <div v-if="currentAoiAuxData.length > 0" class="space-y-2 mb-3">
                            <div v-for="(item, index) in currentAoiAuxData" :key="index"
                                class="flex items-center justify-between p-2 bg-gray-700 rounded border border-gray-600">
                                <div class="flex-grow mr-2">
                                    <span class="text-cyan-400 font-semibold text-sm">{{ item.key }}:</span>
                                    <span class="text-white text-sm ml-2">{{ item.value }}</span>
                                </div>
                                <button @click="removeAuxField(index)"
                                    class="bg-red-500 px-3 py-1.5 text-white rounded-lg text-sm font-semibold">
                                    Remove
                                </button>
                            </div>
                        </div>

                        <button @click="showNewAuxFields = true" v-if="!showNewAuxFields"
                            class="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg w-full justify-center">
                            ➕ Add Custom Field
                        </button>

                        <div v-if="showNewAuxFields" class="p-3 bg-gray-700 rounded-lg border border-gray-600">
                            <div class="flex flex-col gap-2 mb-2">
                                <input type="text" v-model="newAuxKey" placeholder="Key"
                                    class="w-full p-2 bg-gray-600 text-white rounded border border-gray-500 focus:border-cyan-400 focus:outline-none text-sm" />
                                <input type="text" v-model="newAuxValue" placeholder="Value"
                                    class="w-full p-2 bg-gray-600 text-white rounded border border-gray-500 focus:border-cyan-400 focus:outline-none text-sm" />
                            </div>
                            <div class="flex justify-end gap-2">
                                <button @click="showNewAuxFields = false; newAuxKey = ''; newAuxValue = '';"
                                    class="bg-gray-500 px-3 py-1.5 text-white rounded-lg text-sm">
                                    Cancel
                                </button>
                                <button @click="addAuxField"
                                    class="bg-blue-600 hover:bg-blue-700 px-3 py-1.5 text-white rounded-lg text-sm">
                                    Save Field
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="flex justify-end gap-3 mt-6">
                        <button @click="cancelNaming"
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
        </Teleport>
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
</style>