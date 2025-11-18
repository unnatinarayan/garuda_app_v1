<!-- frontend/src/views/ConfigureProjectUI.vue -->
<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useProjectStore } from '@/stores/ProjectStore.js';
import { storeToRefs } from 'pinia';
import InlineMessage from "@/components/common/InlineMessage.vue";
import { useMessageStore } from '@/stores/MessageStore.js';

// Component Imports
import Step1BasicInfo from '@/components/steps/Step1BasicInfo.vue';
import Step2AddUsers from '@/components/steps/Step2AddUsers.vue';
import Step3DefineAOI from '@/components/steps/Step3DefineAOI.vue';
import Step4Subscriptions from '@/components/steps/Step4Subscriptions.vue';

const props = defineProps({
    id: String,
});

const router = useRouter();
const route = useRoute();
const projectStore = useProjectStore();
const messageStore = useMessageStore();

const { projectForm, projectName, description } = storeToRefs(projectStore);
const isDataLoading = ref(false);

const currentStep = computed(() => projectStore.currentStep);
const isFinalStep = computed(() => currentStep.value === 4);
const isUpdateMode = computed(() => projectForm.value.isUpdateMode);

const stepNames = computed(() => {
    if (isUpdateMode.value) {
        return ['Update Info', 'Update Users', 'Update AOI', 'Update Subscriptions'];
    } else {
        return ['Basic Info', 'Add Users', 'Define AOI', 'Subscriptions'];
    }
});

const projectIdParam = props.id ? parseInt(props.id) : (route.params.id ? parseInt(route.params.id) : null);

onMounted(async () => {
    if (projectIdParam) {
        isDataLoading.value = true;
        try {
            await projectStore.loadProjectForUpdate(projectIdParam);
            projectStore.projectForm.currentStep = 1;
        } catch (error) {
            messageStore.showMessage('Error loading project: ' + error.message, 'error');
            router.push('/');
        } finally {
            isDataLoading.value = false;
        }
    } else {
        projectStore.initNewProjectForm();
        projectStore.projectForm.currentStep = 1;
    }
});

const handleSubmit = async () => {
    // Validation checks
    if (!projectName.value || projectForm.value.aoiDrafts.length === 0) {
        messageStore.showMessage(
            "Please complete Step 1 (Project Name) and Step 3 (Draw at least one AOI) before final submission.",
            "error"
        );
        return;
    }

    // FIXED: Validate that all AOIs have at least one subscription using clientAoiId
    const activeAOIs = projectForm.value.aoiDrafts.filter(aoi => aoi.status !== 2);
    for (const aoi of activeAOIs) {
        const hasSubscription = projectForm.value.aoiHasSubscription(aoi.clientAoiId);
        if (!hasSubscription) {
            messageStore.showMessage(
                `AOI "${aoi.name}" must have at least one alert channel subscription. Please complete Step 4.`,
                "error"
            );
            return;
        }
    }
    
    try {
        await projectStore.submitProject();
        messageStore.showMessage(
            `Project successfully ${isUpdateMode.value ? 'updated.' : 'created!'}`,
            "success"
        );
        router.push('/');
    } catch (error) {
        console.error("Submission Error:", error);
        messageStore.showMessage(
            error.message || "Error submitting project. Check the console for details.",
            "error"
        );
    }
};

const goBack = () => {
    if (currentStep.value > 1) {
        projectStore.projectForm.currentStep = currentStep.value - 1;
    } else {
        router.push('/');
    }
};

const nextStep = () => {
    // Step 1 validation
    if (currentStep.value === 1 && !projectName.value) {
        messageStore.showMessage("Please enter a Project Name.", "error");
        return;
    }
    
    // Step 2 validation
    if (currentStep.value === 2 && projectForm.value.users.length === 0) {
        messageStore.showMessage("Please add at least one user.", "error");
        return;
    }
    
    // Step 3 validation
    if (currentStep.value === 3 && projectForm.value.aoiDrafts.filter(a => a.status !== 2).length === 0) {
        messageStore.showMessage("Please define at least one Area of Interest.", "error");
        return;
    }
    
    projectStore.nextStep();
};

const isStepActive = (step) => currentStep.value === step;
const isStepVisited = (step) => step < currentStep.value;

const progressWidth = computed(() => {
    const percentage = (currentStep.value - 1) * 25;
    return `${percentage}%`;
});

