<!-- DisplayProjectUI.vue  -->

<script setup>
import { onMounted, ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useProjectStore } from '@/stores/ProjectStore.js';

// import DropdownSelect from '@/components/common/CustomSelect.vue';
import CustomSelect from '../components/common/CustomSelect.vue';

const sortOptions = [
    { label: 'Sort by Role', value: 'role' },
    { label: 'Sort by Name', value: 'project_name' },
    { label: 'Sort by Creation Date', value: 'creation_timestamp' },
    { label: 'Sort by Last Modified', value: 'last_modified_timestamp' },
];


const router = useRouter();
const route = useRoute();
const projectStore = useProjectStore();

// UI State
const isLoading = ref(true);
const errorMessage = ref('');
const isMonitorMode = computed(() => route.query.mode === 'monitor');

// Filter/Search State
const searchTerm = ref('');
const filterRole = ref('');
const filterStatus = ref('');
const filterDate = ref('');

// // --- NEW SORTING STATE ---
// const sortCriteria = ref({
//     field: 'role', // Default sorting field
//     direction: 'asc', // 'asc' or 'desc'
// });
const sortCriteria = ref({
    field: 'last_modified_timestamp', // default
    direction: 'desc', // default: latest first
});

// Define the role hierarchy mapping for sorting
const ROLE_ORDER = {
    'owner': 1,
    'analyst': 2,
    'viewer': 3,
};



onMounted(async () => {
    isLoading.value = true;
    try {
        const savedSort = localStorage.getItem('projectSort');
        if (savedSort) sortCriteria.value = JSON.parse(savedSort);
        await projectStore.fetchUserProjects();
    } catch (error) {
        errorMessage.value = 'Failed to load projects.';
    } finally {
        isLoading.value = false;
    }
});

watch(sortCriteria, (newVal) => {
    localStorage.setItem('projectSort', JSON.stringify(newVal));
}, { deep: true });


// COMPUTED PROPERTY FOR FILTERING AND SORTING
const filteredProjects = computed(() => {
    if (isLoading.value) return [];

    // Start with a *copy* of projects to prevent mutating the Pinia store
    let projects = [...projectStore.userProjects];

    // 1. Filtering Logic (remains the same)
    if (searchTerm.value) {
        const term = searchTerm.value.toLowerCase();
        projects = projects.filter(p =>
            p.project_name.toLowerCase().includes(term) ||
            p.description?.toLowerCase().includes(term)
        );
    }

    if (filterRole.value) {
        projects = projects.filter(p => p.role === filterRole.value);
    }

    if (filterStatus.value) {
        if (filterStatus.value === 'Active') {
            projects = projects.filter(p => p.project_name.startsWith('A'));
        }
    }

    if (isMonitorMode.value) {
        projects = projects.filter(p => p.role === 'owner' || p.role === 'analyst');
    }


    // 2. Sorting Logic (Updated)
    const { field, direction } = sortCriteria.value;

    projects.sort((a, b) => {
        let comparison = 0;

        if (field === 'role') {
            const aRole = ROLE_ORDER[a.role] || 99;
            const bRole = ROLE_ORDER[b.role] || 99;
            comparison = aRole - bRole;
        }
        else if (field === 'project_name') {
            comparison = a.project_name.localeCompare(b.project_name);
        }
        else if (field === 'creation_timestamp') {
            comparison = new Date(a.creation_timestamp) - new Date(b.creation_timestamp);
        }
        else if (field === 'last_modified_timestamp') {
            comparison = new Date(a.last_modified_timestamp) - new Date(b.last_modified_timestamp);
        }

        return direction === 'asc' ? comparison : -comparison;
    });


    return projects;
});


const handleProjectAction = (project) => {
    if (isMonitorMode.value) {
        // Action: Monitor Project (opens map UI with live AOIs)
        router.push({ name: 'monitor-map', params: { id: project.id } });
    } else {
        // Action: Manage/Update Project (reuses ConfigureProjectUI)
        router.push({ name: 'update-project', params: { id: project.id } });
    }
};

const handleDelete = async (projectId, projectName) => {
    // Note: Replaced `confirm` with a simple alert/check as per core rules.
    const confirmed = prompt(`Type DELETE to confirm deletion of project: "${projectName}"`);
    if (confirmed === 'DELETE') {
        try {
            await projectStore.deleteProject(projectId);
            await projectStore.fetchUserProjects(); // Refresh list
            alert(`Project "${projectName}" deleted successfully.`);
        } catch (error) {
            alert('Deletion failed: You must be the project owner. See console for details.');
            console.error(error);
        }
    }
};



</script>

