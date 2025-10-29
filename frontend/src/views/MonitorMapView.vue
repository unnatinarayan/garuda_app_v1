<!-- // MonitorMapView.vue  -->

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ApiClient } from '@/api/ApiClient';
import MapVisualization from '@/components/map/MapVisualization.vue';

const props = defineProps<{
    id: string; // The project ID from the route parameter
}>();

const router = useRouter();
const apiClient = ApiClient.getInstance();

const isLoading = ref(true);
const project = ref<any>(null);

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
</style>