// FIXED: Check if submit should be disabled using clientAoiId
const canSubmit = computed(() => {
    if (!projectName.value || projectForm.value.aoiDrafts.length === 0) {
        return false;
    }
    
    // Check if all active AOIs have subscriptions
    const activeAOIs = projectForm.value.aoiDrafts.filter(aoi => aoi.status !== 2);
    for (const aoi of activeAOIs) {
        const hasSubscription = projectForm.value.aoiHasSubscription(aoi.clientAoiId);
        if (!hasSubscription) {
            return false;
        }
    }
    
    return true;
});
</script>

<template>
    <div class="w-full h-[12vh] p-0.5 bg-gray-700 shadow-lg border-b border-gray-600 z-[8]">
        <div class="w-full h-[4vh] max-w-6xl mx-auto flex justify-between items-center">
            <button v-if="currentStep != 1"
                class="text-cyan-400 hover:text-cyan-300 transition duration-150 py-1 px-2 rounded flex items-center text-sm sm:text-base"
                @click="goBack">
                <svg class="w-5 h-5 sm:w-5 sm:h-5 inline-block mr-1" fill="none" stroke="currentColor"
                    viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                </svg>
            </button>
            <button v-else class="w-5"></button>

            <h1 class="text-lg sm:text-2xl font-bold text-white truncate max-w-[70%]">
                {{ isUpdateMode ? '' : 'Add New Project' }}
                <span v-if="projectName && isUpdateMode" class="text-cyan-400">{{ projectName }}</span>
            </h1>

            <button v-if="!isFinalStep" @click="nextStep"
                class="px-3 py-1 text-cyan-400 rounded-lg font-semibold transition duration-150 text-sm">
                <svg class="w-5 h-5 sm:w-5 sm:h-5 inline-block ml-1" fill="none" stroke="currentColor"
                    viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
            </button>
            <button v-else @click="handleSubmit"
                class="px-3 py-1 text-white rounded-lg font-semibold transition duration-150 text-sm"
                :disabled="!canSubmit"
                :class="{
                    'bg-blue-600 hover:bg-blue-700': canSubmit,
                    'bg-gray-600 opacity-50 cursor-not-allowed': !canSubmit
                }">
                {{ isUpdateMode ? 'UPDATE' : 'SUBMIT' }}
            </button>
        </div>

        <div class="relative mb-2 w-full h-[7vh] px-4 sm:px-6 md:px-8">
            <div class="absolute top-[2vh] left-0 right-0 h-0.5 z-0 transition-all duration-500 mx-8 sm:mx-10 md:mx-12"
                :class="{
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
                                'bg-cyan-500 border-cyan-500 text-white': isStepActive(step),
                                'bg-orange-600 border-orange-600 text-white': isStepVisited(step) && !isStepActive(step) && isUpdateMode,
                                'bg-green-600 border-green-600 text-white': isStepVisited(step) && !isStepActive(step) && !isUpdateMode,
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
    <div v-else class="configure-project-ui h-[73vh] overflow-y-auto flex-col text-white">
        <div class="w-full max-w-6xl mx-auto h-[69vh] px-4 pb-3 pt-2 relative">
            <div class="step-content h-full rounded-xl overflow-y-hidden">
                <Step1BasicInfo v-if="currentStep === 1" :project-data="projectForm" />
                <Step2AddUsers v-if="currentStep === 2" :project-data="projectForm" />
                <Step3DefineAOI v-if="currentStep === 3" :project-data="projectForm" />
                <Step4Subscriptions v-if="currentStep === 4" :project-data="projectForm" />
            </div>
        </div>
        
        <div class="w-full h-[2vh] max-w-6xl mt-1 px-4 mx-auto flex justify-between items-center">
            <button v-if="currentStep != 1"
                class="px-3 py-1 text-white-400 bg-cyan-700 rounded-lg font-semibold transition duration-150 text-sm"
                @click="goBack">
                Back
            </button>
            <button v-else class="w-5"></button>

            <button v-if="!isFinalStep" @click="nextStep"
                class="px-3 py-1 text-white-100 bg-cyan-500 rounded-lg font-semibold transition duration-150 text-sm">
                Next
            </button>
            <button v-else @click="handleSubmit"
                class="px-3 py-1 text-white rounded-lg font-semibold transition duration-150 text-sm"
                :disabled="!canSubmit"
                :class="{
                    'bg-blue-600 hover:bg-blue-700': canSubmit,
                    'bg-gray-600 opacity-50 cursor-not-allowed': !canSubmit
                }">
                {{ isUpdateMode ? 'UPDATE' : 'SUBMIT' }}
            </button>
        </div>
    </div>
</template>

<style scoped>
.configure-project-ui {
    align-items: flex-start;
    justify-content: center;
}

.step-content {
    min-height: 350px;
}

.loading-message {
    text-align: center;
    padding: 50px;
    font-size: 1.2em;
    color: #FF9800;
}
</style>