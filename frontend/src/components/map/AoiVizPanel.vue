<!-- frontend/src/components/map/AoiVizPanel.vue - COMPLETE WITH DEBUGGING -->
<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import Highcharts from 'highcharts';

const props = defineProps({
  isVisible: Boolean,
  projectId: [Number, String],
  selectedAoi: { type: Object, default: null },
  projectAlerts: { type: Array, default: () => [] },
  alertTimeRange: { type: Object, default: () => ({ from: null, to: null }) }
});

const emit = defineEmits(['close']);

// --- STATE ---
const selectedChannelIds = ref([]);
const CHANNEL_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
const channelColorMap = ref({});

const chartElement = ref(null);
let chartInstance = null;

const showAlertModal = ref(false);
const currentAlertDetails = ref(null);
const isLoadingChart = ref(false);

// --- COMPUTED DATA ---

// Get unique alert channels for the selected AOI
const availableChannels = computed(() => {
    if (!props.selectedAoi || !props.selectedAoi.subscriptions) {
        console.log('[AoiVizPanel] No selectedAoi or subscriptions');
        return [];
    }
    
    const channels = new Map();
    let colorIndex = 0;
    
    props.selectedAoi.subscriptions.forEach(sub => {
        if (!channels.has(sub.channelId)) {
            const color = CHANNEL_COLORS[colorIndex % CHANNEL_COLORS.length];
            channels.set(sub.channelId, { 
                channelId: sub.channelId,
                channelName: sub.channelName,
                category: sub.category,
                color: color
            });
            channelColorMap.value[sub.channelId] = color;
            colorIndex++;
        }
    });
    
    const result = Array.from(channels.values());
    console.log('[AoiVizPanel] Available channels:', result);
    return result;
});

