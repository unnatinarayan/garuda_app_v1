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
const showCartPopup = ref(false);

// --- NEW STATE FOR MAPPING LOGIC ---
// const selectedAlgoIds = ref([]);
const currentAlgoArgs = ref({});
const editingAlgo = ref(null); 
// -----------------------------------


// Computed: A map for quick lookup of algorithm details by algo_id
const algoMap = computed(() => {
    return algorithms.value.reduce((map, algo) => {
        map[algo.algo_id] = algo;
        return map;
    }, {});
});


const cartAlgorithms = computed(() => {
    if (!selectedAOI.value) return [];
    return selectedAOI.value.getActiveAlgorithms();
});

// Computed: Check if algorithm is in cart
const isAlgoInCart = (algoId) => {
    return cartAlgorithms.value.some(a => a.algoId === algoId);
};


// --- CORE LOGIC: Sync state when a new AOI is selected ---
watch(selectedAOI, (newAOI) => {
    if (newAOI) {
        
        editingAlgo.value = null; 
        currentAlgoArgs.value = {};
    }
}, { immediate: true });

/**
 * CART ACTION: Add algorithm to cart
 */
const addToCart = (algoId) => {
    if (!selectedAOI.value) return;
    
    const algo = algoMap.value[algoId];
    const defaultArgs = algo?.args || {};
    
    selectedAOI.value.mapAlgorithm(algoId, algoId, defaultArgs, 1, null);
};

/**
 * CART ACTION: Remove from cart (soft delete if has mappingId)
 */
const removeFromCart = (algoId, mappingId) => {
    if (!selectedAOI.value) return;
    selectedAOI.value.removeAlgorithm(algoId, mappingId);
};

/**
 * CART ACTION: Toggle active/inactive
 */
const toggleActive = (algoId, mappingId) => {
    if (!selectedAOI.value) return;
    selectedAOI.value.toggleAlgorithmStatus(algoId, mappingId);
};



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
        selectedAOI.value.mapAlgorithm(algoId, algoId, defaultArgs, 1, null);
        
        // Update local state
        if (!selectedAlgoIds.value.includes(algoId)) {
             selectedAlgoIds.value.push(algoId);
        }
    } else {
        // Remove the mapping from the AOI draft
        selectedAOI.value.mappedAlgorithms = selectedAOI.value.mappedAlgorithms
            .map(a => {
                if (a.algoId === algoId) {
                    // CRITICAL: Change status to 2 (Removed) instead of deleting the object
                    return { ...a, status: 2 }; 
                }
                return a;
            })
            // Filter out the "removed" one for the local UI display only
            .filter(a => a.algoId !== algoId || a.status !== 2);

        // selectedAOI.value.mappedAlgorithms = selectedAOI.value.mappedAlgorithms.filter(
        //     a => a.algoId !== algoId
        // );
        
        // Update local state
        selectedAlgoIds.value = selectedAlgoIds.value.filter(id => id !== algoId);

        // If the un-mapped algo was open for editing, close the editor
        if (editingAlgo.value?.algo_id === algoId) {
            editingAlgo.value = null;
        }
    }
};


/**
 * Open argument editor
 */
const openArgEditor = (algoId, mappingId) => {
    const algo = algoMap.value[algoId];
    if (!algo) return;

    const currentMapping = selectedAOI.value.mappedAlgorithms.find(a => 
        a.algoId === algoId && a.mappingId === mappingId
    );
    
    editingAlgo.value = { ...algo, mappingId };
    currentAlgoArgs.value = currentMapping ? currentMapping.configArgs : algo.args || {};
};


/**
 * Save edited arguments
 */
const saveArgs = (updatedArgs) => {
    if (!selectedAOI.value || !editingAlgo.value) return;

    const { algo_id, mappingId } = editingAlgo.value;
    
    const mapping = selectedAOI.value.mappedAlgorithms.find(a => 
        a.algoId === algo_id && a.mappingId === mappingId
    );
    
    if (mapping) {
        mapping.configArgs = updatedArgs;
    }
    
    editingAlgo.value = null;
    currentAlgoArgs.value = {};
};

