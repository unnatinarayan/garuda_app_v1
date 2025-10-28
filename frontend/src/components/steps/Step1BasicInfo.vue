// frontend/src/components/steps/Step1BasicInfo.vue

<script setup lang="ts">
import { type AuxDataDraft } from '@/classes/ProjectFormData';
import { ref } from 'vue';
import { useProjectStore } from '@/stores/ProjectStore'; // Import the store

// We no longer need the prop, we use the store directly
const projectStore = useProjectStore(); 
const projectData = projectStore.projectForm; // Still keep a reference for auxDataDrafts

// Local reactive properties for aux data inputs only
const newAuxKey = ref('');
const newAuxValue = ref('');

const addAuxData = () => {
    if (newAuxKey.value && newAuxValue.value) {
        // Direct mutation on the array property is usually fine
        projectData.auxDataDrafts.push({
            key: newAuxKey.value,
            value: newAuxValue.value
        } as AuxDataDraft);
        newAuxKey.value = '';
        newAuxValue.value = '';
    }
};

const removeAuxData = (key: string) => {
    projectData.auxDataDrafts = projectData.auxDataDrafts.filter(draft => draft.key !== key);
};
</script>


<template>
  <div>
    <h3 class="text-xl font-bold text-white mb-4">Step 1: Project Basic Info</h3>
    
    <div class="form-group mb-4">
      <label class="text-gray-400">Project Name:</label>
      <input type="text" v-model="projectStore.projectName" required class="w-full p-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-cyan-500" />
    </div>
    <div class="form-group mb-4">
      <label class="text-gray-400">Description:</label>
      <textarea v-model="projectStore.description" rows="3" class="w-full p-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-cyan-500"></textarea>
    </div>

    <h4 class="text-lg font-semibold text-cyan-400 mt-6 mb-3">Custom Auxiliary Data (JSONB)</h4>
    <div class="aux-data-entry flex gap-3 mb-4">
        <input type="text" v-model="newAuxKey" placeholder="Key (e.g., Client)" class="p-2 bg-gray-700 text-white rounded border border-gray-600" />
        <input type="text" v-model="newAuxValue" placeholder="Value (e.g., NASA)" class="p-2 bg-gray-700 text-white rounded border border-gray-600" />
        <button @click="addAuxData" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded">Add Field</button>
    </div>
    <div class="aux-list space-y-2">
        <div v-for="draft in projectData.auxDataDrafts" :key="draft.key" class="aux-item flex justify-between p-2 bg-gray-700 rounded border border-gray-600">
            <span class="text-gray-300">{{ draft.key }}: <span class="text-white font-mono">{{ draft.value }}</span></span>
            <button @click="removeAuxData(draft.key as string)" class="text-red-400 hover:text-red-500 font-bold">x</button>
        </div>
    </div>
  </div>
</template>

<style scoped>
.form-group { margin-bottom: 15px; }
label { display: block; margin-bottom: 5px; font-weight: bold; }
input[type="text"], textarea { width: 100%; padding: 8px; box-sizing: border-box; }
.aux-data-entry, .aux-item { display: flex; gap: 10px; margin-bottom: 5px; }
.aux-data-entry input { flex-grow: 1; }
</style>