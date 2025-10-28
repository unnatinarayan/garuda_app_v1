<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useProjectStore } from '@/stores/ProjectStore';
import { storeToRefs } from 'pinia'; // <-- NEW IMPORT
import "tailwindcss";


const props = defineProps<{
    // The router automatically passes the ':id' parameter as a string prop named 'id'
    id?: string; 
}>();

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
const isMenuMode = ref(true); // NEW: Controls whether we show the card menu or the form

// Computed properties rely on the store's state for reactivity
const currentStep = computed(() => projectStore.currentStep);
const isFinalStep = computed(() => currentStep.value === 4);
const isUpdateMode = computed(() => projectForm.value.isUpdateMode);

const projectIdParam = props.id ? parseInt(props.id) : (route.params.id ? parseInt(route.params.id as string) : null);

// const projectIdParam = route.params.id ? parseInt(route.params.id as string) : null;


onMounted(async () => {
    if (projectIdParam) {
        // If in update mode, load data and jump directly into the editing menu
        isDataLoading.value = true;
        try {
            await projectStore.loadProjectForUpdate(projectIdParam);
            isMenuMode.value = true; // Show the menu initially for updates
        } catch (error) {
            alert('Error loading project: ' + (error as Error).message);
            router.push('/');
        } finally {
            isDataLoading.value = false;
        }
    } else {
        // For new projects, start the form reset
        projectStore.initNewProjectForm();
        isMenuMode.value = true; // Show the menu to start
    }
});

/**
 * NEW: Switches from the menu card view to the specific step form view.
 */
const startStep = (stepNumber: number) => {
    projectForm.currentStep = stepNumber; // Directly set the step number on the class object
    isMenuMode.value = false; // Switch to form view
};

// Method to handle form submission
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

// Helper for navigation (Modified to handle menu mode)
const goBack = () => {
    if (!isMenuMode.value) {
        // If currently in a form step, go back to the main menu
        isMenuMode.value = true;
    } else {
        // If currently in the main menu, go back to the Home page
        router.push('/');
    }
};

// Helper for validation and moving forward (linear flow, used inside the form view)
const nextStep = () => {
    // Validation (as before)
    if (currentStep.value === 1 && !projectName.value) {
        alert('Please enter a Project Name.');
        return;
    }
    if (currentStep.value === 2 && projectForm.value.aoiDrafts.length === 0) {
        alert('Please define at least one Area of Interest.');
        return;
    }
    // CRITICAL DEBUG LOGGING: Check the state right now
    console.log(`--- DEBUG: BEFORE STEP ${projectStore.currentStep} ADVANCE ---`);
    console.log('ProjectName:', projectName.value);
    console.log('Description:', description.value);
    console.log('AOI Count:', projectForm.value.aoiDrafts.length);
    console.log('--------------------------------------------------');

    // Use the store action to safely advance the step counter
    projectStore.nextStep(); 
};

// Helper to determine active/visited status for styling the step indicators
const isStepActive = (step: number) => currentStep.value === step && !isMenuMode.value;
const isStepVisited = (step: number) => step < currentStep.value || (step === currentStep.value && !isMenuMode.value);


</script>

