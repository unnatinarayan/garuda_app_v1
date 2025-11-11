<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import Highcharts from 'highcharts';

const props = defineProps({
    isVisible: Boolean,
    projectId: [Number, String],
    allAois: { type: Array, default: () => [] },
    projectAlerts: { type: Array, default: () => [] },
});

const emit = defineEmits(['close', 'refetch-alerts']);

// --- STATE ---
const selectedAoiIds = ref([]);
const selectedAlgoIds = ref([]);
const dateFilter = ref({ 
    from: null, 
    to: null 
});

const ALGO_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
const algoColorMap = ref({});

const chartElement = ref(null);
let chartInstance = null;

const showAlertModal = ref(false);
const currentAlertDetails = ref(null);
const isLoadingChart = ref(false);

// --- COMPUTED DATA ---

// Get unique algorithms across all AOIs with color assignment
const uniqueAlgorithms = computed(() => {
    const algos = new Map();
    let colorIndex = 0;
    
    props.allAois.forEach(aoi => {
        if (aoi.mappedAlgorithms && Array.isArray(aoi.mappedAlgorithms)) {
            aoi.mappedAlgorithms.forEach(algo => {
                if (!algos.has(algo.algo_id)) {
                    const color = ALGO_COLORS[colorIndex % ALGO_COLORS.length];
                    algos.set(algo.algo_id, { 
                        algo_id: algo.algo_id,
                        description: algo.description || algo.algo_id,
                        color: color
                    });
                    algoColorMap.value[algo.algo_id] = color;
                    colorIndex++;
                }
            });
        }
    });
    
    return Array.from(algos.values());
});

// Get algorithms available for currently selected AOIs
const availableAlgorithms = computed(() => {
    if (selectedAoiIds.value.length === 0) return uniqueAlgorithms.value;
    
    const availableAlgos = new Set();
    const selectedAois = props.allAois.filter(a => selectedAoiIds.value.includes(a.aoi_id));
    
    selectedAois.forEach(aoi => {
        if (aoi.mappedAlgorithms && Array.isArray(aoi.mappedAlgorithms)) {
            aoi.mappedAlgorithms.forEach(algo => {
                availableAlgos.add(algo.algo_id);
            });
        }
    });
    
    return uniqueAlgorithms.value.filter(algo => availableAlgos.has(algo.algo_id));
});

// Process alerts into series data for Highcharts
const chartSeriesData = computed(() => {
    if (!props.projectAlerts || props.projectAlerts.length === 0) {
        return [];
    }

    if (selectedAoiIds.value.length === 0 || selectedAlgoIds.value.length === 0) {
        return [];
    }

    const dataMap = new Map();
    
    // Initialize series for each AOI-Algorithm combination
    const selectedAois = props.allAois.filter(a => selectedAoiIds.value.includes(a.aoi_id));
    const selectedAlgos = availableAlgorithms.value.filter(a => selectedAlgoIds.value.includes(a.algo_id));
    
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
                lineWidth: 2,
            });
        });
    });
    
    // Filter and process alerts
    const filteredAlerts = props.projectAlerts.filter(alert => 
        selectedAoiIds.value.includes(alert.aoiId) && 
        selectedAlgoIds.value.includes(alert.algoId)
    );
    
    // Populate series with alert data
    filteredAlerts.forEach(alert => {
        const seriesId = `${alert.aoiId}_${alert.algoId}`;
        const series = dataMap.get(seriesId);
        
        if (series) {
            const timestamp = new Date(alert.timestamp).getTime();
            
            // Create pulse: (T-1ms, 0) -> (T, 1) -> (T+1ms, 0)
            series.data.push([timestamp - 1, 0]);
            series.data.push({
                x: timestamp,
                y: 1,
                alertDetails: alert,
                marker: { enabled: true, radius: 4, symbol: 'circle' }
            });
            series.data.push([timestamp + 1, 0]);
        }
    });
    
    // Finalize series
    const allSeries = Array.from(dataMap.values()).map(series => {
        // Sort data points
        series.data.sort((a, b) => {
            const aTime = typeof a === 'object' ? a.x : a[0];
            const bTime = typeof b === 'object' ? b.x : b[0];
            return aTime - bTime;
        });
        
        // Add baseline points at start and end
        if (series.data.length > 0) {
            const firstTime = typeof series.data[0] === 'object' ? series.data[0].x : series.data[0][0];
            const lastTime = typeof series.data[series.data.length - 1] === 'object' 
                ? series.data[series.data.length - 1].x 
                : series.data[series.data.length - 1][0];
            
            series.data.unshift([firstTime - 1000, 0]);
            series.data.push([lastTime + 1000, 0]);
        }
        
        return series;
    });
    
    return allSeries.filter(s => s.data.length > 2); // Only return series with actual data
});

