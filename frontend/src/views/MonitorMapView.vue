<!-- MonitorMapView.vue - Fully Responsive -->

<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ApiClient } from '@/api/ApiClient.js';
import MapVisualization from '@/components/map/MapVisualization.vue';
import AoiVizPanel from '@/components/map/AoiVizPanel.vue';

const props = defineProps({
    id: String,
});

const router = useRouter();
const apiClient = ApiClient.getInstance();

const isLoading = ref(true);
const project = ref(null);
const projectAlerts = ref([]);
const showVizPanel = ref(false);
const activeAoiDetails = ref(null);
const mapKey = ref(0);

onMounted(async () => {
    try {
        const data = await apiClient.getProjectDetails(parseInt(props.id));
        project.value = data;
        projectAlerts.value = await apiClient.getProjectAlerts(data.id); 
    } catch (error) {
        console.error("Error loading project for monitoring:", error);
        alert('Could not load project for monitoring.');
        router.push('/');
    } finally {
        isLoading.value = false;
    }
});

const handleAoiClick = (aoi) => {
    activeAoiDetails.value = aoi;
    showVizPanel.value = true;
};

const closeVizPanel = () => {
    showVizPanel.value = false;
    mapKey.value++; 
};

const goBack = () => {
    
        // If on the first step, go back to the home page
        router.push('/projects/manage?mode=monitor');
};

const refetchAlerts = async (projectId, fromDate, toDate) => {
    try {
        projectAlerts.value = await apiClient.getProjectAlerts(projectId, fromDate, toDate);
    } catch (e) {
        console.error("Failed to refetch alerts:", e);
    }
};
</script>

<template>
  <div class="monitor-map-view h-full flex flex-col">
    
    <!-- Header - Minimal padding -->
    <div class="flex-shrink-0 px-2 py-1 sm:px-4 sm:py-2">
      <div v-if="project" class="flex items-center justify-between">
        <button
                    class="text-cyan-400 hover:text-cyan-300 transition duration-150 py-1 px-2 rounded flex items-center text-sm sm:text-base"
                    @click="goBack">
                    <svg class="w-5 h-5 sm:w-5 sm:h-5 inline-block mr-1" fill="none" stroke="currentColor"
                        viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                    </svg>

                </button>
        <div>
          <h2 class="text-lg sm:text-xl font-bold text-white truncate">{{ project.project_name }}</h2>
          <p class="text-xs sm:text-sm text-green-400">AOIs: {{ project.aois.length }}</p>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="flex-grow flex items-center justify-center text-white">
      Loading Monitor Data...
    </div>

    <!-- Main Content -->
    <div v-else-if="project" class="flex-grow relative min-h-0">
      <div class="absolute inset-0">
        <MapVisualization 
          :key="mapKey"
          :aois-to-display="project.aois" 
          :is-monitor-mode="true" 
          @aoi-clicked="handleAoiClick" 
        />
      </div>

      <!-- Visualization Panel -->
      <AoiVizPanel 
        :is-visible="showVizPanel" 
        :project-id="project.id" 
        :all-aois="project.aois"
        :project-alerts="projectAlerts" 
        @close="closeVizPanel" 
        @refetch-alerts="refetchAlerts" 
      />
    </div>

    <!-- Error State -->
    <div v-else class="flex-grow flex items-center justify-center text-red-400">
      Project not found.
    </div>
  </div>
</template>

<style scoped>
.monitor-map-view {
  background-color: #111827;
}
</style>