<!-- frontend/src/views/ConfigureProjectUI.vue-->


<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useProjectStore } from '@/stores/ProjectStore.js';
import { storeToRefs } from 'pinia';
import "tailwindcss";
import InlineMessage from "@/components/common/InlineMessage.vue";
import { useMessageStore } from '@/stores/MessageStore.js';
const messageStore = useMessageStore();


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

// Computed properties rely on the store's state for reactivity
const currentStep = computed(() => projectStore.currentStep);
const isFinalStep = computed(() => currentStep.value === 4);
const isUpdateMode = computed(() => projectForm.value.isUpdateMode);


const stepNames = computed(() => {
    if (isUpdateMode.value) {
        return ['Update Info', 'Update AOI', 'Update Watch', 'Update User'];
    } else {
        return ['Basic Info', 'Define AOI', 'Config Watch', 'Add Users'];
    }
});

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

        messageStore.showMessage("Please complete Step 1 (Project Name) and Step 2 (Draw at least one AOI) before final submission.", "info");
        // alert('Please complete Step 1 (Project Name) and Step 2 (Draw at least one AOI) before final submission.');
        return;
    }
    try {
        await projectStore.submitProject();

        messageStore.showMessage(
            `Project successfully ${isUpdateMode.value ? 'updated.' : 'created!'}`,
            "success"
        );
        // alert('Project successfully ' + (isUpdateMode.value ? 'updated.' : 'created!'));
        router.push('/');
    } catch (error) {
        console.error("Submission Error:", error);

        messageStore.showMessage("Error submitting project. Check the console for API error details.", "error");
        // alert('Error submitting project. Check the console for API error details.');
    }
};

// Helper for navigation (back button now always goes to Home)
const goBack = () => {
    if (currentStep.value > 1) {
        // Go to the previous step (e.g., from step 3 to step 2)
        projectStore.projectForm.currentStep = currentStep.value - 1;
    } else {
        // If on the first step, go back to the home page
        router.push('/');
    }
};

// Helper for step progression (remains the same)
const nextStep = () => {
    if (currentStep.value === 1 && !projectName.value) {
        messageStore.showMessage("Please enter a Project Name.", "error");

        // alert('Please enter a Project Name.');
        return;
    }
    if (currentStep.value === 2 && projectForm.value.aoiDrafts.length === 0) {
        messageStore.showMessage("Please define at least one Area of Interest.", "error");

        // alert('Please define at least one Area of Interest.');
        return;
    }
    projectStore.nextStep();
};

// Helper to determine active/visited status (remains the same)
const isStepActive = (step) => currentStep.value === step;
const isStepVisited = (step) => step < currentStep.value;

const progressWidth = computed(() => {
    // 1 step = 25%, 2 steps = 50%, etc.
    const percentage = (currentStep.value - 1) * 25;
    return `${percentage}%`;
});
</script>

