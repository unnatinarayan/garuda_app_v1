<script setup>
import { ref, computed, watch } from 'vue';
// Assuming you have 'highcharts' and 'vue-highcharts' installed:
// npm install highcharts vue-highcharts
import Highcharts from 'highcharts';
import HighchartsVue from 'highcharts-vue';

// Register the Highcharts component
const Chart = HighchartsVue.component;

const props = defineProps({
    // The currently selected AOI object (including mapped algorithms and geom_properties)
    aoiDetails: { type: Object, required: true },
    // Full project details which includes alert data (fetched in MonitorMapView)
    projectAlerts: { type: Array, required: true },
    isVisible: { type: Boolean, default: false }
});

const emit = defineEmits(['close']);

// Local state for the selected algorithms to display (checkboxes)
const selectedAlgos = ref([]);

// Local state for showing the alert detail modal
const showAlertModal = ref(false);
const currentAlertMessage = ref('');

// Watch the aoiDetails change to reset selected algorithms and initialize them.
watch(() => props.aoiDetails, (newAoi) => {
    if (newAoi && newAoi.mappedAlgorithms) {
        // Automatically select all mapped algorithms when a new AOI is loaded
        selectedAlgos.value = newAoi.mappedAlgorithms.map(algo => algo.algo_id);
    } else {
        selectedAlgos.value = [];
    }
}, { immediate: true });


/**
 * Processes alerts and creates the data series structure required by Highcharts.
 * This function is the core data manipulator.
 */
const visualizationData = computed(() => {
    const data = [];
    
    // Filter alerts specific to this AOI
    const aoiAlerts = props.projectAlerts.filter(alert => alert.aoiId === props.aoiDetails.aoi_id);

    for (const algoId of selectedAlgos.value) {
        // Filter alerts specific to this algorithm/AOI combination
        const algoAlerts = aoiAlerts.filter(alert => alert.algoId === algoId);

        // --- CHART SERIES CONSTRUCTION ---
        // For demonstration, we simulate a 'change intensity' value (y-axis) 
        // using the message size or a hardcoded value, since the DB only has 'message'.
        const seriesData = algoAlerts.map(alert => ({
            // CRITICAL: x-axis must be the time in milliseconds since epoch
            x: new Date(alert.timestamp).getTime(),
            // CRITICAL: y-axis is the value. Use a mock value or extract a real metric from `alert.message`.
            y: 10 + Math.floor(Math.random() * 90), // Mock Y-value (e.g., Change Intensity 10-100)
            alert: alert // Store the full alert object in the point data
        }));

        data.push({
            name: algoId,
            id: algoId,
            data: seriesData,
            type: 'scatter', // Use scatter to show individual events
            marker: {
                symbol: 'circle',
                radius: 5
            }
        });
    }
    return data;
});

/**
 * Handles the click event on a data point (alert dot) in the Highcharts scatter plot.
 */
const handlePointClick = (event) => {
    const pointData = event.point.options.alert;
    if (pointData) {
        currentAlertMessage.value = JSON.stringify(pointData.message, null, 2);
        showAlertModal.value = true;
    }
};

// --- Highcharts Configuration ---
const chartOptions = computed(() => ({
    chart: {
        type: 'scatter',
        zoomType: 'x',
        backgroundColor: 'transparent' // Use component background
    },
    title: {
        text: `Alert History for AOI: ${props.aoiDetails.name}`,
        style: { color: '#fff' }
    },
    xAxis: {
        type: 'datetime', // Use datetime axis for timestamps
        title: { text: 'Time of Alert', style: { color: '#ccc' } },
        labels: { style: { color: '#ccc' } }
    },
    yAxis: {
        title: { text: 'Change Metric (Mock)', style: { color: '#ccc' } },
        labels: { style: { color: '#ccc' } },
        min: 0,
        max: 100 // Set max for mock data
    },
    legend: {
        itemStyle: { color: '#fff' }
    },
    plotOptions: {
        series: {
            cursor: 'pointer',
            point: {
                events: {
                    click: handlePointClick // Attach click handler
                }
            }
        }
    },
    series: visualizationData.value // Pass the computed data
}));
</script>

<template>
    <div v-if="isVisible" 
         class="fixed bottom-0 left-0 right-0 bg-gray-900 shadow-2xl border-t-4 border-cyan-500 p-4 transition-all duration-300 transform z-[10000]"
         :class="{'translate-y-0': isVisible, 'translate-y-full': !isVisible}"
         style="height: 40vh;"
    >
        <button @click="$emit('close')" class="absolute top-2 right-4 text-red-400 hover:text-red-300 text-2xl font-bold">&times;</button>
        
        <div class="flex h-full overflow-hidden">
            <div class="w-1/4 pr-4 border-r border-gray-700 overflow-y-auto">
                <h4 class="text-lg font-bold text-white mb-3">Select Algos</h4>
                <div v-for="algo in aoiDetails.mappedAlgorithms" :key="algo.algo_id" class="mb-2">
                    <label class="flex items-center space-x-2 text-sm text-gray-300 cursor-pointer hover:text-white">
                        <input 
                            type="checkbox" 
                            :value="algo.algo_id" 
                            v-model="selectedAlgos"
                            class="rounded text-cyan-500 bg-gray-700 border-gray-600 focus:ring-cyan-500"
                        >
                        <span>{{ algo.algo_id }}</span>
                    </label>
                </div>
            </div>

            <div class="w-3/4 pl-4 h-full">
                <div v-if="visualizationData.length > 0" class="h-full">
                    <Chart :options="chartOptions" class="w-full h-full" />
                </div>
                <div v-else class="text-gray-400 p-10 text-center">
                    No algorithms selected or no data available for the selected algorithms.
                </div>
            </div>
        </div>
    </div>
    
    <div v-if="showAlertModal" class="fixed inset-0 bg-black bg-opacity-70 z-[30000] flex justify-center items-center p-4">
        <div class="w-full max-w-md bg-gray-800 rounded-xl shadow-2xl p-6 text-white">
            <h3 class="text-2xl font-bold mb-4 text-red-400">Alert Details</h3>
            <pre class="bg-gray-700 p-3 rounded text-sm overflow-auto max-h-64">{{ currentAlertMessage }}</pre>
            <div class="mt-6 flex justify-end">
                <button @click="showAlertModal = false" class="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg">Close</button>
            </div>
        </div>
    </div>
</template>