// --- Lifecycle & Data Fetching (Remains the same) ---
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
            description: a.description
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
    <div class="h-[70vh] relative"> <div v-if="projectData.aoiDrafts.length === 0" class="bg-red-800 p-3 rounded text-white mb-4">
            You must define at least one AOI in Step 2 before configuring algorithms.
        </div>

        <div v-else class="mapping-container space-y-4 h-full flex flex-col">
            <div class="form-group w-full flex-shrink-0">
                <label class="text-gray-400 block mb-1 font-semibold">Select Target AOI:</label>
                <CustomSelect
                    v-model="selectedAOI"
                    :options="projectData.aoiDrafts"
                    value-key="aoiId"
                    label-key="name"
                    placeholder="Click to select an AOI"
                />
            </div>

            <div v-if="selectedAOI" class="flex-grow min-h-0 relative">
                <div class="w-full">
                    
                    <div class="flex items-center justify-between mb-3 relative">
                        <h4 class="text-xl font-semibold text-cyan-400">
                            Available Algorithms
                        </h4>

                        <button
                            @click="showCartPopup = !showCartPopup"
                            class="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-lg font-semibold transition duration-150 shadow-md"
                            title="Open Algorithm Cart"
                        >
                            <svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
                            </svg>
                            Cart ({{ cartAlgorithms.length }})
                        </button>

                        <div 
                            v-if="showCartPopup" 
                            v-click-outside="() => showCartPopup = false"
                            class="absolute top-full right-0 mt-2 w-full max-w-sm bg-gray-900 rounded-lg border border-gray-700 shadow-2xl z-10"
                        >
                            <div class="p-4">
                                <h5 class="text-xl font-bold mb-3 text-cyan-400 border-b border-gray-700 pb-2">
                                    Algorithm Cart
                                </h5>
                                <div class="max-h-80 overflow-y-auto space-y-2">
                                    <div v-if="cartAlgorithms.length === 0" class="text-center text-gray-400 py-6">
                                        <svg class="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
                                        </svg>
                                        <p class="text-base">Cart is empty</p>
                                        <p class="text-sm mt-1">Add algorithms from the list below</p>
                                    </div>

                                    <div v-else class="space-y-2">
                                        <div 
                                            v-for="algo in cartAlgorithms" 
                                            :key="`${algo.algoId}-${algo.mappingId}`"
                                            class="p-3 rounded-lg border transition duration-150"
                                            :class="{
                                                'bg-gray-700 border-gray-600': algo.status === 1,
                                                'bg-yellow-900/30 border-yellow-600': algo.status === 0
                                            }"
                                        >
                                            <div class="flex justify-between items-start mb-2">
                                                <span class="text-base font-semibold text-white truncate flex-grow">
                                                    {{ algo.algoId }}
                                                </span>
                                                <button 
                                                    @click="removeFromCart(algo.algoId, algo.mappingId)"
                                                    class="text-red-400 hover:text-red-300 ml-2 p-1"
                                                    title="Remove from cart"
                                                >
                                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                                                    </svg>
                                                </button>
                                            </div>

                                            <div class="flex gap-2">
                                                <button 
                                                    @click="openArgEditor(algo.algoId, algo.mappingId); showCartPopup = false"
                                                    class="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition duration-150 font-medium"
                                                >
                                                    Configure
                                                </button>
                                                
                                                <button 
                                                    v-if="algo.mappingId"
                                                    @click="toggleActive(algo.algoId, algo.mappingId)"
                                                    class="px-3 py-1.5 rounded text-sm transition duration-150 font-medium"
                                                    :class="{
                                                        'bg-green-600 hover:bg-green-700 text-white': algo.status === 1,
                                                        'bg-yellow-600 hover:bg-yellow-700 text-white': algo.status === 0
                                                    }"
                                                    :title="algo.status === 1 ? 'Deactivate' : 'Activate'"
                                                >
                                                    {{ algo.status === 1 ? '✓ Active' : '✗ Inactive' }}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div v-if="loadingAlgos" class="text-gray-500">Loading catalogue...</div>
                    <div v-else-if="error" class="bg-red-800 p-3 rounded text-white">{{ error }}</div>
                    
                    <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[calc(70vh-200px)] overflow-y-auto p-2 border border-gray-700 rounded-lg">
                        <div 
                            v-for="algo in algorithms" 
                            :key="algo.algo_id"
                            class="flex flex-col p-3 rounded-lg border transition duration-150"
                            :class="{
                                'bg-gray-700 border-gray-600 hover:bg-gray-600': !isAlgoInCart(algo.algo_id),
                                'bg-green-900/30 border-green-600': isAlgoInCart(algo.algo_id)
                            }"
                        >
                            <div class="flex justify-between items-start mb-2">
                                <div class="flex-grow min-w-0">
                                    <h5 class="font-bold text-white truncate text-base">{{ algo.name }}</h5> <span class="text-xs px-2 py-0.5 rounded bg-blue-700 text-blue-200">
                                        {{ algo.category }}
                                    </span>
                                </div>
                            </div>
                            
                            <p class="text-sm text-gray-400 mb-3 line-clamp-2"> {{ algo.description || 'No description provided.' }}
                            </p>
                            
                            <button 
                                v-if="!isAlgoInCart(algo.algo_id)"
                                @click="addToCart(algo.algo_id)"
                                class="w-full px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-semibold transition duration-150"
                            >
                                + Add to Cart
                            </button>
                            
                            <div v-else class="text-sm text-green-400 flex items-center"> <svg class="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                                </svg>
                                In Cart
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <div v-if="editingAlgo" class="fixed inset-0 bg-black bg-opacity-70 z-[20000] flex justify-center items-center p-4">
            <div class="w-full max-w-lg bg-gray-800 rounded-xl shadow-2xl p-6 text-white">
                <h3 class="text-xl font-bold mb-4 text-cyan-400">
                    {{ editingAlgo.name }}
                </h3>
                <p class="mb-4 text-gray-400">
                    AOI: 
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

