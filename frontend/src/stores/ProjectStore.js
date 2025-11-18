// stores/ProjectStore.js

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { ProjectFormData } from '../classes/ProjectFormData.js';
import { AreaOfInterestDraft } from '../classes/AreaOfInterestDraft.js';
import { ApiClient } from '../api/ApiClient.js';
import { UserSession } from '../classes/UserSession.js';

const api = ApiClient.getInstance();

/**
 * Maps backend data to ProjectFormData for editing
 * FIXED: Proper user and role mapping
 */
function mapBackendToForm(data) {
    const form = new ProjectFormData(true, data.id);

    // Step 1: Basic Info
    form.projectName = data.project_name;
    form.description = data.description;
    form.auxDataDrafts = data.auxdata ? Object.entries(data.auxdata).map(([key, value]) => ({
        key,
        value: typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
    })) : [];

    // Step 2: Users with Roles (FIXED)
    form.users = (data.users || []).map(user => {
        // Handle both object format {userId, roles} and string format
        if (typeof user === 'object' && user.userId) {
            return {
                userId: user.userId,
                roles: user.roles || []
            };
        }
        // Legacy string format
        return {
            userId: user,
            roles: []
        };
    });

    // Step 3: AOIs
    let aoiCounter = 1;
    form.aoiDrafts = data.aois.map((aoi) => {
        let geometry = aoi.geomGeoJson;
        
        if (!geometry) {
            console.error(`AOI ${aoi.name} has no geometry!`);
            return null;
        }

        let geometryType = geometry.type;
        
        if (geometryType === 'GeometryCollection') {
            if (!geometry.geometries || geometry.geometries.length === 0) {
                console.error(`AOI ${aoi.name} has empty GeometryCollection`);
                return null;
            }
        } else {
            if (!geometry.coordinates || geometry.coordinates.length === 0) {
                console.error(`AOI ${aoi.name} has invalid coordinates`);
                return null;
            }
        }

        const bufferDistance = aoi.geom_properties?.buffer || null;

        const aoiDraft = new AreaOfInterestDraft(
            aoi.name,
            geometry,
            aoiCounter++,
            geometryType,
            bufferDistance
        );

        aoiDraft.aoiId = aoi.aoi_id;
        aoiDraft.dbId = aoi.id;
        aoiDraft.status = aoi.status || 1;
        aoiDraft.geomProperties = {
            ...(aoi.geom_properties || {}),
            originalType: geometryType,
            buffer: bufferDistance,
            bufferConfig: aoi.geom_properties?.bufferConfig || null
        };

        return aoiDraft;
    }).filter(draft => draft !== null);

    // Step 4: Subscriptions
    form.subscriptions = [];
    data.aois.forEach(aoi => {
        if (aoi.subscriptions && aoi.subscriptions.length > 0) {
            aoi.subscriptions.forEach(sub => {
                const aoiDraft = form.aoiDrafts.find(d => d.aoiId === aoi.aoi_id);
                if (aoiDraft) {
                    form.subscriptions.push({
                        aoiId: aoi.aoi_id,
                        clientAoiId: aoiDraft.clientAoiId,
                        channelId: sub.channelId,
                        userIds: sub.userIds || [],
                        subscriptionId: sub.subscriptionId,
                        status: sub.status || 1,
                        alertDisseminationMode: sub.alertDisseminationMode || ['notify'],
                        auxData: sub.auxData || null
                    });
                }
            });
        }
    });

    console.log('[ProjectStore] Mapped form data:', {
        users: form.users.length,
        aois: form.aoiDrafts.length,
        subscriptions: form.subscriptions.length
    });

    form.currentStep = 1;
    return form;
}

/**
 * ProjectStore: Manages project state and operations
 */
export const useProjectStore = defineStore('project', () => {
    const projectForm = ref(new ProjectFormData());
    const userProjects = ref([]);
    const activeAlerts = ref([]);

    const isEditing = computed(() => projectForm.value.isUpdateMode);
    const currentStep = computed(() => projectForm.value.currentStep);
    const totalAlerts = computed(() => activeAlerts.value.length);

    function initNewProjectForm() {
        projectForm.value = new ProjectFormData(false, null);
    }

    async function submitProject() {
        const bundle = projectForm.value.toBackendBundle();

        console.log("--- SUBMIT PAYLOAD ---");
        console.log("Is Update Mode:", projectForm.value.isUpdateMode);
        console.log("Project Name:", bundle.projectBasicInfo.projectName);
        console.log("User Count:", bundle.userData.length);
        console.log("AOI Count:", bundle.aoiData.length);
        console.log("Subscription Count:", bundle.subscriptionData?.length || 0);
        console.log("Users:", JSON.stringify(bundle.userData, null, 2));
        console.log("Subscriptions:", JSON.stringify(bundle.subscriptionData, null, 2));
        console.log("------------------------");

        try {
            let response;
            if (projectForm.value.isUpdateMode && projectForm.value.projectIdToUpdate) {
                response = await api.updateProject(projectForm.value.projectIdToUpdate, bundle);
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
            userProjects.value = projects;
        } catch (error) {
            console.error('Error fetching projects:', error);
            userProjects.value = [];
        }
    }

    async function loadProjectForUpdate(projectId) {
        try {
            const response = await api.getProjectDetails(projectId);
            console.log('[ProjectStore] Loaded project data:', response);

            projectForm.value = mapBackendToForm(response);

            console.log('[ProjectStore] Mapped form data:', {
                users: projectForm.value.users.length,
                aois: projectForm.value.aoiDrafts.length,
                subscriptions: projectForm.value.subscriptions.length
            });
        } catch (error) {
            console.error(`Error loading project ${projectId}:`, error);
            throw new Error('Failed to load project data for editing.');
        }
    }

    async function deleteProject(projectId) {
        await api.deleteProject(projectId);
    }

    function addAlert(alert) {
        if (!activeAlerts.value.some(a => a.id === alert.id)) {
            activeAlerts.value.unshift(alert);
        }
    }

    async function markAlertAsRead(alertId) {
        const session = UserSession.getInstance();
        const userId = session.userId;

        if (!userId) return;

        try {
            await api.client.post('/alerts/mark-read', { userId, notificationId: alertId });
        } catch (error) {
            console.error('Failed to mark alert as read:', error);
            throw error;
        }
    }

    function nextStep() {
        projectForm.value.nextStep();
    }

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
        activeAlerts,
        totalAlerts,
        addAlert,
        markAlertAsRead,
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