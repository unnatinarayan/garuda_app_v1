<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import Highcharts from 'highcharts';

const props = defineProps({
    isVisible: Boolean,
    projectId: [Number, String], // Project ID for fetching
    allAois: { type: Array, default: () => [] }, // All AOIs in the project
    projectAlerts: { type: Array, default: () => [] }, // Live alert data from parent
});

const emit = defineEmits(['close', 'refetch-alerts']);

// --- STATE ---
const selectedAoiIds = ref([]);
const selectedAlgoIds = ref([]); 
const dateFilter = ref({ 
    from: null, 
    to: null 
});

const ALGO_COLORS = ['#f87171', '#34d399', '#60a5fa', '#facc15', '#a78bfa', '#fb923c'];
const algoColorMap = ref({});

const chartElement = ref(null); // Reference to the div element
let chartInstance = null; // Highcharts object reference

const showAlertModal = ref(false); 
const currentAlertMessage = ref('');


// --- COMPUTED DATA ---

const uniqueAlgorithms = computed(() => {
    const algos = new Map();
    let colorIndex = 0;
    props.allAois.forEach(aoi => {
        aoi.mappedAlgorithms.forEach(algo => {
            if (!algos.has(algo.algo_id)) {
                const color = ALGO_COLORS[colorIndex % ALGO_COLORS.length];
                algos.set(algo.algo_id, { 
                    algo_id: algo.algo_id, 
                    color: color
                });
                algoColorMap.value[algo.algo_id] = color;
                colorIndex++; 
            }
        });
    });
    return Array.from(algos.values());
});


const chartSeriesData = computed(() => {
    const dataMap = new Map();

    // 1. Initialize series for all SELECTED combinations
    const selectedAois = props.allAois.filter(a => selectedAoiIds.value.includes(a.aoi_id));
    const selectedAlgos = uniqueAlgorithms.value.filter(a => selectedAlgoIds.value.includes(a.algo_id));

    if (selectedAois.length === 0 || selectedAlgos.length === 0) {
        return [];
    }

    selectedAois.forEach(aoi => {
        selectedAlgos.forEach(algo => {
            const seriesId = `${aoi.aoi_id}_${algo.algo_id}`;
            dataMap.set(seriesId, {
                id: seriesId,
                name: `${aoi.name} / ${algo.algo_id}`,
                data: [], 
                color: algo.color,
                aoiId: aoi.aoi_id,
                algoId: algo.algo_id,
                type: 'line', 
                step: 'left',
            });
        });
    });

    // 2. Filter Alerts based on user selections
    const filteredAlerts = props.projectAlerts.filter(alert => 
        selectedAoiIds.value.includes(alert.aoiId) && selectedAlgoIds.value.includes(alert.algoId)
    );
    
    // 3. Populate series with alert pulses
    filteredAlerts.forEach(alert => {
        const seriesId = `${alert.aoiId}_${alert.algoId}`;
        const series = dataMap.get(seriesId);
        
        if (series) {
            const timestamp = new Date(alert.timestamp).getTime();
            
            // Pulse Generation Logic (T-1, 0) -> (T, 1) -> (T+1, 0)
            
            series.data.push([timestamp - 1, 0]); 

            series.data.push({
                 x: timestamp, 
                 y: 1, 
                 alertDetails: alert, 
            }); 

            series.data.push([timestamp + 1, 0]);
        }
    });

    // 4. Finalize and Sort Series
    return Array.from(dataMap.values()).map(series => {
        series.data.sort((a, b) => (typeof a === 'object' ? a.x : a[0]) - (typeof b === 'object' ? b.x : b[0]));
        
        const now = Date.now();
        const earliestTime = dateFilter.value.from ? new Date(dateFilter.value.from).getTime() : now;
        const latestTime = dateFilter.value.to ? new Date(dateFilter.value.to).getTime() : now;
        
        // Ensure the graph starts and ends at 0
        series.data.unshift([earliestTime - 10, 0]);
        series.data.push([latestTime + 10, 0]);
        
        return series;
    });
});


// --- ACTIONS ---

const applyFilters = () => {
    // This triggers a refetch of raw alerts from the backend based on date range
    const from = dateFilter.value.from ? new Date(dateFilter.value.from).toISOString() : null;
    const to = dateFilter.value.to ? new Date(dateFilter.value.to).toISOString() : null;
    emit('refetch-alerts', props.projectId, from, to);
};

const toggleAoiSelection = (aoiId) => {
    const index = selectedAoiIds.value.indexOf(aoiId);
    if (index > -1) {
        selectedAoiIds.value.splice(index, 1);
    } else {
        selectedAoiIds.value.push(aoiId);
    }
    // Plotting will automatically update via chartOptions watch
};

const toggleAlgoSelection = (algoId) => {
    const index = selectedAlgoIds.value.indexOf(algoId);
    if (index > -1) {
        selectedAlgoIds.value.splice(index, 1);
    } else {
        selectedAlgoIds.value.push(algoId);
    }
    // Plotting will automatically update via chartOptions watch
};

