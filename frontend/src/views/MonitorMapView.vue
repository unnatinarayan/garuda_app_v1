<!-- MonitorMapView.vue  -->

<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ApiClient } from '@/api/ApiClient.js';
import MapVisualization from '@/components/map/MapVisualization.vue';
import AoiVizPanel from '@/components/map/AoiVizPanel.vue'; // <-- NEW IMPORT
// import HighchartsVue from 'highcharts-vue'; // Import the wrapper

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

const mapKey = ref(0);



onMounted(async () => {
    try {
        const data = await apiClient.getProjectDetails(parseInt(props.id));
        project.value = data;
        
        // CRITICAL: Fetch ALL alerts for the project initially (no date filters yet)
        projectAlerts.value = await apiClient.getProjectAlerts(data.id); 

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
const closeVizPanel = () => {
    showVizPanel.value = false;
    // CRITICAL FIX: Increment key to force destruction and re-initialization of the map component
    mapKey.value++; 
}

const refetchAlerts = async (projectId, fromDate, toDate) => {
    try {
        projectAlerts.value = await apiClient.getProjectAlerts(projectId, fromDate, toDate);
    } catch (e) {
        console.error("Failed to refetch alerts:", e);
    }
}

</script>

<template>
  <div class="monitor-map-view h-full flex flex-col p-4"> 
    
    <div class="flex-shrink-0 mb-4">
      <!-- <button @click="router.back()" class="btn-back" style="color: aliceblue;">← Back to Projects</button> -->
      <div v-if="project" class="mt-2">
        <h2>Monitoring: {{ project.project_name }}</h2>
        <p class="aoi-count">AOIs Under Watch: {{ project.aois.length }}</p>
      </div>
    </div>

    <div v-if="isLoading" class="loading">Loading Monitor Data for Project ID: {{ props.id }}...</div>

    <div v-else-if="project" class="map-and-viz-wrapper flex-grow relative">
      
      <div class="map-container relative h-full"> 
        <MapVisualization 
          :key="mapKey"
          :aois-to-display="project.aois" 
          :is-monitor-mode="true" 
          @aoi-clicked="handleAoiClick" 
        />
      </div>

      <AoiVizPanel 
        :is-visible="showVizPanel" 
        :project-id="project.id" 
        :all-aois="project.aois"
        :project-alerts="projectAlerts" 
        @close="closeVizPanel" 
        @refetch-alerts="refetchAlerts" 
      />
    </div>

    <div v-else class="error">Project not found.</div>
  </div>
</template>

<style scoped>
/* REMOVE most static height/padding styles from MonitorMapView.vue */
.monitor-map-view { 
  /* padding: 20px; is now handled by p-4 in template */
}
.loading, .error { text-align: center; padding: 50px; font-size: 1.2em; }

/* The map-container style is critical to change */
.map-container { 
  /* REMOVE STATIC HEIGHT: height: 600px; */
  /* REMOVE STATIC PADDING: padding-bottom: 45vh; */
  width: 100%; 
  border: 1px solid #ccc; 
  margin-top: 20px; 
} 
.aoi-count { font-weight: bold; color: #4CAF50; }
</style>

<!-- <template>
    <div class="monitor-map-view h-full flex flex-col p-4">

        
        <button @click="router.back()" class="btn-back" style="color: aliceblue;">← Back to Projects</button>

        <div v-if="isLoading" class="loading">Loading Monitor Data for Project ID: {{ props.id }}...</div>

        <div v-else-if="project" class="map-content">
            <h2>Monitoring: {{ project.project_name }}</h2>
            <p class="aoi-count">AOIs Under Watch: {{ project.aois.length }}</p>


            <div class="map-container">
                <MapVisualization :key="mapKey" :aois-to-display="project.aois" :is-monitor-mode="true"
                    @aoi-clicked="handleAoiClick" />
            </div>

            <AoiVizPanel :is-visible="showVizPanel" :project-id="project.id" :all-aois="project.aois"
                :project-alerts="projectAlerts" @close="closeVizPanel" @refetch-alerts="refetchAlerts" />


        </div>

        <div v-else class="error">Project not found.</div>
    </div>
</template> -->

<!-- <style scoped>
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
</style> -->
