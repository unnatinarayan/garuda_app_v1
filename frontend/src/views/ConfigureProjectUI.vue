<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useProjectStore } from '@/stores/ProjectStore.js';
import { storeToRefs } from 'pinia';
import "tailwindcss";

const props = defineProps({
   id: String,
});

// Component Imports
import Step1BasicInfo from '@/components/steps/Step1BasicInfo.vue';
import Step2DefineAOI from '@/components/steps/Step2DefineAOI.vue';
import Step3AlgoMapping from '@/components/steps/Step3AlgoMapping.vue';
import Step4AddUsers from '@/components/steps/Step4AddUsers.vue';

const router = useRouter();
const route = useRoute();
const projectStore = useProjectStore();

const { projectForm, projectName, description } = storeToRefs(projectStore);

const isDataLoading = ref(false);
// Removed isMenuMode. The component is ALWAYS in form mode.

// Computed properties rely on the store's state for reactivity
const currentStep = computed(() => projectStore.currentStep);
const isFinalStep = computed(() => currentStep.value === 4);
const isUpdateMode = computed(() => projectForm.value.isUpdateMode);

const projectIdParam = props.id ? parseInt(props.id) : (route.params.id ? parseInt(route.params.id) : null);

onMounted(async () => {
   if (projectIdParam) {
       // If in update mode, load data and jump directly to Step 1
       isDataLoading.value = true;
       try {
           await projectStore.loadProjectForUpdate(projectIdParam);
           projectStore.projectForm.currentStep = 1; // Always start update flow at step 1
       } catch (error) {
           alert('Error loading project: ' + (error).message);
           router.push('/');
       } finally {
           isDataLoading.value = false;
       }
   } else {
       // For new projects, start clean at Step 1
       projectStore.initNewProjectForm();
       projectStore.projectForm.currentStep = 1; 
   }
});

// Method to handle final submission (remains the same)
const handleSubmit = async () => {
   if (!projectName.value || projectForm.value.aoiDrafts.length === 0) {
       alert('Please complete Step 1 (Project Name) and Step 2 (Draw at least one AOI) before final submission.');
       return;
   }
   try {
       await projectStore.submitProject();
       alert('Project successfully ' + (isUpdateMode.value ? 'updated.' : 'created!'));
       router.push('/');
   } catch (error) {
       console.error("Submission Error:", error);
       alert('Error submitting project. Check the console for API error details.');
   }
};

// Helper for navigation (back button now always goes to Home)
const goBack = () => {
    router.push('/');
};

// Helper for step progression (remains the same)
const nextStep = () => {
   if (currentStep.value === 1 && !projectName.value) {
       alert('Please enter a Project Name.');
       return;
   }
   if (currentStep.value === 2 && projectForm.value.aoiDrafts.length === 0) {
       alert('Please define at least one Area of Interest.');
       return;
   }
   projectStore.nextStep();
};

// Helper to determine active/visited status (remains the same)
const isStepActive = (step) => currentStep.value === step;
const isStepVisited = (step) => step < currentStep.value;

</script>

<template>
    <div v-if="isDataLoading" class="loading-message">Loading existing project data...</div>
    <div v-else class="configure-project-ui bg-gray-900 text-white">

        <div class="fixed top-16 left-0 right-0 p-0.5 bg-gray-700 shadow-lg border-b border-gray-600 z-[10000]">
            <div class="w-full max-w-6xl mx-auto flex justify-between items-center px-2 sm:px-4">

                <button
                    class="text-cyan-400 hover:text-cyan-300 transition duration-150 py-1 px-2 rounded flex items-center text-sm sm:text-base"
                    @click="goBack"
                >
                    <svg class="w-5 h-5 sm:w-5 sm:h-5 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                    <span class="hidden sm:inline">Back to Home</span>
                    <span class="sm:hidden"></span>
                </button>

                <h1 class="text-lg sm:text-2xl font-bold text-white truncate max-w-[70%]">
                    {{ isUpdateMode ? 'Update Project: ' : 'Add New Project' }}
                    <span v-if="projectName && isUpdateMode" class="text-cyan-400">{{ projectName }}</span>
                </h1>

                <button
                    v-if="!isFinalStep"
                    @click="nextStep"
                    class="px-3 py-1 text-cyan-400 rounded-lg font-semibold transition duration-150 text-sm"
                >
                    <svg class="w-5 h-5 sm:w-5 sm:h-5 inline-block ml-1"
                         fill="none" stroke="currentColor" viewBox="0 0 24 24"
                         xmlns="http://www.w3.org/2000/svg">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
                    </svg>
                </button>
                <button
                    v-else
                    @click="handleSubmit"
                    class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition duration-150 text-sm"
                    :disabled="!projectName || projectForm.aoiDrafts.length === 0"
                    :class="{'opacity-50 cursor-not-allowed': !projectName || projectForm.aoiDrafts.length === 0}"
                >
                    {{ isUpdateMode ? 'FINAL UPDATE' : 'FINAL SUBMIT' }}
                </button>
            </div>
        </div>

        <div class="w-full max-w-6xl mx-auto rounded-2xl bg-gray-800 shadow-2xl p-6 relative pt-28 pb-10">

            <div class="flex justify-between items-center relative mb-2">
                <template v-for="step in 4" :key="step">
                    <div class="w-1/4 flex flex-col items-center relative z-10">
                        <div
                            class="w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-all duration-300 cursor-pointer"
                            @click="projectStore.projectForm.currentStep = step"
                            :class="{
                                'bg-cyan-500 border-cyan-500 text-white': isStepActive(step),
                                'bg-green-600 border-green-600 text-white': isStepVisited(step) && !isStepActive(step),
                                'bg-gray-700 border-gray-600 text-gray-400': !isStepVisited(step) && !isStepActive(step)
                            }"
                        >
                            {{ step }}
                        </div>
                        <span class="text-xs mt-1 text-center" :class="{'text-cyan-400 font-bold': isStepActive(step), 'text-gray-400': !isStepActive(step)}">
                            {{ ['Basic Info', 'Define AOI', 'Config Watch', 'Add Users'][step - 1] }}
                        </span>
                    </div>
                   <div
                           v-if="step < 4"
                           class="absolute top-4  h-0.5 z-0 transition-all duration-500"
                           :style="{
                               left: (step * 31 - 12.5) + '%',
                               width: '28%',
                               transform: 'translateX(-50%)',
                           }"
                           :class="{'bg-green-600': isStepVisited(step), 'bg-gray-700': !isStepVisited(step)}"
                       ></div>
                </template>
            </div>

            <div class="step-content border border-gray-700  rounded-xl max-h-[70vh] overflow-y-auto">
                <Step1BasicInfo v-if="currentStep === 1" :project-data="projectForm" />
                <Step2DefineAOI v-if="currentStep === 2" :project-data="projectForm" />
                <Step3AlgoMapping v-if="currentStep === 3" :project-data="projectForm" />
                <Step4AddUsers v-if="currentStep === 4" :project-data="projectForm" />
            </div>

            </div>
    </div>
</template>




<style scoped>
.configure-project-ui { min-height: 80vh; display: flex; align-items: flex-start; justify-content: center; padding-top: 50px; }
.step-content { min-height: 350px; }
.navigation-controls { display: flex; justify-content: space-between; gap: 10px; }
.btn-primary, .btn-secondary, .btn-submit { padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; font-weight: 500; transition: background-color 0.2s; }
.loading-message { text-align: center; padding: 50px; font-size: 1.2em; color: #FF9800; }
</style>