const handlePointClick = (event) => {
    const alertData = event.point.options.alertDetails; 
    
    if (event.point.y === 1 && alertData) {
        currentAlertMessage.value = JSON.stringify(alertData.message, null, 2);
        showAlertModal.value = true;
    } else {
        currentAlertMessage.value = '';
        showAlertModal.value = false;
    }
};

// --- Highcharts Configuration ---
const chartOptions = computed(() => ({
    chart: {
        type: 'line',
        zoomType: 'x',
        backgroundColor: 'transparent',
        height: '100%',
        marginTop: 20,
        showAxes: true 
    },
    title: {
        text: null, 
    },
    xAxis: {
        type: 'datetime',
        title: { text: 'Time', style: { color: '#ccc' } },
        dateTimeLabelFormats: {
            millisecond: '%H:%M:%S.%L', 
            second: '%H:%M:%S',
            minute: '%H:%M',
            hour: '%H:%M',
            day: '%e. %b',
        },
        labels: { style: { color: '#ccc' } },
        min: dateFilter.value.from ? new Date(dateFilter.value.from).getTime() : undefined,
        max: dateFilter.value.to ? new Date(dateFilter.value.to).getTime() : undefined
    },
    yAxis: {
        title: { text: 'Alert Status (0=None, 1=Alert)', style: { color: '#ccc' } },
        labels: { 
            style: { color: '#ccc' },
            formatter: function() {
                if (this.value === 1) return 'Alert';
                if (this.value === 0) return 'None';
                return '';
            }
        },
        // Max set to 2 to provide buffer space above the '1' line
        min: 0,
        max: 2, 
        tickPositions: [0, 1] 
    },
    tooltip: {
        xDateFormat: '%A, %b %e, %Y, %H:%M:%S', 
        formatter: function() {
            const alertData = this.point.options.alertDetails;
            let tooltipHTML = `<span style="font-size: 10px">${Highcharts.dateFormat('%A, %b %e, %Y, %H:%M:%S', this.x)}</span><br/>`;
            
            if (this.y === 1 && alertData) {
                tooltipHTML += `<span style="color:${this.point.color}">\u25CF</span> <b>${this.series.name}</b>: Alert Received<br/>`;
                tooltipHTML += `<span style="font-size: 10px; color:#aaa;">Type: ${alertData.message.type || 'N/A'}</span>`;
            } else {
                tooltipHTML += `<b>${this.series.name}</b>: No Alert`;
            }
            return tooltipHTML;
        }
    },
    legend: {
        enabled: false 
    },
    plotOptions: {
        series: {
            step: 'left', 
            lineWidth: 2,
            marker: { enabled: false },
            point: {
                events: {
                    click: handlePointClick
                }
            },
            events: {
                legendItemClick: function() { return false; }
            }
        },
    },
    
    series: chartSeriesData.value
}));


// --- MOUNTING AND WATCHERS ---

onMounted(() => {
    const now = new Date();
    // Default range set to last 24 hours
    const oneDayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    const formatDate = (date) => date.toISOString().split('T')[0];

    dateFilter.value.from = formatDate(oneDayAgo);
    dateFilter.value.to = formatDate(now);
    
    // Select all AOIs and all Algos by default immediately
    watch(props.allAois, (newAois) => {
        if (newAois.length > 0) {
            selectedAoiIds.value = newAois.map(a => a.aoi_id);
            selectedAlgoIds.value = uniqueAlgorithms.value.map(a => a.algo_id);
        }
    }, { immediate: true });

    // Handle initial selection for algorithms
    watch(uniqueAlgorithms, (newAlgos) => {
        if (newAlgos.length > 0 && selectedAlgoIds.value.length === 0) {
            selectedAlgoIds.value = newAlgos.map(a => a.algo_id);
        }
    }, { immediate: true });
});


// CRITICAL FIX: Manually manage Highcharts instance for reliable re-plotting/destruction
watch(chartOptions, (newOptions) => {
    // 1. Guard check
    if (!props.isVisible || !chartElement.value) return;

    // 2. Update/Create logic
    if (chartSeriesData.value.length > 0) {
        if (chartInstance) {
            // Update existing chart (re-plots instantly when data/options change)
            chartInstance.update(newOptions, true);
        } else {
            // Create new chart
            chartInstance = Highcharts.chart(chartElement.value, newOptions);
        }
    } else if (chartInstance) {
        // 3. Destroy logic (if selections lead to no data)
        chartInstance.destroy();
        chartInstance = null;
    }
}, { deep: true }); 


// Destroy chart when panel closes to free up memory
watch(() => props.isVisible, (newVal) => {
    if (!newVal && chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
    }
});
</script>



