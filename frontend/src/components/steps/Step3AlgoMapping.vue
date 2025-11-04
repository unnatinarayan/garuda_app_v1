<script setup>
import { ProjectFormData } from '@/classes/ProjectFormData.js';
import { onMounted, ref, watch } from 'vue';
import { ApiClient } from '@/api/ApiClient.js';

const props = defineProps({
	projectData: ProjectFormData,
});

const api = ApiClient.getInstance();

// Algorithms will now be fetched from the database via API
const algorithms = ref([]);

const selectedAOI = ref(props.projectData.aoiDrafts[0] || null);
const selectedAlgoId = ref(null); // <-- No longer needs type annotation
const currentConfigArgs = ref('{}');

const loadConfig = () => {
	if (!selectedAOI.value || !selectedAlgoId.value) {
		currentConfigArgs.value = '{}';
		return;
	}

	// Look up by the STRING algoId
	const mapping = selectedAOI.value.mappedAlgorithms.find(
		a => a.algoId === selectedAlgoId.value
	);
	if (mapping) {
		currentConfigArgs.value = JSON.stringify(mapping.configArgs, null, 2);
	} else {
		const algo = algorithms.value.find(a => a.algo_id === selectedAlgoId.value); // <-- Look up by string algo_id
		// NOTE: Uses 'args' property from the fetched algorithm object
		currentConfigArgs.value = JSON.stringify(algo?.args || {}, null, 2);
	}
};

const mapAlgoToAOI = () => {
	if (!selectedAOI.value || !selectedAlgoId.value) {
		alert('Please select an AOI and an Algorithm.');
		return;
	}
	try {
		const algo = algorithms.value.find(a => a.algo_id === selectedAlgoId.value); // <-- Look up by string algo_id
		if (!algo) {
			throw new Error("Algorithm not found in catalogue.");
		}
		const args = JSON.parse(currentConfigArgs.value);

		// Pass the string algoId
		selectedAOI.value.mapAlgorithm(selectedAlgoId.value, algo.algo_id, args); // <-- Pass STRING algoId
		alert(`Algorithm ${algo.algo_id} mapped/updated for AOI ${selectedAOI.value.name}.`);
	} catch (e) {
		alert('Invalid JSON in Configuration Arguments or Algorithm not found.');
		console.error(e);
	}
};

onMounted(async () => {
	try {
		const fetchedAlgos = await api.getAlgorithmCatalogue();
		algorithms.value = fetchedAlgos.map(a => ({
			id: a.id,
			name: a.algo_id,
			algo_id: a.algo_id, // CRITICAL: Use algo_id string as the unique ID
			category: a.category,
			args: a.args,
		}));

		if (props.projectData.aoiDrafts.length > 0) {
			selectedAOI.value = props.projectData.aoiDrafts[0];
			selectedAlgoId.value = algorithms.value[0]?.algo_id || null; // <-- Use string ID
			loadConfig();
		}
	} catch (error) {
		console.error("Failed to load algorithm catalogue:", error);
		alert("Could not load algorithms from the database.");
	}
});

watch([selectedAOI, selectedAlgoId], loadConfig);
</script>

<template>
	<div class="p-4">
		<h3 class="text-xl font-bold text-white mb-4">Step 3: Configure AOI Watch (Algorithm Mapping)</h3>
		<div v-if="projectData.aoiDrafts.length === 0" class="bg-red-800 p-3 rounded text-white">
			You must define at least one AOI in Step 2 before configuring algorithms.
		</div>

		<div v-else class="mapping-container space-y-4">
			<div class="form-group">
				<label class="text-gray-400 block mb-1">Select AOI:</label>
				<select v-model="selectedAOI" class="w-full p-2 bg-gray-700 text-white rounded border border-gray-600">
					<option v-for="aoi in projectData.aoiDrafts" :key="aoi.clientAoiId" :value="aoi">
						{{ aoi.name }} ({{ aoi.aoiId }})
					</option>
				</select>
			</div>

			<div class="form-group">
				<label class="text-gray-400 block mb-1">Select Algorithm:</label>
				<select v-model="selectedAlgoId" @change="loadConfig" class="w-full p-2 bg-gray-700 text-white rounded border border-gray-600">
					<option :value="null" disabled>-- Select an Algorithm --</option>
					<option v-for="algo in algorithms" :key="algo.algo_id" :value="algo.algo_id">
						{{ algo.name }} ({{ algo.category }})
					</option>
				</select>
			</div>

			<div class="form-group">
				<label class="text-gray-400 block mb-1">Configuration Arguments (JSONB):</label>
				<textarea v-model="currentConfigArgs" rows="8" placeholder="{ }" class="w-full p-2 bg-gray-700 text-white rounded border border-gray-600 font-mono"></textarea>
				<p class="text-sm text-gray-500 mt-1">Define specific parameters for this AOI/Algorithm combination in valid JSON format.</p>
			</div>

			<button @click="mapAlgoToAOI" class="w-full px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-lg transition duration-200">
				Map / Update Algorithm
			</button>
		</div>
	</div>
</template>

<style scoped>
.mapping-container { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.form-group { grid-column: span 2; }
.form-group:nth-child(1), .form-group:nth-child(2) { grid-column: span 1; }
select, textarea { width: 100%; padding: 8px; box-sizing: border-box; }
.hint { font-size: 0.8em; color: #666; margin-top: 5px; }
.btn-map { grid-column: span 2; background-color: #FF9800; color: white; border: none; padding: 10px 20px; cursor: pointer; border-radius: 4px; }
</style>