// Highcharts configuration
const chartOptions = computed(() => {
    const minTime = dateFilter.value.from ? new Date(dateFilter.value.from).getTime() : undefined;
    const maxTime = dateFilter.value.to ? new Date(dateFilter.value.to).getTime() : undefined;
    
    return {
        chart: {
            type: 'line',
            zoomType: 'x',
            backgroundColor: '#1f2937',
            height: '',
            animation: true,
        },
        title: {
            text: null,
        },
        credits: {
            enabled: false
        },
        xAxis: {
            type: 'datetime',
            title: { 
                text: 'Timeline', 
                style: { color: '#9ca3af', fontWeight: 'bold' } 
            },
            labels: { 
                style: { color: '#d1d5db' },
                format: '{value:%e %b %H:%M}'
            },
            gridLineColor: '#374151',
            lineColor: '#4b5563',
            min: minTime,
            max: maxTime,
        },
        yAxis: {
            title: { 
                text: 'Alert Status', 
                style: { color: '#9ca3af', fontWeight: 'bold' } 
            },
            labels: {
                style: { color: '#d1d5db' },
                formatter: function() {
                    return this.value === 1 ? 'Alert' : 'None';
                }
            },
            min: 0,
            max: 1.5,
            tickPositions: [0, 1],
            gridLineColor: '#374151',
        },
        tooltip: {
            backgroundColor: '#111827',
            borderColor: '#4b5563',
            style: { color: '#f3f4f6' },
            useHTML: true,
            formatter: function() {
                const alertData = this.point.options.alertDetails;
                
                if (this.y === 1 && alertData) {
                    const time = Highcharts.dateFormat('%A, %b %e, %Y, %H:%M:%S', this.x);
                    return `
                        <div style="padding: 8px;">
                            <div style="font-size: 11px; color: #9ca3af;">${time}</div>
                            <div style="margin-top: 4px;">
                                <span style="color:${this.point.color}">●</span>
                                <strong>${this.series.name}</strong>
                            </div>
                            <div style="margin-top: 4px; font-size: 11px; color: #fbbf24;">
                                🔔 Alert Detected
                            </div>
                            <div style="margin-top: 2px; font-size: 10px; color: #9ca3af;">
                                Click for details
                            </div>
                        </div>
                    `;
                }
                return `<div style="padding: 8px;"><strong>${this.series.name}</strong>: No Alert</div>`;
            }
        },
        legend: {
            enabled: false
        },
        plotOptions: {
            series: {
                step: 'left',
                lineWidth: 2,
                marker: { 
                    enabled: false,
                    states: {
                        hover: { enabled: true, radius: 5 }
                    }
                },
                states: {
                    hover: { lineWidthPlus: 1 }
                },
                point: {
                    events: {
                        click: function() {
                            if (this.y === 1 && this.options.alertDetails) {
                                handlePointClick(this.options.alertDetails);
                            }
                        }
                    }
                }
            }
        },
        series: chartSeriesData.value
    };
});

// --- ACTIONS ---

const applyFilters = () => {
    if (!dateFilter.value.from || !dateFilter.value.to) {
        alert('Please select both start and end dates');
        return;
    }
    
    const from = new Date(dateFilter.value.from).toISOString();
    const to = new Date(dateFilter.value.to).toISOString();
    emit('refetch-alerts', props.projectId, from, to);
};

const toggleAoiSelection = (aoiId) => {
    const index = selectedAoiIds.value.indexOf(aoiId);
    if (index > -1) {
        selectedAoiIds.value.splice(index, 1);
    } else {
        selectedAoiIds.value.push(aoiId);
    }
    
    // Auto-adjust algorithm selection based on available algorithms
    selectedAlgoIds.value = selectedAlgoIds.value.filter(algoId => 
        availableAlgorithms.value.some(a => a.algo_id === algoId)
    );
};

const toggleAlgoSelection = (algoId) => {
    const index = selectedAlgoIds.value.indexOf(algoId);
    if (index > -1) {
        selectedAlgoIds.value.splice(index, 1);
    } else {
        selectedAlgoIds.value.push(algoId);
    }
};

const handlePointClick = (alertDetails) => {
    currentAlertDetails.value = alertDetails;
    showAlertModal.value = true;
};

const selectAllAois = () => {
    selectedAoiIds.value = props.allAois.map(a => a.aoi_id);
};

const deselectAllAois = () => {
    selectedAoiIds.value = [];
};

const selectAllAlgos = () => {
    selectedAlgoIds.value = availableAlgorithms.value.map(a => a.algo_id);
};

const deselectAllAlgos = () => {
    selectedAlgoIds.value = [];
};