<template>
    <div v-if="isDataLoading" class="loading-message">Loading existing project data...</div>
    <div v-else class="configure-project-ui bg-gray-900 text-white">
        <div class="w-full max-w-6xl mx-auto rounded-2xl bg-gray-800 shadow-2xl p-6 relative pt-10">

            <!-- Header -->
            <header class="pb-4 app-header mb-6">
                <button class="mb-4 text-cyan-400 hover:text-cyan-300 transition duration-150" @click="goBack">
                    <svg class="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                    {{ isMenuMode ? 'Back to Home' : 'Back to Menu' }}
                </button>
                <h1 class="text-3xl font-bold text-white">{{ isUpdateMode ? 'Update Project' : 'Add New Project' }}</h1>
            </header>

            <!-- 1. Selection Menu (Visible when isMenuMode is true) -->
            <div v-if="isMenuMode" id="add-select-menu">
                <p class="mb-6 text-gray-400">Select a step to begin configuring your project:</p>
                
                <div class="space-y-4">
                    <!-- Step 1: Basic Info -->
                    <div @click="startStep(1)" class="w-full p-4 bg-gray-700 hover:bg-gray-600 transition duration-150 rounded-xl shadow-lg flex items-center space-x-4 cursor-pointer border-l-4 border-cyan-500">
                        <span class="text-xl font-bold text-cyan-400">1</span>
                        <span class="font-medium text-white">Project Basic Info</span>
                    </div>
                    
                    <!-- Step 2: Define AOI -->
                    <div @click="startStep(2)" class="w-full p-4 bg-gray-700 hover:bg-gray-600 transition duration-150 rounded-xl shadow-lg flex items-center space-x-4 cursor-pointer border-l-4 border-cyan-500">
                        <span class="text-xl font-bold text-cyan-400">2</span>
                        <span class="font-medium text-white">Define AOI</span>
                    </div>
                    
                    <!-- Step 3: Configure AOI Watch -->
                    <div @click="startStep(3)" class="w-full p-4 bg-gray-700 hover:bg-gray-600 transition duration-150 rounded-xl shadow-lg flex items-center space-x-4 cursor-pointer border-l-4 border-cyan-500">
                        <span class="text-xl font-bold text-cyan-400">3</span>
                        <span class="font-medium text-white">Configure AOI Watch</span>
                    </div>
                    
                    <!-- Step 4: Add Users -->
                    <div @click="startStep(4)" class="w-full p-4 bg-gray-700 hover:bg-gray-600 transition duration-150 rounded-xl shadow-lg flex items-center space-x-4 cursor-pointer border-l-4 border-cyan-500">
                        <span class="text-xl font-bold text-cyan-400">4</span>
                        <span class="font-medium text-white">Add Users</span>
                    </div>
                </div>
                
                <!-- Submit button for the main menu -->
                <div class="mt-8 text-center">
                    <button 
                        @click="handleSubmit" 
                        class="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg transition duration-200"
                        :disabled="projectForm.projectName === ''"
                        :class="{'opacity-50 cursor-not-allowed': projectForm.projectName === ''}"
                    >
                        {{ isUpdateMode ? 'FINAL UPDATE' : 'FINAL SUBMIT' }}
                    </button>
                    <p v-if="projectForm.projectName === ''" class="text-red-400 mt-2 text-sm">Please complete Step 1 before final submission.</p>
                </div>
            </div>

            <!-- 2. Step Form (Visible when isMenuMode is false) -->
            <div v-else id="add-step-form">
                
                <!-- Progress Bar -->
                <div class="flex justify-between items-center relative mb-10 mt-4">
                    <template v-for="step in 4" :key="step">
                        <!-- Step Indicator -->
                        <div class="w-1/4 flex flex-col items-center relative z-10">
                            <div 
                                class="w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-all duration-300"
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
                        <!-- Line Connector -->
                        <div 
                            v-if="step < 4" 
                            class="absolute top-4 h-0.5 z-0 transition-all duration-500"
                            :style="{ 
                                left: (step * 25 - 12.5) + '%', 
                                width: '25%', 
                                transform: 'translateX(-50%)',
                            }"
                            :class="{'bg-green-600': isStepVisited(step), 'bg-gray-700': !isStepVisited(step)}"
                        ></div>
                    </template>
                </div>
                
                <!-- Step Content -->
                <div class="step-content border border-gray-700 p-4 rounded-xl">
                    <Step1BasicInfo v-if="currentStep === 1" :project-data="projectForm" />
                    <Step2DefineAOI v-if="currentStep === 2" :project-data="projectForm" />
                    <Step3AlgoMapping v-if="currentStep === 3" :project-data="projectForm" />
                    <Step4AddUsers v-if="currentStep === 4" :project-data="projectForm" />
                </div>

                <!-- Navigation Buttons (Back to Menu, Next Step) -->
                <div class="navigation-controls mt-6">
                    <button @click="goBack" class="btn-secondary bg-gray-700 text-white hover:bg-gray-600">
                        ← Back to Menu
                    </button>

                    <button v-if="!isFinalStep" @click="nextStep" class="btn-primary bg-cyan-600 hover:bg-cyan-700 text-white">
                        Next (Step {{ currentStep + 1 }})
                    </button>

                    <button v-else @click="handleSubmit" class="btn-submit bg-blue-600 hover:bg-blue-700 text-white">
                        {{ isUpdateMode ? 'Final Update' : 'Final Submit' }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.configure-project-ui { min-height: 100vh; display: flex; align-items: flex-start; justify-content: center; padding-top: 50px; }
.step-content { min-height: 350px; }
.navigation-controls { display: flex; justify-content: space-between; gap: 10px; }
.btn-primary, .btn-secondary, .btn-submit { padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; font-weight: 500; transition: background-color 0.2s; }
.loading-message { text-align: center; padding: 50px; font-size: 1.2em; color: #FF9800; }
</style>


