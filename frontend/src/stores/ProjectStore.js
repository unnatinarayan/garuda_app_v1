// stores/ProjectStore.js 


import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { ProjectFormData } from '../classes/ProjectFormData.js';
import { AreaOfInterestDraft } from '../classes/AreaOfInterestDraft.js';
import { ApiClient } from '../api/ApiClient.js';
import { UserSession } from '../classes/UserSession.js'; // Added UserSession import

const api = ApiClient.getInstance();

/**
 * Helper function to map the complex backend structure to the simpler ProjectFormData class structure.
 */
function mapBackendToForm(data) {

    // Instantiate the ProjectFormData class
    const form = new ProjectFormData(true, data.id); // Set to update mode

    // Step 1 Mapping
    form.projectName = data.project_name; // <-- Backend alias is used
    form.description = data.description;
    // Map JSONB object to key/value drafts for the form UI
    form.auxDataDrafts = data.auxdata ? Object.entries(data.auxdata).map(([key, value]) => ({
        key,
        value: typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
    })) : [];
    form.currentStep = 1; // Reset to start step

    // Step 2 & 3 Mapping (AOIs and Mappings)
    let aoiCounter = 1;
    form.aoiDrafts = data.aois.map((aoi) => {

        const geometryType = aoi.geomGeoJson?.type ||
            aoi.geom_properties?.originalType ||
            'Polygon';

        // Extract buffer distance
        const bufferDistance = aoi.geom_properties?.buffer || null;

        // Instantiate the AreaOfInterestDraft class
        const aoiDraft = new AreaOfInterestDraft(
            aoi.name,
            aoi.geomGeoJson,
            aoiCounter++,
            geometryType,
            bufferDistance
            // aoi.geom_properties?.originalType || 'Polygon', // Preserve original geometry type
            // aoi.geom_properties?.buffer || null
        );
        aoiDraft.aoiId = aoi.aoi_id;
        aoiDraft.dbId = aoi.id; // NEW: Store database ID
        aoiDraft.status = aoi.status || 1;

        aoiDraft.geomProperties = {
            ...aoi.geom_properties,
            originalType: geometryType,
            buffer: bufferDistance
        };
        // aoiDraft.geomProperties = aoi.geom_properties || {};

        // Map algorithms
        
        if (aoi.mappedAlgorithms && aoi.mappedAlgorithms.length > 0) {
            aoi.mappedAlgorithms.forEach((algo) => {
                // Push full object with all required properties
                aoiDraft.mappedAlgorithms.push({
                    algoId: algo.algo_id,
                    name: algo.algo_id,
                    configArgs: algo.config_args || {},
                    status: algo.status, // CRITICAL: Map status from backend
                    mappingId: algo.mapping_id // CRITICAL: Map the database ID
                });
            });
        }
        
        return aoiDraft;
    });

    // Step 4 Mapping (Users)
    form.users = data.users.map((u) => ({
        userId: u.user_id,
        role: u.user_role,
        username: u.user_id,
    }));

    return form;
}


/**
 * ProjectStore: Manages the state and logic related to Project instances.
 */
export const useProjectStore = defineStore('project', () => {

    // State: Holds the active form object and the list of projects
    const projectForm = ref(new ProjectFormData());
    const userProjects = ref([]);

    const activeAlerts = ref([]); // New state for alerts

    // Getters
    const isEditing = computed(() => projectForm.value.isUpdateMode);
    const currentStep = computed(() => projectForm.value.currentStep);


    const totalAlerts = computed(() => activeAlerts.value.length); // New getter

    // Actions

    function initNewProjectForm() {
        projectForm.value = new ProjectFormData(false, null);
    }

    async function submitProject() {
        const bundle = projectForm.value.toBackendBundle();

        // --- ADD DEBUG LOGGING ---
        console.log("--- SUBMIT PAYLOAD ---");
        console.log("Is Update Mode:", projectForm.value.isUpdateMode);
        console.log("Project Name:", bundle.projectBasicInfo.projectName);
        console.log("AOI Count:", bundle.aoiData.length);
        console.log("User Count:", bundle.userData.length);
        console.log("Full Bundle:", JSON.stringify(bundle, null, 2));
        console.log("------------------------");
        // -------------------------


        try {
            let response;
            if (projectForm.value.isUpdateMode && projectForm.value.projectIdToUpdate) {
                // *** CRITICAL UPDATE LOGIC ***
                response = await api.updateProject(projectForm.value.projectIdToUpdate, bundle);
                // *****************************
            } else {
                response = await api.createProject(bundle);
            }

            console.log('Project submitted successfully:', response.data);

            projectForm.value.reset();

        } catch (error) {
            console.error('Error submitting project:', error);
            throw new Error('Failed to submit project. See console for API error details.');
        }


    }

    async function fetchUserProjects() {
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

    // Use this function in your loadProjectForUpdate action:
    async function loadProjectForUpdate(projectId) {
        try {
            const response = await api.getProjectDetails(projectId);
            console.log('[ProjectStore] Loaded project data:', response);
            console.log('[ProjectStore] Number of AOIs:', response.aois?.length);

            projectForm.value = mapBackendToForm(response);

            console.log('[ProjectStore] Mapped AOI drafts:', projectForm.value.aoiDrafts.length);
            console.log('[ProjectStore] First AOI geometry:', projectForm.value.aoiDrafts[0]?.geomGeoJson);
        } catch (error) {
            console.error(`Error loading project ${projectId}:`, error);
            throw new Error('Failed to load project data for editing.');
        }
    }

    async function deleteProject(projectId) {
        await api.deleteProject(projectId);
    }

    function addAlert(alert) {
        // Ensure unique alerts if loading from Redis/SSE simultaneously
        if (!activeAlerts.value.some(a => a.id === alert.id)) {
            // Add to the beginning of the list (newest first)
            activeAlerts.value.unshift(alert);
        }
    }

    async function markAlertAsRead(alertId) {
        const session = UserSession.getInstance();
        // const userId = session.getUserId();
        const userId = session.userId;

        if (!userId) return;

        try {
            // 1. Tell the backend to remove it from Redis
            await api.client.post('/alerts/mark-read', { userId, notificationId: alertId });

            // 2. Remove it locally
            // activeAlerts.value = activeAlerts.value.filter(a => a.id !== alertId);
        } catch (error) {
            console.error('Failed to mark alert as read:', error);
            // Optionally, re-add the alert if the API call failed
            throw error;
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
            set: (val) => { projectForm.value.projectName = val; }
        }),
        description: computed({
            get: () => projectForm.value.description,
            set: (val) => { projectForm.value.description = val; }
        }),

    };
});




// if (aoi.mappedAlgorithms && aoi.mappedAlgorithms.length > 0) {
        //     aoi.mappedAlgorithms.forEach((algo) => {
        //         aoiDraft.mapAlgorithm(
        //             algo.algo_id,
        //             algo.algo_id,
        //             algo.config_args || {}
        //         );
        //     });
        // }