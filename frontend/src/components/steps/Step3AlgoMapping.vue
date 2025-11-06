<!-- Step3AlgoMapping.vue  -->

<script setup>
import { ProjectFormData } from '@/classes/ProjectFormData.js';
import { onMounted, ref, watch, computed } from 'vue';
import { ApiClient } from '@/api/ApiClient.js';
import CustomSelect from '@/components/common/CustomSelect.vue'; 
import KeyValueEditor from '@/components/common/KeyValueEditor.vue'; 

const props = defineProps({
	projectData: ProjectFormData,
});

const api = ApiClient.getInstance();

// State
const algorithms = ref([]);
const selectedAOI = ref(null);
const loadingAlgos = ref(false);
const error = ref(null);

// --- NEW STATE FOR MAPPING LOGIC ---
// Holds the algo_id strings of algorithms currently selected for the active AOI
const selectedAlgoIds = ref([]);

// Holds the arguments for the currently selected algorithm (used by KeyValueEditor)
const currentAlgoArgs = ref({});

// The algorithm that is currently open for argument editing
const editingAlgo = ref(null); 
// -----------------------------------


// Computed: A map for quick lookup of algorithm details by algo_id
const algoMap = computed(() => {
    return algorithms.value.reduce((map, algo) => {
        map[algo.algo_id] = algo;
        return map;
    }, {});
});


// --- CORE LOGIC: Sync state when a new AOI is selected ---
watch(selectedAOI, (newAOI) => {
    if (newAOI) {
        // 1. Update the list of selected algorithms based on the drafts
        selectedAlgoIds.value = newAOI.mappedAlgorithms.map(a => a.algoId);
        // 2. Clear any active argument editor view
        editingAlgo.value = null; 
        currentAlgoArgs.value = {};
    }
}, { immediate: true });


/**
 * Called when an algorithm is checked/unchecked.
 * @param {string} algoId 
 * @param {boolean} isChecked 
 */
const handleAlgoSelectionChange = (algoId, isChecked) => {
    if (!selectedAOI.value) return;

    if (isChecked) {
        // Find the default arguments for the newly selected algorithm
        const defaultArgs = algoMap.value[algoId]?.args || {};
        
        // Add the new mapping to the AOI draft with default arguments
        selectedAOI.value.mapAlgorithm(algoId, algoId, defaultArgs);
        
        // Update local state
        if (!selectedAlgoIds.value.includes(algoId)) {
             selectedAlgoIds.value.push(algoId);
        }
    } else {
        // Remove the mapping from the AOI draft
        selectedAOI.value.mappedAlgorithms = selectedAOI.value.mappedAlgorithms.filter(
            a => a.algoId !== algoId
        );
        
        // Update local state
        selectedAlgoIds.value = selectedAlgoIds.value.filter(id => id !== algoId);

        // If the un-mapped algo was open for editing, close the editor
        if (editingAlgo.value?.algo_id === algoId) {
            editingAlgo.value = null;
        }
    }
};


/**
 * Opens the KeyValueEditor modal for a specific algorithm.
 */
const openArgEditor = (algoId) => {
    const algo = algoMap.value[algoId];
    if (!algo) return;

    const currentMapping = selectedAOI.value.mappedAlgorithms.find(a => a.algoId === algoId);
    
    // 2. Set the state for the editor
    editingAlgo.value = algo;
    currentAlgoArgs.value = currentMapping ? currentMapping.configArgs : algo.args || {};
};

/**
 * Saves the edited arguments back to the AOI draft.
 * @param {Object} updatedArgs 
 */
const saveArgs = (updatedArgs) => {
    if (!selectedAOI.value || !editingAlgo.value) return;

    const algoId = editingAlgo.value.algo_id;

    // 1. Update the mapping in the AOI draft
    selectedAOI.value.mapAlgorithm(algoId, algoId, updatedArgs); 

    // 2. Close the editor
    editingAlgo.value = null;
    currentAlgoArgs.value = {};

    alert(`Arguments for ${algoId} updated.`);
};