<template>
    <div v-if="isVisible" 
         class="fixed bottom-0 left-0 right-0 bg-gray-900 shadow-2xl border-t-4 border-cyan-500 transition-all duration-300 transform z-[10000]"
         :class="{'translate-y-0': isVisible, 'translate-y-full': !isVisible}"
         style="height: 50vh; min-height: 300px;"
    >
        <button @click="$emit('close')" class="absolute p-0 top-1 right-4 text-red-400 hover:text-red-300 text-2xl font-bold z-20" title="Close Panel">&times;</button>

        
        <!-- Main Content Wrapper: Responsive Padding and Scroll -->
        <div class="flex flex-col h-full p-2 overflow-y-auto">
            
            <!-- Controls (Top: AOI Selection & Date Filter) -->
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2 space-y-2 sm:space-y-0 sm:space-x-4">
                
                <!-- AOI Selection (Top-Left) -->
                <div class="flex-grow w-full sm:w-1/2">
                    <label class="block text-gray-400 text-xs mb-1">Select AOIs:</label>
                    <div class="flex flex-wrap gap-2 max-h-12 overflow-y-auto p-1 bg-gray-800 rounded-lg">
                        <label v-for="aoi in allAois" :key="aoi.aoi_id" 
                               :for="`aoi-${aoi.aoi_id}`" class="flex items-center space-x-1 text-sm text-gray-300 cursor-pointer hover:text-white"
                        >
                            <input type="checkbox" 
                                   :id="`aoi-${aoi.aoi_id}`" :value="aoi.aoi_id" 
                                   :checked="selectedAoiIds.includes(aoi.aoi_id)"
                                   @change="toggleAoiSelection(aoi.aoi_id)"
                                   class="rounded text-cyan-500 bg-gray-700 border-gray-600 focus:ring-cyan-500">
                            <span class="truncate">{{ aoi.name }}</span>
                        </label>
                    </div>
                </div>

                <!-- Date Filter (Top-Right) -->
                <div class="w-full sm:w-1/2 flex justify-end">
                    <div class="flex space-x-2 text-sm">
                        <input type="date" v-model="dateFilter.from" class="bg-gray-700 text-white p-1 rounded w-1/3 text-xs sm:text-sm">
                        <input type="date" v-model="dateFilter.to" class="bg-gray-700 text-white p-1 rounded w-1/3 text-xs sm:text-sm">
                        <button @click="applyFilters" class="bg-blue-600 hover:bg-blue-700 text-white py-1 px-3 rounded-lg w-1/3 text-xs sm:text-sm">Filter</button>
                    </div>
                </div>
            </div>
            
            <!-- Graph Plot Area (Middle: Takes all remaining vertical space) -->
            <div class="flex-grow min-h-20 mb-2">
                <div ref="chartElement" class="w-full h-full" v-if="chartSeriesData.length > 0">
                </div>
                <div v-else class="text-gray-400 p-4 text-center flex items-center justify-center h-full border border-gray-700 rounded-lg">
                    <span>{{ props.projectAlerts.length === 0 ? 'No alerts for this project.' : 
                             selectedAoiIds.length === 0 || selectedAlgoIds.length === 0 ? 'Select AOIs and Algorithms to plot.' : 
                             'No alerts found for the selected combination and date range.' 
                    }}</span>
                </div>
            </div>

            <!-- Algorithm Legend (Bottom: Horizontal flex row) -->
            <div class="flex flex-wrap gap-x-4 gap-y-1 p-2 bg-gray-800 rounded-lg justify-start flex-row overflow-x-auto border border-gray-700">
                <div v-for="algo in uniqueAlgorithms" :key="algo.algo_id" 
                       :title="`Algorithm: ${algo.algo_id}`"
                       class="flex items-center space-x-1 text-xs text-gray-300 cursor-pointer hover:text-white transition-colors"
                >
                     <input type="checkbox" 
                           :id="`legend-algo-${algo.algo_id}`" :value="algo.algo_id" 
                           :checked="selectedAlgoIds.includes(algo.algo_id)"
                           @change="toggleAlgoSelection(algo.algo_id)"
                           class="rounded text-cyan-500 bg-gray-700 border-gray-600 focus:ring-cyan-500">
                     <div class="w-2 h-2 rounded-full" :style="{ backgroundColor: algo.color }"></div>
                     <span class="font-medium">{{ algo.algo_id }}</span>
                </div>
            </div>
            
        </div>
    </div>
    
    <!-- Alert Message Modal -->
    <div v-if="showAlertModal" class="fixed inset-0 bg-black bg-opacity-70 z-[30000] flex justify-center items-center p-4">
        <div class="bg-gray-900 rounded-xl shadow-2xl p-6 w-full max-w-lg relative border-2 border-red-500">
            <button @click="showAlertModal = false" class="absolute top-2 right-4 text-red-400 hover:text-red-300 text-2xl font-bold">&times;</button>
            <h5 class="text-xl text-white font-bold mb-3 border-b border-gray-700 pb-2">Alert Details</h5>
            <pre class="bg-gray-800 p-3 rounded-lg text-sm text-yellow-300 whitespace-pre-wrap max-h-80 overflow-y-auto">{{ currentAlertMessage }}</pre>
            <button @click="showAlertModal = false" class="mt-4 w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg">Close</button>
        </div>
    </div>
</template>