// ProjectFormData.js


import { AreaOfInterestDraft } from './AreaOfInterestDraft.js';

/**
 * ProjectFormData: Manages the volatile state of the 4-step project configuration process.
 */
export class ProjectFormData {
    projectName = '';
    description = '';
    auxDataDrafts = [];

    aoiDrafts = [];
    users = [];

    isUpdateMode = false;
    currentStep = 1;
    projectIdToUpdate = null;

    constructor(isUpdate = false, projectId = null) {
        this.isUpdateMode = isUpdate;
        this.projectIdToUpdate = projectId;
        // Initialize with creator as owner (will be updated/overridden later)
        this.users = [{ userId: 'current_user_id', role: 'owner', username: 'Creator' }];
    }

    nextStep() {
        if (this.currentStep < 4) {
            this.currentStep++;
        }
    }
    prevStep() {
        if (this.currentStep > 1) {
            this.currentStep--;
        }
    }

    addAOIDraft(aoi) {
        this.aoiDrafts.push(aoi);
    }

    getFinalAuxData() {
        const finalAuxData = {};
        this.auxDataDrafts.forEach(item => {
            if (item.key && item.value) {
                // Try to parse non-string values (numbers, booleans, objects)
                try {
                    finalAuxData[item.key] = JSON.parse(item.value);
                } catch {
                    finalAuxData[item.key] = item.value;
                }
            }
        });
        return finalAuxData;
    }

    toBackendBundle() {
        // CRITICAL FIX: Ensure projectName and description are included here
        const finalAuxData = this.getFinalAuxData();
        return {
            projectBasicInfo: {
                projectName: this.projectName,
                description: this.description,
                auxData: Object.keys(finalAuxData).length > 0 ? finalAuxData : null,
            },
            aoiData: this.aoiDrafts.map(draft => draft.toBackendData()),
            userData: this.users.map(u => ({ userId: u.userId, role: u.role })),
        };
    }

    reset() {
        this.projectName = '';
        this.description = '';
        this.auxDataDrafts = [];
        this.aoiDrafts = [];
        this.users = [{ userId: 'current_user_id', role: 'owner', username: 'Creator' }];
        this.isUpdateMode = false;
        this.currentStep = 1;
        this.projectIdToUpdate = null;
    }
}
