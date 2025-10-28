// frontend/src/classes/ProjectFormData.ts

import { AreaOfInterestDraft } from './AreaOfInterestDraft';

interface UserRoleAssignment {
    userId: string;
    role: 'owner' | 'analyst' | 'viewer' | string;
    username: string;
}

export interface AuxDataDraft {
    key: string;
    value: string;
}
/**
 * ProjectFormData: Manages the volatile state of the 4-step project configuration process.
 */
export class ProjectFormData {
    public projectName: string = '';
    public description: string = '';
    public auxDataDrafts: AuxDataDraft[] = [];

    public aoiDrafts: AreaOfInterestDraft[] = [];
    public users: UserRoleAssignment[] = [];
    
    public isUpdateMode: boolean = false;
    public currentStep: number = 1;
    public projectIdToUpdate: number | null = null;
    
    constructor(isUpdate: boolean = false, projectId: number | null = null) {
        this.isUpdateMode = isUpdate;
        this.projectIdToUpdate = projectId;
        // Initialize with creator as owner (will be updated/overridden later)
        this.users = [{ userId: 'current_user_id', role: 'owner', username: 'Creator' }]; 
    }

    public nextStep(): void {
        if (this.currentStep < 4) {
            this.currentStep++;
        }
    }
    public prevStep(): void {
        if (this.currentStep > 1) {
            this.currentStep--;
        }
    }

    public addAOIDraft(aoi: AreaOfInterestDraft): void {
        this.aoiDrafts.push(aoi);
    }

    private getFinalAuxData(): Record<string, any> {
        const finalAuxData: Record<string, any> = {};
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

    public toBackendBundle(): any {
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
    
    public reset(): void {
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