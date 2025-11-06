<!-- DisplayProjectUI.vue  -->

<script setup>
import { onMounted, ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useProjectStore } from '@/stores/ProjectStore.js';

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

// Available filter options (derived from store data or mock)
const availableRoles = ['owner', 'analyst', 'viewer'];
const availableStatuses = ['Active', 'Draft', 'Archived']; 

onMounted(async () => {
    isLoading.value = true;
    try {
        await projectStore.fetchUserProjects();
    } catch (error) {
        errorMessage.value = 'Failed to load projects.';
    } finally {
        isLoading.value = false;
    }
});

// COMPUTED PROPERTY FOR FILTERING
const filteredProjects = computed(() => {
    if (isLoading.value) return [];
    
    // Start with all projects from the store
    let projects = projectStore.userProjects;

    // 1. Search Filter (by name/description)
    if (searchTerm.value) {
        const term = searchTerm.value.toLowerCase();
        projects = projects.filter(p =>
            p.project_name.toLowerCase().includes(term) ||
            p.description?.toLowerCase().includes(term)
        );
    }
    
    // 2. Role Filter (based on the user's role in the project)
    if (filterRole.value) {
        projects = projects.filter(p => p.role === filterRole.value);
    }
    
    // 3. Status Filter (MOCK - requires a 'status' field in the DB)
    if (filterStatus.value) {
        // For demonstration, we mock Status based on the first letter of the project name
        // In a real app, this would be a DB column.
        if (filterStatus.value === 'Active') {
            projects = projects.filter(p => p.project_name.startsWith('A'));
        }
    }

    // 4. Mode Filter (Monitor vs Manage)
    if (isMonitorMode.value) {
        // In monitor mode, maybe only show projects where the user is an analyst or owner
        projects = projects.filter(p => p.role === 'owner' || p.role === 'analyst');
    }

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

const goBack = () => {
    router.push('/');
};

</script>

<template>
  <div id="manage-view" class="min-h-screen bg-gray-900 text-white flex justify-center ">
    <div class="w-full max-w-4xl mx-auto rounded-2xl bg-gray-800 shadow-2xl p-2 relative">
        
        <!-- Header for Manage View -->
        <header class="pb-2 mb-2 flex items-center">
            <button @click="goBack" class="mr-4 text-cyan-400 hover:text-cyan-300 transition duration-150" title="Back to Home">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
            </button>
            <h1 class="text-xl  font-bold text-white">{{ isMonitorMode ? 'Monitor Projects' : 'Manage Projects' }}</h1>
            <span v-if="isMonitorMode" class="ml-4 px-3 py-1 bg-purple-600 rounded-full text-sm font-semibold">Live Mode</span>
        </header>

        <!-- Project List Section -->
        <div>
            
            <!-- Smart Search and Filters Container -->
            <div class="flex justify-between items-center mb-4 space-x-3">
                <input 
                    type="text" 
                    v-model="searchTerm" 
                    placeholder="Search Name/Desc..." 
                    class="w-full p-3 rounded-xl bg-gray-700 text-white border border-gray-600 focus:ring-cyan-500 focus:border-cyan-500 transition duration-150" 
                >
                <!-- Add Project Button -->
                 <button 
                    class="ml-3 p-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl shadow-lg transition duration-150 flex-shrink-0" 
                    title="Add New Project"
                >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h18M3 8h12M3 12h8m0 0l-4-4m4 4l-4 4"></path>
</svg>
                </button>
                
            </div>
            
            <!-- Filter Selects -->
            
            
            <!-- Project List -->
            <div class="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                <p v-if="isLoading" class="text-center py-8 text-gray-400">Loading projects...</p>
                <p v-else-if="errorMessage" class="text-center py-8 text-red-500">{{ errorMessage }}</p>
                <p v-else-if="filteredProjects.length === 0" class="text-center py-8 text-gray-400">No projects match your criteria.</p>

                <div 
                    v-for="project in filteredProjects" 
                    :key="project.id" 
                    class="flex justify-between items-center p-4 rounded-xl bg-gray-700 hover:bg-gray-600 transition duration-150 shadow-md border-l-4 border-cyan-500"
                >
                    <!-- Project Info -->
                    <div class="flex-grow">
                        <h3 class="text-xl font-bold text-white">{{ project.project_name }}</h3>
                        <p class="text-sm text-gray-400 truncate">{{ project.description || 'No description.' }}</p>
                        <span class="text-xs font-semibold px-2 py-0.5 mt-1 rounded text-cyan-200 bg-cyan-700 inline-block">Role: {{ project.role }}</span>
                    </div>

                    <!-- Actions -->
                    <div class="flex space-x-2 flex-shrink-0 ml-4">
                        <button 
                            @click="handleProjectAction(project)" 
                            class="p-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white transition duration-150"
                            :title="isMonitorMode ? 'View Live Map' : 'Edit Project'"
                        >
                            <svg v-if="isMonitorMode" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                            <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                        </button>

                        <button 
                            v-if="!isMonitorMode" 
                            @click="handleDelete(project.id, project.project_name)" 
                            class="p-2 rounded-full bg-red-600 hover:bg-red-700 text-white transition duration-150"
                            title="Delete Project (Requires Owner Role)"
                        >
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
  </div>
</template>

<style scoped>
.min-h-screen {
    min-height: 100vh;
}
.bg-gray-900 { background-color: #111827; }
.bg-gray-800 { background-color: #1f2937; }
.bg-gray-700 { background-color: #374151; }
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
</style>