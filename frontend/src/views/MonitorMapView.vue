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
const activeAoiDetails = ref(null); // Single clicked AOI
const mapKey = ref(0);
const alertTimeRange = ref({ from: null, to: null });

onMounted(async () => {
  try {
    const data = await apiClient.getProjectDetails(parseInt(props.id));
    project.value = data;
    console.log('[MonitorMapView] Project loaded:', data);
  } catch (error) {
    console.error("Error loading project for monitoring:", error);
    router.push('/');
  } finally {
    isLoading.value = false;
  }
});

const handleAoiClick = async (aoi) => {
  console.log('[MonitorMapView] AOI clicked:', aoi);
  activeAoiDetails.value = aoi;
  showVizPanel.value = true;
  await fetchAlertsForAoi(aoi.aoi_id);
};

const closeVizPanel = () => {
    showVizPanel.value = false;
    activeAoiDetails.value = null;
    projectAlerts.value = [];
    alertTimeRange.value = { from: null, to: null };
    mapKey.value++; 
};

const fetchAlertsForAoi = async (aoiId) => {
  try {
    console.log('[MonitorMapView] Fetching alerts for AOI:', aoiId, 'Project:', project.value.id);
    const { alerts, timeRange } = await apiClient.getProjectAlerts(project.value.id, aoiId);
    projectAlerts.value = alerts;
    alertTimeRange.value = timeRange;
    console.log('[MonitorMapView] Alerts loaded:', alerts.length);
  } catch (e) {
    console.error("Failed to load alerts:", e);
  }
};

</script>

<template>
  <div class="monitor-map-view h-[85vh] flex flex-col">

    <!-- Loading State -->
    <div v-if="isLoading" class="flex-grow flex items-center justify-center text-white">
      Loading Monitor Data...
    </div>

    <!-- Main Content -->
    <div v-else-if="project" class="flex-grow h-[80vh] mt-[1.4vh] relative min-h-0">
      <div class="h-full inset-0">
        <MapVisualization 
          :key="mapKey"
          :aois-to-display="project.aois" 
          :is-monitor-mode="true" 
          @aoi-clicked="handleAoiClick" 
        />
      </div>

      <!-- FIXED: Pass selected-aoi instead of all-aois -->
      <AoiVizPanel
        :is-visible="showVizPanel"
        :project-id="project.id"
        :selected-aoi="activeAoiDetails"
        :project-alerts="projectAlerts"
        :alert-time-range="alertTimeRange"
        @close="closeVizPanel"
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