<template>
    <div id="manage-view" class="h-[85vh] mb-2  text-white flex-col justify-center ">

        <div
            class=" h-[5vh] w-full p-1 bg-gray-700 shadow-lg flex justify-center items-center border-b border-gray-600">
            <h1 class="text-[3vh] font-bold text-white">{{ isMonitorMode ? 'Monitor Projects' : 'Manage Projects' }}
            </h1>
        </div>
        <div class="w-full h-[80vh] max-w-4xl mx-auto rounded-2xl  p-2 relative">

            <div>
                <div class="flex flex-wrap h-[10vh] justify-between items-center mb-[2vh] gap-2">
                    <input type="text" v-model="searchTerm" placeholder="Search Name/Desc..."
                        class="flex-1 min-w-[200px] p-2 h-[4vh] rounded-xl bg-gray-700 text-white border border-gray-600 focus:ring-cyan-500 focus:border-cyan-500 transition duration-150" />

                    <div class="flex flex-row w-full justify-end h-[5vh] gap-2">
                        <CustomSelect v-model="sortCriteria.field" :options="sortOptions" label-key="label"
                            value-key="value" placeholder="Sort by..." class="min-w-[160px] h-[4vh] sm:w-auto" />


                        <button @click="sortCriteria.direction = sortCriteria.direction === 'asc' ? 'desc' : 'asc'"
                            class="p-1 h-[4vh] w-[4vh] bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl shadow-lg transition duration-150 flex-shrink-0"
                            :title="`Sorting: ${sortCriteria.direction === 'asc' ? 'Ascending' : 'Descending'}`">
                            <svg class="w-[3.5vh] h-[3.5vh]" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                xmlns="http://www.w3.org/2000/svg">
                                <path v-if="sortCriteria.direction === 'asc'" stroke-linecap="round"
                                    stroke-linejoin="round" stroke-width="2"
                                    d="M3 4h18M3 8h12M3 12h8m0 0l-4-4m4 4l-4 4"></path>
                                <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M3 4h18M3 8h12M3 12h8m0 0l-4-4m4 4l-4 4"
                                    style="transform: rotate(180deg); transform-origin: center;"></path>
                            </svg>
                        </button>
                    </div>
                </div>



                <div class="space-y-4 max-h-[66vh] overflow-y-auto pr-2">
                    <p v-if="isLoading" class="text-center py-8 text-gray-400">Loading projects...</p>
                    <p v-else-if="errorMessage" class="text-center py-8 text-red-500">{{ errorMessage }}</p>
                    <p v-else-if="filteredProjects.length === 0" class="text-center py-8 text-gray-400">No projects
                        match your criteria.</p>

                    <div v-for="project in filteredProjects" :key="project.id"
                        class="flex h-[69] justify-between items-center p-2 rounded-xl bg-gray-700 hover:bg-gray-600 transition duration-150 shadow-md border-l-4 border-cyan-500">
                        <div class="flex flex-col">
                            <h3 class="text-xl font-bold text-white">{{ project.project_name }}</h3>
                            <span
                                class="text-xs font-semibold px-2 py-0.5 mt-1 rounded text-cyan-200 bg-green-700 inline-block">Role:
                                {{ project.role }}</span>
                            <p
                                class="text-sm text-gray-400 overflow-hidden whitespace-nowrap 	max-w-[15ch] text-ellipsis">
                                {{ project.description || 'No description.' }}</p>

                        </div>

                        <div class="flex space-x-2 flex-shrink-0 ml-4">
                            <button @click="handleProjectAction(project)"
                                class="p-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white transition duration-150"
                                :title="isMonitorMode ? 'View Live Map' : 'Edit Project'">
                                <svg v-if="isMonitorMode" class="w-5 h-5" fill="none" stroke="currentColor"
                                    viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z">
                                    </path>
                                </svg>
                                <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                    xmlns="http://www.w3.org/2000/svg">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z">
                                    </path>
                                </svg>
                            </button>

                            <button v-if="!isMonitorMode" @click="handleDelete(project.id, project.project_name)"
                                class="p-2 rounded-full bg-red-600 hover:bg-red-700 text-white transition duration-150"
                                title="Delete Project (Requires Owner Role)">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                    xmlns="http://www.w3.org/2000/svg">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16">
                                    </path>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* Scoped styles remain the same */
.min-h-screen {
    min-height: 100vh;
}

.bg-gray-900 {
    background-color: #111827;
}

.bg-gray-800 {
    background-color: #1f2937;
}

.bg-gray-700 {
    background-color: #374151;
}

/* Custom scrollbar for better aesthetics */
.overflow-y-auto::-webkit-scrollbar {
    width: 8px;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
    background-color: #4b5563;
    border-radius: 4px;
}

.overflow-y-auto::-webkit-scrollbar-track {
    background-color: #1f2937;
}


/* Fix select dropdown floating and clipping */


/* Prevent parent containers from clipping dropdowns */


/* Make sure select dropdown fits well on mobile */
select {
    width: 100%;
    max-width: 220px;
    background-color: #374151;
    border: 1px solid #4b5563;
    color: white;
    border-radius: 0.75rem;
    padding: 0.5rem;
    font-size: 0.9rem;
}

/* For touch-friendly spacing */
@media (max-width: 640px) {
    select {
        max-width: 100%;
        font-size: 0.85rem;
    }
}
</style>
