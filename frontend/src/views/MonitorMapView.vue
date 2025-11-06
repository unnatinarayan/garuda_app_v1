<!-- MonitorMapView.vue  -->



<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ApiClient } from '@/api/ApiClient.js';
import MapVisualization from '@/components/map/MapVisualization.vue';
import AoiVizPanel from '@/components/map/AoiVizPanel.vue'; // <-- NEW IMPORT

const props = defineProps({
    id: String, // The project ID from the route parameter
});

const router = useRouter();
const apiClient = ApiClient.getInstance();

const isLoading = ref(true);
const project = ref(null);
const projectAlerts = ref([]); // <-- NEW STATE: Holds all alerts for this project

// --- NEW STATE FOR VISUALIZATION PANEL ---
const showVizPanel = ref(false);
const activeAoiDetails = ref(null);
// -----------------------------------------


/**
 * MOCK ALERT DATA FETCH: In a real app, this would be an API call to 
 * /api/projects/:id/alerts that joins alerts, mappings, and aois.
 */
const fetchAlerts = (projectId, aois) => {
    // Simulate fetching alerts based on the AOIs in the project.
    console.log(`[Monitor] Simulating alert fetch for project ${projectId}.`);
    
    const alerts = [];
    const now = Date.now();
    
    // Create mock alerts for each mapped algorithm in each AOI
    aois.forEach(aoi => {
        aoi.mappedAlgorithms.forEach((algo, index) => {
            // Generate 3 random alerts per algorithm
            for (let i = 0; i < 3; i++) {
                alerts.push({
                    id: `${aoi.aoi_id}-${algo.algo_id}-${i}`,
                    projectId: projectId,
                    aoiId: aoi.aoi_id,
                    algoId: algo.algo_id,
                    timestamp: new Date(now - (Math.random() * 86400000 * 7)), // Last 7 days
                    message: {
                        detail: `Critical change detected by ${algo.algo_id}`,
                        level: index % 2 === 0 ? 'HIGH' : 'MEDIUM'
                    }
                });
            }
        });
    });
    projectAlerts.value = alerts;
};


onMounted(async () => {
    try {
        const data = await apiClient.getProjectDetails(parseInt(props.id));
        project.value = data;
        
        // 1. Fetch AOI and Alerts data
        fetchAlerts(data.id, data.aois);

    } catch (error) {
        console.error("Error loading project for monitoring:", error);
        alert('Could not load project for monitoring.');
        router.push('/');
    } finally {
        isLoading.value = false;
    }
});

/**
 * Handler for the AOI click event coming from MapVisualization.
 */
const handleAoiClick = (aoi) => {
    activeAoiDetails.value = aoi;
    showVizPanel.value = true;
};

</script>

<template>
  <div class="monitor-map-view">
    <button @click="router.back()" class="btn-back" style="color: aliceblue;">← Back to Projects</button>
    
    <div v-if="isLoading" class="loading">Loading Monitor Data for Project ID: {{ props.id }}...</div>
    
    <div v-else-if="project" class="map-content">
      <h2>Monitoring: {{ project.project_name }}</h2>
      <p class="aoi-count">AOIs Under Watch: {{ project.aois.length }}</p>
      
      <div class="map-container">
        <MapVisualization 
            :aois-to-display="project.aois" 
            :is-monitor-mode="true" 
            @aoi-clicked="handleAoiClick" 
        />
      </div>
      
      <AoiVizPanel 
          :is-visible="showVizPanel" 
          :aoi-details="activeAoiDetails"
          :project-alerts="projectAlerts"
          @close="showVizPanel = false" 
      />

    </div>

    <div v-else class="error">Project not found.</div>
  </div>
</template>

<style scoped>
.monitor-map-view { padding: 20px; }
.btn-back { margin-bottom: 20px; padding: 8px 15px; cursor: pointer; }
.loading, .error { text-align: center; padding: 50px; font-size: 1.2em; }
/* Ensure map container allows space for the fixed visualization panel */
.map-container { 
    height: 600px; 
    width: 100%; 
    border: 1px solid #ccc; 
    margin-top: 20px; 
    /* Add padding bottom equal to or greater than the height of the viz panel (40vh) */
    padding-bottom: 45vh; 
} 
.aoi-count { font-weight: bold; color: #4CAF50; }
</style>




















<!-- 
<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ApiClient } from '@/api/ApiClient.js';
import MapVisualization from '@/components/map/MapVisualization.vue';

const props = defineProps({
    id: String, // The project ID from the route parameter
});

const router = useRouter();
const apiClient = ApiClient.getInstance();

const isLoading = ref(true);
const project = ref(null);

onMounted(async () => {
    try {
        // Fetch the detailed project data needed for visualization
        const data = await apiClient.getProjectDetails(parseInt(props.id));
        project.value = data;
    } catch (error) {
        alert('Could not load project for monitoring.');
        router.push('/');
    } finally {
        isLoading.value = false;
    }
});

// NOTE: In a complete application, the MapVisualization component would 
// be extended here to include logic for adding GeoJSON layers (the AOIs)
// and potentially real-time data or alerts.
</script>

<template>
  <div class="monitor-map-view">
    <button @click="router.back()" class="btn-back" style="color: aliceblue;">← Back to Projects</button>
    
    <div v-if="isLoading" class="loading">Loading Monitor Data for Project ID: {{ props.id }}...</div>
    
    <div v-else-if="project" class="map-content">
      <h2>Monitoring: {{ project.project_name }}</h2>
      <p class="aoi-count">AOIs Under Watch: {{ project.aois.length }}</p>
      
      <div class="map-container">
        <MapVisualization :aois-to-display="project.aois" :is-monitor-mode="true" />
      </div>
    </div>

    <div v-else class="error">Project not found.</div>
  </div>
</template>

<style scoped>
.monitor-map-view { padding: 20px; }
.btn-back { margin-bottom: 20px; padding: 8px 15px; cursor: pointer; }
.loading, .error { text-align: center; padding: 50px; font-size: 1.2em; }
.map-container { height: 600px; width: 100%; border: 1px solid #ccc; margin-top: 20px; }
.aoi-count { font-weight: bold; color: #4CAF50; }
</style> -->