// --- Lifecycle & Data Fetching ---
onMounted(async () => {
    loadingAlgos.value = true;
    try {
        const fetchedAlgos = await api.getAlgorithmCatalogue();
        algorithms.value = fetchedAlgos.map(a => ({
            id: a.id,
            name: a.algo_id,
            algo_id: a.algo_id, 
            category: a.category,
            args: a.args,
            description: a.description // Use the description
        }));
        
        if (props.projectData.aoiDrafts.length > 0) {
            selectedAOI.value = props.projectData.aoiDrafts[0];
        }
    } catch (e) {
        error.value = "Failed to load algorithm catalogue.";
        console.error("Load Algo Error:", e);
    } finally {
        loadingAlgos.value = false;
    }
});
</script>

<template>
    <div class="p-4">
        <h3 class="text-xl font-bold text-white mb-4">Step 3: Configure AOI Watch</h3>
        
        <div v-if="projectData.aoiDrafts.length === 0" class="bg-red-800 p-3 rounded text-white mb-4">
            You must define at least one AOI in Step 2 before configuring algorithms.
        </div>

        <div v-else class="mapping-container space-y-6">

            <div class="form-group w-full">
                <label class="text-gray-400 block mb-1 font-semibold">Select Target AOI:</label>
                <CustomSelect
                    v-model="selectedAOI"
                    :options="projectData.aoiDrafts"
                    value-key="aoiId"
                    label-key="name"
                    placeholder="Click to select an AOI"
                />
                <p v-if="selectedAOI" class="text-sm text-gray-500 mt-1">Configure algorithms for AOI: <span class="text-white">{{ selectedAOI.name }}</span></p>
            </div>

            <div v-if="selectedAOI">
                <h4 class="text-lg font-semibold text-cyan-400 mb-3">Map Algorithms to this AOI:</h4>

                <div v-if="loadingAlgos" class="text-gray-500">Loading catalogue...</div>
                <div v-else-if="error" class="bg-red-800 p-3 rounded text-white">{{ error }}</div>
                
                <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-80 overflow-y-auto p-2 border border-gray-700 rounded-lg">
                    <div 
                        v-for="algo in algorithms" :key="algo.algo_id"
                        class="flex flex-col p-3 rounded-lg border transition duration-150"
                        :class="{'bg-green-800/20 border-green-500': selectedAlgoIds.includes(algo.algo_id), 'bg-gray-700 border-gray-600 hover:bg-gray-600': !selectedAlgoIds.includes(algo.algo_id)}"
                    >
                        <div class="flex items-center justify-between mb-2">
                            <label :for="algo.algo_id" class="font-bold cursor-pointer text-white flex-grow mr-2">
                                {{ algo.name }}
                            </label>
                            <div class="flex items-center space-x-2">
                                <span class="text-xs px-2 py-0.5 rounded bg-blue-700 text-blue-200 flex-shrink-0">{{ algo.category }}</span>
                                <input 
                                    type="checkbox" 
                                    :id="algo.algo_id"
                                    :checked="selectedAlgoIds.includes(algo.algo_id)"
                                    @change="handleAlgoSelectionChange(algo.algo_id, $event.target.checked)"
                                    class="h-5 w-5 rounded text-green-600 bg-gray-600 border-gray-500 focus:ring-green-500"
                                >
                            </div>
                        </div>
                        
                        <p class="text-xs text-gray-400 mb-2 truncate">{{ algo.description || 'No description provided.' }}</p>
                        
                        <button 
                            v-if="selectedAlgoIds.includes(algo.algo_id)"
                            @click="openArgEditor(algo.algo_id)"
                            class="mt-2 text-sm px-3 py-1 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg self-start transition duration-150"
                        >
                            Configure Arguments
                        </button>
                    </div>
                </div>
            </div>

        </div>
        
        <div v-if="editingAlgo" class="fixed inset-0 bg-black bg-opacity-70 z-[20000] flex justify-center items-center p-4">
            <div class="w-full max-w-lg bg-gray-800 rounded-xl shadow-2xl p-6 text-white">
                <h3 class="text-xl font-bold mb-4 text-cyan-400">Configure: {{ editingAlgo.name }}</h3>
                <p class="mb-4 text-gray-400">Edit parameters for this algorithm on AOI: 
                    <span class="font-semibold">{{ selectedAOI.name }}</span>
                </p>

                <KeyValueEditor
                    :initial-data="currentAlgoArgs"
                    @save="saveArgs"
                    @cancel="editingAlgo = null"
                />
            </div>
        </div>
        
        </div>
</template>