// Chart management
const updateChart = () => {
    if (!props.isVisible || !chartElement.value) return;
    
    isLoadingChart.value = true;
    
    setTimeout(() => {
        if (chartSeriesData.value.length > 0) {
            if (chartInstance) {
                chartInstance.update(chartOptions.value, true, true);
            } else {
                chartInstance = Highcharts.chart(chartElement.value, chartOptions.value);
            }
        } else if (chartInstance) {
            chartInstance.destroy();
            chartInstance = null;
        }
        isLoadingChart.value = false;
    }, 100);
};

const destroyChart = () => {
    if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
    }
};

// --- LIFECYCLE ---

onMounted(() => {
    // Set default date range (last 7 days)
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
    
    dateFilter.value.from = sevenDaysAgo.toISOString().split('T')[0];
    dateFilter.value.to = now.toISOString().split('T')[0];
    
    // Initialize selections
    if (props.allAois.length > 0) {
        selectedAoiIds.value = props.allAois.map(a => a.aoi_id);
    }
    
    if (uniqueAlgorithms.value.length > 0) {
        selectedAlgoIds.value = uniqueAlgorithms.value.map(a => a.algo_id);
    }
});

onBeforeUnmount(() => {
    destroyChart();
});

// Watch for changes
watch(() => props.isVisible, (newVal) => {
    if (!newVal) {
        destroyChart();
    } else {
        updateChart();
    }
});

watch([chartSeriesData, () => props.isVisible], () => {
    if (props.isVisible) {
        updateChart();
    }
}, { deep: true });

watch(() => props.allAois, (newAois) => {
    if (newAois.length > 0 && selectedAoiIds.value.length === 0) {
        selectedAoiIds.value = newAois.map(a => a.aoi_id);
    }
}, { immediate: true });

watch(uniqueAlgorithms, (newAlgos) => {
    if (newAlgos.length > 0 && selectedAlgoIds.value.length === 0) {
        selectedAlgoIds.value = newAlgos.map(a => a.algo_id);
    }
}, { immediate: true });
</script>

<template>
    <div v-if="isVisible" 
         class="fixed overflow-y-auto bottom-0 left-0 right-0 bg-gray-800 shadow-2xl border-t-4 border-cyan-500 transition-all duration-300 z-[10000]"
         style="height: 55vh; min-height: 400px;">
        
        <!-- Close Button -->
        <button @click="$emit('close')" 
                class="absolute top-0 right-0 text-red-400 hover:text-red-300 text-3xl font-bold z-20 w-8 h-8 flex items-center justify-center"
                title="Close Panel">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" stroke-width="2"/>
  <line x1="20" y1="4" x2="4" y2="20" stroke="currentColor" stroke-width="2"/>