// Process alerts into series data for Highcharts
const chartSeriesData = computed(() => {
    console.log('[AoiVizPanel] Computing chart data...', {
        hasAlerts: props.projectAlerts?.length > 0,
        alertCount: props.projectAlerts?.length,
        hasAoi: !!props.selectedAoi,
        selectedChannels: selectedChannelIds.value.length
    });

    if (!props.projectAlerts || props.projectAlerts.length === 0) {
        console.log('[AoiVizPanel] No alerts');
        return [];
    }

    if (!props.selectedAoi || selectedChannelIds.value.length === 0) {
        console.log('[AoiVizPanel] No AOI or no channels selected');
        return [];
    }

    const dataMap = new Map();
    
    // Initialize series for each selected channel
    const selectedChannels = availableChannels.value.filter(ch => 
        selectedChannelIds.value.includes(ch.channelId)
    );
    
    console.log('[AoiVizPanel] Initializing series for channels:', selectedChannels);
    
    selectedChannels.forEach(channel => {
        const seriesId = `${props.selectedAoi.aoi_id}_${channel.channelId}`;
        dataMap.set(seriesId, {
            id: seriesId,
            name: `${props.selectedAoi.name} / ${channel.channelName}`,
            data: [],
            color: channel.color,
            aoiId: props.selectedAoi.aoi_id,
            channelId: channel.channelId,
            type: 'line',
            step: 'left',
            lineWidth: 2,
        });
    });
    
    // Filter alerts for selected AOI and channels
    const filteredAlerts = props.projectAlerts.filter(alert => {
        const match = alert.aoiId === props.selectedAoi.aoi_id && 
               selectedChannelIds.value.includes(alert.channelId);
        if (match) {
            console.log('[AoiVizPanel] Alert matched:', alert);
        }
        return match;
    });
    
    console.log('[AoiVizPanel] Filtered alerts:', filteredAlerts.length);
    
    // Populate series with alert data
    filteredAlerts.forEach(alert => {
        const seriesId = `${alert.aoiId}_${alert.channelId}`;
        const series = dataMap.get(seriesId);
        
        if (series) {
            const timestamp = new Date(alert.timestamp).getTime();
            
            // Create pulse
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
        series.data.sort((a, b) => {
            const aTime = typeof a === 'object' ? a.x : a[0];
            const bTime = typeof b === 'object' ? b.x : b[0];
            return aTime - bTime;
        });
        
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
    
    const result = allSeries.filter(s => s.data.length > 2);
    console.log('[AoiVizPanel] Final series count:', result.length);
    return result;
});



// Highcharts configuration
const chartOptions = computed(() => {
    const minTime = props.alertTimeRange?.from ? props.alertTimeRange.from - 1 * 60 * 1000 : undefined;
    const maxTime = props.alertTimeRange?.to ? props.alertTimeRange.to + 1 * 60 * 1000 : undefined;
    const chartHeight = window.innerHeight * 0.30;
    
    return {
        chart: {
            type: 'line',
            zoomType: 'x',
            backgroundColor: '#1f2937',
            height: chartHeight,
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
            min: minTime,
            max: maxTime,
            title: {
                text: 'Timeline',
                style: { color: '#9ca3af', fontWeight: 'bold' }
            },
            labels: { style: { color: '#d1d5db' }, format: '{value:%e %b %H:%M}' },
            gridLineColor: '#374151'
        },
        yAxis: {
            title: {
                text: 'Alert Status',
                style: { color: '#9ca3af', fontWeight: 'bold' }
            },
            labels: {
                style: { color: '#d1d5db' },
                formatter: function () {
                    return this.value === 1 ? 'Yes' : 'No';
                }
            },
            min: 0,
            max: 1.5,
            tickPositions: [0, 1],
            gridLineColor: '#374151'
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

const toggleChannelSelection = (channelId) => {
    const index = selectedChannelIds.value.indexOf(channelId);
    if (index > -1) {
        selectedChannelIds.value.splice(index, 1);
    } else {
        selectedChannelIds.value.push(channelId);
    }
    console.log('[AoiVizPanel] Selected channels:', selectedChannelIds.value);
};

const handlePointClick = (alertDetails) => {
    currentAlertDetails.value = alertDetails;
    showAlertModal.value = true;
};

const selectAllChannels = () => {
    selectedChannelIds.value = availableChannels.value.map(ch => ch.channelId);
};

const deselectAllChannels = () => {
    selectedChannelIds.value = [];
};

// Chart management
const updateChart = () => {
    if (!props.isVisible || !chartElement.value) {
        console.log('[AoiVizPanel] Skipping chart update - not visible or no element');
        return;
    }
    
    isLoadingChart.value = true;
    
    setTimeout(() => {
        console.log('[AoiVizPanel] Updating chart with series count:', chartSeriesData.value.length);
        
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
    console.log('[AoiVizPanel] Mounted');
});

onBeforeUnmount(() => {
    destroyChart();
});

// Watch for changes
watch(() => props.isVisible, (newVal) => {
    console.log('[AoiVizPanel] Visibility changed:', newVal);
    if (!newVal) {
        destroyChart();
    } else {
        updateChart();
    }
});

watch([selectedChannelIds], () => {
    console.log('[AoiVizPanel] Selected channels changed');
    if (props.isVisible) {
        updateChart();
    }
}, { deep: true });

watch([() => props.projectAlerts, () => props.alertTimeRange], () => {
    console.log('[AoiVizPanel] Alerts or time range changed');
    if (props.isVisible) updateChart();
}, { deep: true });

watch([chartSeriesData, () => props.isVisible], () => {
    console.log('[AoiVizPanel] Chart data or visibility changed');
    if (props.isVisible) {
        updateChart();
    }
}, { deep: true });

watch(() => props.selectedAoi, (newAoi) => {
    console.log('[AoiVizPanel] Selected AOI changed:', newAoi);
    if (newAoi) {
        selectedChannelIds.value = availableChannels.value.map(ch => ch.channelId);
        console.log('[AoiVizPanel] Auto-selected channels:', selectedChannelIds.value);
        if (props.isVisible) {
            updateChart();
        }
    }
}, { immediate: true, deep: true });

watch(availableChannels, (newChannels) => {
    console.log('[AoiVizPanel] Available channels changed:', newChannels);
    if (newChannels.length > 0 && selectedChannelIds.value.length === 0) {
        selectedChannelIds.value = newChannels.map(ch => ch.channelId);
        console.log('[AoiVizPanel] Auto-selected channels:', selectedChannelIds.value);
    }
}, { immediate: true });
</script>

<template>
    <div v-if="isVisible" 
         class="fixed bottom-0 left-0 right-0 bg-gray-800 shadow-2xl border-t-4 border-cyan-500 transition-all duration-300"
         style=" z-index: 1000;">
        
        <!-- Close Button -->
        <button @click="$emit('close')" 
                class="absolute top-2 right-2 text-red-400 hover:text-red-300 text-3xl font-bold z-20 w-8 h-8 flex items-center justify-center"
                title="Close Panel">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" stroke-width="2"/>
                <line x1="20" y1="4" x2="4" y2="20" stroke="currentColor" stroke-width="2"/>
            </svg>
        </button>

        <!-- Main Content -->
        <div class="flex flex-col">
            <!-- AOI Title -->
            <div v-if="selectedAoi" class="flex-shrink-0 h-[6vh] bg-gray-700 rounded-lg p-2">
                <h3 class="text-cyan-400 font-bold text-lg">
                    {{ selectedAoi.name }}
                </h3>
            </div>

            <!-- Chart Area -->
            <div class=" bg-gray-900 rounded-lg p-2 h-[32vh] relative overflow-hidden">
                <div v-if="isLoadingChart" 
                     class=" inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75 z-10">
                    <div class="text-cyan-400 text-lg">Loading chart...</div>
                </div>
                
                <div ref="chartElement" 
                     v-show="chartSeriesData.length > 0 && !isLoadingChart"
                     class="w-full h-[30vh]">
                </div>
                
                <div v-if="!isLoadingChart && chartSeriesData.length === 0" 
                     class="flex items-center justify-center text-gray-400 text-center h-[32vh]">
                    <div>
                        <svg class="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z">
                            </path>
                        </svg>
                        <p class="text-lg font-semibold">No Data to Display</p>
                        <p class="text-sm mt-2">
                            {{ projectAlerts.length === 0 
                                ? 'No alerts found for this AOI' 
                                : 'Select alert channels to view alerts' }}
                        </p>
                    </div>
                </div>
            </div>

            <!-- Alert Channel Legend -->
            <div class="flex-shrink-0 bg-gray-700 h-[10vh] my-1 rounded-lg p-2 max-h-[120px] overflow-hidden flex flex-col">
                <div class="flex justify-between h-[2vh] items-center">
                    <label class="text-gray-300 text-sm font-semibold">Alert Channels:</label>
                </div>
                <div class="flex h-[6vhv] p-2 flex-wrap gap-2 overflow-y-auto">
                    <label v-for="channel in availableChannels" 
                           :key="channel.channelId"
                           class="flex items-center space-x-2 text-xs cursor-pointer transition-all px-2 py-1 bg-gray-600 rounded whitespace-nowrap"
                           :class="selectedChannelIds.includes(channel.channelId) ? 'text-white ring-2 ring-cyan-500' : 'text-gray-400'"
                           :title="`${channel.category} - ${channel.channelName}`">
                        <input type="checkbox" 
                               :value="channel.channelId" 
                               :checked="selectedChannelIds.includes(channel.channelId)"
                               @change="toggleChannelSelection(channel.channelId)"
                               class="rounded text-cyan-500 bg-gray-700 border-gray-600 focus:ring-cyan-500">
                        <div class="w-3 h-3 rounded-full flex-shrink-0" :style="{ backgroundColor: channel.color }"></div>
                        <span class="font-medium">{{ channel.channelName }}</span>
                        <!-- <span class="text-gray-500">({{ channel.category }})</span> -->
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
                Close
            </button>
            
            <h3 class="text-2xl text-white font-bold mb-4 border-b border-gray-700 pb-3">
                🔔 Alert Details
            </h3>
            
            <div class="space-y-4">
                <div class="bg-gray-700 p-4 rounded-lg">
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <p class="text-gray-400 text-sm">Project</p>
                            <p class="text-white font-semibold">{{ currentAlertDetails.projectName }}</p>
                        </div>
                        <div>
                            <p class="text-gray-400 text-sm">AOI</p>
                            <p class="text-white font-semibold">{{ currentAlertDetails.aoiName }}</p>
                        </div>
                        <div>
                            <p class="text-gray-400 text-sm">Alert Channel</p>
                            <p class="text-cyan-400 font-semibold">{{ currentAlertDetails.channelName }}</p>
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
                    <p class="text-gray-400 text-sm mb-2">Alert Content:</p>
                    <pre class="bg-gray-800 p-3 rounded text-sm text-yellow-300 whitespace-pre-wrap overflow-x-auto">{{ JSON.stringify(currentAlertDetails.message, null, 2) }}</pre>
                </div>
            </div>
            
            <!-- <button @click="showAlertModal = false" 
                    class="mt-6 w-full bg-cyan-600 hover:bg-cyan-700 text-white py-3 rounded-lg font-semibold">
                Close
            </button> -->
        </div>
    </div>
</template>

<style scoped>
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
