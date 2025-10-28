<script setup lang="ts">
import { ProjectFormData } from '@/classes/ProjectFormData';
import { AreaOfInterestDraft, GeoJsonPolygon } from '@/classes/AreaOfInterestDraft';
import MapVisualization from '@/components/map/MapVisualization.vue';
import { ref } from 'vue';

const props = defineProps<{
  projectData: ProjectFormData;
}>();

const currentAoiName = ref('');
// Initialize counter based on existing drafts (important for update mode)
let aoiCounter = props.projectData.aoiDrafts.length > 0 
                 ? Math.max(...props.projectData.aoiDrafts.map(a => a.clientAoiId)) + 1 
                 : 1;


// The main method called by the MapVisualization component when a geometry is drawn
const handleAOISubmission = (data: { geometry: GeoJsonPolygon, geometryType: string, buffer: number }) => {
    if (!currentAoiName.value) {
        alert('Please enter a name for your AOI first.');
        return;
    }
    
    // 1. Instantiate the AreaOfInterestDraft class
    const newAOI = new AreaOfInterestDraft(
        currentAoiName.value,
        data.geometry,
        aoiCounter,
        data.geometryType as any,
        data.buffer
    );
    
    const updatedAoiDrafts = [...props.projectData.aoiDrafts, newAOI];

    props.projectData.aoiDrafts = updatedAoiDrafts; // Force-updates the reactive property
    // 2. Add the new object to the ProjectFormData class (This is the critical line)
    
    // 3. Increment counter and reset UI input
    aoiCounter++;
    currentAoiName.value = ''; 
    alert(`AOI draft "${newAOI.name}" saved.`);
};

const removeAOI = (clientAoiId: number) => {
    props.projectData.aoiDrafts = props.projectData.aoiDrafts.filter(
        aoi => aoi.clientAoiId !== clientAoiId
    );
};
</script>



<template>
  <div>
    <h3>Step 2: Define Areas of Interest (AOI)</h3>
    
    <div class="form-group mb-4">
        <label class="text-white">AOI Name:</label>
        <input type="text" v-model="currentAoiName" placeholder="e.g., Farm Field 1 or Rio Grande Buffer Zone" required class="w-full p-2 bg-gray-700 text-white rounded border border-gray-600">
    </div>

    <div class="map-wrapper">
      <MapVisualization 
        @aoi-drawn="handleAOISubmission" 
        :aois-to-display="projectData.aoiDrafts"
        :is-monitor-mode="false"
      />
    </div>

    <h4 class="text-lg font-semibold mt-6 text-cyan-400">Draft AOIs ({{ projectData.aoiDrafts.length }})</h4>
    <div class="aoi-list-manager space-y-2 max-h-40 overflow-y-auto">
        <div v-for="aoi in projectData.aoiDrafts" :key="aoi.clientAoiId" class="aoi-draft flex justify-between items-center p-3 bg-gray-700 rounded shadow-md">
            <span>
                {{ aoi.name }} 
                <span :class="{'text-yellow-400': aoi.bufferDistance}" class="text-sm ml-2">({{ aoi.geometryType }})</span>
                <span v-if="aoi.bufferDistance" class="text-sm text-green-400 ml-2"> (+{{ aoi.bufferDistance }}m buffer)</span>
            </span>
            <button @click="removeAOI(aoi.clientAoiId)" class="remove-btn bg-red-600 hover:bg-red-700 text-white p-1 rounded">Remove</button>
        </div>
        <p v-if="projectData.aoiDrafts.length === 0" class="text-center text-gray-400 p-4">Draw an AOI on the map above to begin.</p>
    </div>
  </div>
</template>



<style scoped>
.map-container { height: 400px; width: 100%; margin-bottom: 20px; border: 1px solid #ccc; }
.aoi-draft { display: flex; justify-content: space-between; padding: 8px; border-bottom: 1px dotted #eee; }
.remove-btn { background-color: #f44336; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; }
</style>