<template>

    <div class="w-full h-[12vh] p-0.5 bg-gray-700 shadow-lg border-b border-gray-600 z-[8]">
        <div class="w-full h-[4vh] max-w-6xl mx-auto flex justify-center items-center">

            <!-- <button v-if="currentStep != 1"
                class="text-cyan-400 hover:text-cyan-300 transition duration-150 py-1 px-2 rounded flex items-center text-sm sm:text-base"
                @click="goBack">
                <svg class="w-5 h-5 sm:w-5 sm:h-5 inline-block mr-1" fill="none" stroke="currentColor"
                    viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                </svg>
            </button>
            <button v-else
                class="text-cyan-400 ml-4 hover:text-cyan-300 transition duration-150 py-1 px-3 w-5 rounded flex items-center text-sm sm:text-base">
            </button> -->


            <h1 class="text-lg sm:text-2xl font-bold text-white truncate max-w-[70%]">
                {{ isUpdateMode ? '' : 'Add New Project' }}
                <span v-if="projectName && isUpdateMode" class="text-cyan-400">{{ projectName }}</span>
            </h1>

            <!-- <button v-if="!isFinalStep" @click="nextStep"
                class="px-3 py-1 text-cyan-400 rounded-lg font-semibold transition duration-150 text-sm">
                <svg class="w-5 h-5 sm:w-5 sm:h-5 inline-block ml-1" fill="none" stroke="currentColor"
                    viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
            </button>
            <button v-else @click="handleSubmit"
                class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition duration-150 text-sm"
                :disabled="!projectName || projectForm.aoiDrafts.length === 0"
                :class="{ 'opacity-50 cursor-not-allowed': !projectName || projectForm.aoiDrafts.length === 0 }">
                {{ isUpdateMode ? 'UPDATE' : 'SUBMIT' }}
            </button> -->
        </div>


        <div class="relative mb-2 w-full h-[7vh] px-4 sm:px-6 md:px-8">

            <div class="absolute top-[2vh] left-0 right-0 h-0.5 z-0 transition-all duration-500 mx-8 sm:mx-10 md:mx-12"
                :class="{
                    // Default line color: Green if in Update Mode, Gray otherwise
                    'bg-green-600': isUpdateMode,
                    'bg-gray-700': !isUpdateMode
                }">
            </div>

            <div class="absolute top-[2vh] left-0 h-0.5 z-0 transition-all duration-500 mx-8 sm:mx-10 md:mx-12 bg-green-600"
                :style="{ width: progressWidth }">
            </div>

            <div class="flex justify-between items-center relative z-10">
                <template v-for="step in 4" :key="step">
                    <div class="w-1/4 flex flex-col items-center cursor-pointer">

                        <div class="w-[4vh] h-[4vh] rounded-full border-2 flex items-center justify-center text-sm font-bold transition-all duration-300"
                            :class="{
                                // Current Step: Always Cyan
                                'bg-cyan-500 border-cyan-500 text-white': isStepActive(step),

                                // Completed Step (Visited): Orange in Update Mode, Green otherwise
                                'bg-orange-600 border-orange-600 text-white': isStepVisited(step) && !isStepActive(step) && isUpdateMode,
                                'bg-green-600 border-green-600 text-white': isStepVisited(step) && !isStepActive(step) && !isUpdateMode,

                                // Incomplete Step: Gray
                                'bg-gray-700 border-gray-600 text-gray-400': !isStepVisited(step) && !isStepActive(step)
                            }">
                            {{ step }}
                        </div>

                        <span class="text-[1.5vh] mt-1 text-center truncate w-full"
                            :class="{ 'text-cyan-400 font-bold': isStepActive(step), 'text-gray-400': !isStepActive(step) }">
                            {{ stepNames[step - 1] }}
                        </span>
                    </div>
                </template>
            </div>
        </div>



        <InlineMessage />
    </div>
    
    <div v-if="isDataLoading" class="loading-message">Loading existing project data...</div>
    <div v-else class="configure-project-ui h-[73vh] overflow-y-auto flex-col text-white ">



        

        <div class="w-full max-w-6xl mx-auto h-[68vh] px-4 py-3 relative ">



            <div class="step-content h-full rounded-xl overflow-y-hidden">
                <Step1BasicInfo v-if="currentStep === 1" :project-data="projectForm" />
                <Step2DefineAOI v-if="currentStep === 2" :project-data="projectForm" />
                <Step3AlgoMapping v-if="currentStep === 3" :project-data="projectForm" />
                <Step4AddUsers v-if="currentStep === 4" :project-data="projectForm" />
            </div>



        </div>
        <div class="w-full h-[2vh] max-w-6xl mt-2 px-4 mx-auto flex justify-between items-center">

            <button v-if="currentStep != 1"
                class="px-3 py-1 text-white-400 bg-orange-700 rounded-lg font-semibold transition duration-150 text-sm"
                @click="goBack">
                Previous Step
            </button>
            <button v-else
                class="text-cyan-400 ml-4 hover:text-cyan-300 transition duration-150 py-1 px-3 w-5 rounded flex items-center text-sm sm:text-base"></button>



            <button v-if="!isFinalStep" @click="nextStep"
                class="px-3 py-1 text-white-400 bg-green-900 rounded-lg font-semibold transition duration-150 text-sm">
                Next Step
            </button>
            <button v-else @click="handleSubmit"
                class="px-3 py-1 bg-blue-600 text-white rounded-lg font-semibold transition duration-150 text-sm"
                :disabled="!projectName || projectForm.aoiDrafts.length === 0"
                :class="{ 'opacity-50 cursor-not-allowed': !projectName || projectForm.aoiDrafts.length === 0 }">
                {{ isUpdateMode ? 'UPDATE' : 'SUBMIT' }}
            </button>
        </div>

    </div>
</template>




<style scoped>
.configure-project-ui {
    /* min-height: 74vh; */
    display: flex;
    align-items: flex-start;
    justify-content: center;

}

.step-content {
    min-height: 350px;
}

.navigation-controls {
    display: flex;
    justify-content: space-between;
    gap: 10px;
}

.btn-primary,
.btn-secondary,
.btn-submit {
    padding: 10px 20px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
    transition: background-color 0.2s;
}

.loading-message {
    text-align: center;
    padding: 50px;
    font-size: 1.2em;
    color: #FF9800;
}
</style>