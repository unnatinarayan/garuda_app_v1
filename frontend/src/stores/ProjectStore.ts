// ProjectStore.ts

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
// STATIC IMPORTS FOR CLASSES
import { ProjectFormData } from '../classes/ProjectFormData'; 
import { AreaOfInterestDraft } from '../classes/AreaOfInterestDraft'; // <-- Ensure this is added
import { ApiClient } from '../api/ApiClient';

const api = ApiClient.getInstance();

/**
 * Helper function to map the complex backend structure to the simpler ProjectFormData class structure.
 * This is now synchronous, relying on static imports.
 */
function mapBackendToForm(data: any): ProjectFormData {
    
    // Instantiate the ProjectFormData class
    const form = new ProjectFormData(true, data.id); // Set to update mode

    // Step 1 Mapping
    form.projectName = data.project_name;
    form.description = data.description;
    form.auxData = data.auxdata || {};
    form.currentStep = 1; // Reset to start step

    // Step 2 & 3 Mapping (AOIs and Mappings)
    let aoiCounter = 1;
    form.aoiDrafts = data.aois.map((aoi: any) => {
        // Instantiate the AreaOfInterestDraft class
        const aoiDraft = new AreaOfInterestDraft(aoi.name, aoi.geomGeoJson, aoiCounter++);
        aoiDraft.aoiId = aoi.aoi_id; 
        aoiDraft.geomProperties = aoi.geom_properties || {};

        // Map algorithms
        aoi.mappedAlgorithms.forEach((algo: any) => {
            aoiDraft.mapAlgorithm(
                algo.mapping_id, 
                algo.algo_id, // We should pass algo_id string here for better mapping logic
                algo.config_args
            );
        });
        return aoiDraft;
    });

    // Step 4 Mapping (Users)
    form.users = data.users.map((u: any) => ({
        userId: u.user_id,
        role: u.role,
        username: u.user_id,
    }));
    
    return form;
}


/**
 * ProjectStore: Manages the state and logic related to Project instances.
 */
export const useProjectStore = defineStore('project', () => {
// ... The rest of the Pinia store remains the same ...
// ... All functions (actions) correctly call mapBackendToForm now ...
    
    // State: Holds the active form object and the list of projects
    const projectForm = ref<ProjectFormData>(new ProjectFormData());
    const userProjects = ref<any[]>([]); 

    const activeAlerts = ref<any[]>([]); // New state for alerts
    
    // Getters
    const isEditing = computed(() => projectForm.value.isUpdateMode);
    const currentStep = computed(() => projectForm.value.currentStep);


    const totalAlerts = computed(() => activeAlerts.value.length); // New getter

    // Actions
    
    function initNewProjectForm() {
        projectForm.value = new ProjectFormData(false, null);
    }

    async function submitProject(): Promise<void> {
        // ... (existing submitProject logic) ...
        const bundle = projectForm.value.toBackendBundle();
        
        // --- ADD DEBUG LOGGING ---
        console.log("--- SUBMIT PAYLOAD ---");
        console.log("Project Name:", bundle.projectBasicInfo.projectName);
        console.log("AOI Count:", bundle.aoiData.length);
        console.log("User Count:", bundle.userData.length);
        console.log("Full Bundle:", JSON.stringify(bundle, null, 2));
        console.log("------------------------");
        // -------------------------

        try {
            const response = await api.createProject(bundle);
            console.log('Project submitted successfully:', response.data);
            
            
            
            projectForm.value.reset();
            
        } catch (error) {
            console.error('Error submitting project:', error);
            // This is critical: Re-throw the error so the UI handles it
            throw new Error('Failed to submit project. See console for API error details.');
        }
    
    }
    
    async function fetchUserProjects(): Promise<void> {
        // ... (existing fetchUserProjects logic) ...

        try {
            const projects = await api.getProjects();
            // --- ADD DEBUG LOGGING ---
            console.log(`[ProjectStore] Fetched ${projects.length} projects.`);
            // -------------------------
            userProjects.value = projects;
        } catch (error) {
            console.error('Error fetching projects:', error);
            userProjects.value = [];
        }
    }

    async function loadProjectForUpdate(projectId: number): Promise<void> {
        try {
            const response = await api.getProjectDetails(projectId);
            projectForm.value = mapBackendToForm(response); 
        } catch (error) {
            console.error(`Error loading project ${projectId}:`, error);
            throw new Error('Failed to load project data for editing.');
        }
    }
    
    async function deleteProject(projectId: number): Promise<void> {
        await api.deleteProject(projectId);
    }

    function addAlert(alert: any) {
        // Ensure unique alerts if loading from Redis/SSE simultaneously
        if (!activeAlerts.value.some(a => a.id === alert.id)) {
             // Add to the beginning of the list (newest first)
            activeAlerts.value.unshift(alert); 
        }
    }

    async function markAlertAsRead(alertId: number) {
        const session = UserSession.getInstance();
        const userId = session.getUserId();
        
        if (!userId) return;

        try {
            // 1. Tell the backend to remove it from Redis
            await api.client.post('/alerts/mark-read', { userId, notificationId: alertId });

            // 2. Remove it locally
            activeAlerts.value = activeAlerts.value.filter(a => a.id !== alertId);
        } catch (error) {
            console.error('Failed to mark alert as read:', error);
            // Optionally, re-add the alert if the API call failed
        }
    }

    // NEW ACTION: Use this in the component to go to the next step
    function nextStep() {
        projectForm.value.nextStep();
    }

    // NEW ACTION: Use this in the component to go to the previous step
    function prevStep() {
        projectForm.value.prevStep();
    }

    return {
        projectForm,
        userProjects,
        isEditing,
        currentStep,
        initNewProjectForm,
        submitProject,
        fetchUserProjects,
        loadProjectForUpdate,
        deleteProject,
        nextStep,
        prevStep,
        activeAlerts, // Return new state
        totalAlerts,  // Return new getter
        addAlert,     // Return new action
        markAlertAsRead, // Return new action


        projectName: computed({
            get: () => projectForm.value.projectName,
            set: (val: string) => { projectForm.value.projectName = val; }
        }),
        description: computed({
            get: () => projectForm.value.description,
            set: (val: string | null) => { projectForm.value.description = val; }
        }),

    };
});