</svg>
        </button>

        <!-- Main Content -->
        <div class="flex flex-col  p-3 overflow-y-auto">
            
            <!-- Controls Section -->
             <div class="flex-shrink-0 flex-column">
                <div class="flex justify-between items-center">
                        <label class="text-gray-300 text-sm font-semibold">Select AOIs:</label>
                        
                </div>
                <div class="flex flex-wrap gap-1 overflow-y-auto">
                        <label v-for="aoi in allAois" 
                               :key="aoi.aoi_id"
                               class="flex items-center space-x-1 text-sm text-gray-300 cursor-pointer hover:text-white px-2 rounded-full transition-colors">
                            <input type="checkbox" 
                                   :value="aoi.aoi_id" 
                                   :checked="selectedAoiIds.includes(aoi.aoi_id)"
                                   @change="toggleAoiSelection(aoi.aoi_id)"
                                   class="rounded text-cyan-500 bg-gray-700 border-gray-600 focus:ring-cyan-500">
                            <span class="truncate">{{ aoi.name }}</span>
                        </label>
                </div>
                

                
                <!-- Date Filter Row -->
                <div class=" flex flex-row-reverse rounded-lg right-0">
                    <div class="flex flex-row gap-1 items-center">
                        <input type="date" 
                               v-model="dateFilter.from" 
                               class="bg-gray-600 text-white px-1 rounded text-sm">
                        <span class="text-gray-400">to</span>
                        <input type="date" 
                               v-model="dateFilter.to" 
                               class="bg-gray-600 text-white px-1 rounded text-sm">
                        <button @click="applyFilters" 
                                class="bg-blue-600 hover:bg-blue-700 text-white py-1 px-2 rounded-lg text-sm font-semibold">
                            Apply
                        </button>
                    </div>
                </div>
            </div>

            <!-- Chart Area -->
            <div class="flex-grow min-h-0  mb-3 bg-gray-900 rounded-lg p-2 relative">
                <div v-if="isLoadingChart" 
                     class="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75 z-10">
                    <div class="text-cyan-400 text-lg">Loading chart...</div>
                </div>
                
                <div ref="chartElement" 
                     v-show="chartSeriesData.length > 0 && !isLoadingChart"
                     class="w-full h-[30vh] max-h-2/3">
                </div>
                
                <div v-if="!isLoadingChart && chartSeriesData.length === 0" 
                     class="flex items-center justify-center text-gray-400 text-center">
                    <div>
                        <svg class="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z">
                            </path>
                        </svg>
                        <p class="text-lg font-semibold">No Data to Display</p>
                        <p class="text-sm mt-2">
                            {{ props.projectAlerts.length === 0 
                                ? 'No alerts found for this project' 
                                : 'Select AOIs and Algorithms to view alerts' }}
                        </p>
                    </div>
                </div>
            </div>

            <!-- Algorithm Legend -->
            <div class="flex-shrink-0 bg-gray-700 rounded-lg p-1">
                <div class="flex justify-between items-center mb-1">
                    <label class="text-gray-300 text-sm font-semibold">Algorithms:</label>
                    <!-- <div class="flex gap-2">
                        <button @click="selectAllAlgos" 
                                class="text-xs bg-cyan-600 hover:bg-cyan-700 text-white px-2 py-1 rounded">
                            All
                        </button>
                        <button @click="deselectAllAlgos" 
                                class="text-xs bg-gray-600 hover:bg-gray-500 text-white px-2 py-1 rounded">
                            None
                        </button>
                    </div> -->
                </div>
                <div class="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                    <label v-for="algo in availableAlgorithms" 
                           :key="algo.algo_id"
                           class="flex items-center space-x-2 text-sm cursor-pointer transition-all"
                           :class="selectedAlgoIds.includes(algo.algo_id) ? 'text-white' : 'text-gray-400'"
                           :title="algo.description">
                        <input type="checkbox" 
                               :value="algo.algo_id" 
                               :checked="selectedAlgoIds.includes(algo.algo_id)"
                               @change="toggleAlgoSelection(algo.algo_id)"
                               class="rounded text-cyan-500 bg-gray-700 border-gray-600 focus:ring-cyan-500">
                        <div class="w-3 h-3 rounded-full" :style="{ backgroundColor: algo.color }"></div>
                        <span class="font-medium">{{ algo.algo_id }}</span>
                    </label>
                </div>
            </div>
        </div>
    </div>
    
    <!-- Alert Details Modal -->
    <div v-if="showAlertModal && currentAlertDetails" 
         class="fixed inset-0 bg-black bg-opacity-70 z-[30000] flex justify-center items-center p-4"
         @click.self="showAlertModal = false">
        <div class="bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-2xl relative border-2 border-cyan-500 max-h-[80vh] overflow-y-auto">
            <button @click="showAlertModal = false" 
                    class="absolute top-3 right-3 text-red-400 hover:text-red-300 text-3xl font-bold">
                &times;
            </button>
            
            <h3 class="text-2xl text-white font-bold mb-4 border-b border-gray-700 pb-3">
                🔔 Alert Details
            </h3>
            
            <div class="space-y-4">
                <div class="bg-gray-700 p-4 rounded-lg">
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <p class="text-gray-400 text-sm">Project</p>
                            <p class="text-white font-semibold">{{ currentAlertDetails.project_name }}</p>
                        </div>
                        <div>
                            <p class="text-gray-400 text-sm">AOI</p>
                            <p class="text-white font-semibold">{{ currentAlertDetails.aoi_name }}</p>
                        </div>
                        <div>
                            <p class="text-gray-400 text-sm">Algorithm</p>
                            <p class="text-cyan-400 font-semibold">{{ currentAlertDetails.algoId }}</p>
                        </div>
                        <div>
                            <p class="text-gray-400 text-sm">Timestamp</p>
                            <p class="text-white font-semibold">
                                {{ new Date(currentAlertDetails.timestamp).toLocaleString() }}
                            </p>
                        </div>
                    </div>
                </div>
                
                <div class="bg-gray-900 p-4 rounded-lg">
                    <p class="text-gray-400 text-sm mb-2">Alert Message:</p>
                    <pre class="bg-gray-800 p-3 rounded text-sm text-yellow-300 whitespace-pre-wrap overflow-x-auto">{{ JSON.stringify(currentAlertDetails.message, null, 2) }}</pre>
                </div>
            </div>
            
            <button @click="showAlertModal = false" 
                    class="mt-6 w-full bg-cyan-600 hover:bg-cyan-700 text-white py-3 rounded-lg font-semibold">
                Close
            </button>
        </div>
    </div>
</template>

<style scoped>
/* Custom scrollbar styling */
.overflow-y-auto::-webkit-scrollbar {
    width: 6px;
    height: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
    background: #1f2937;
    border-radius: 3px;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
    background: #4b5563;
    border-radius: 3px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
    background: #6b7280;
}
</style>