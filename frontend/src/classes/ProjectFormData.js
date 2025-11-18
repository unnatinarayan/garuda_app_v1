// classes/ProjectFormData.js

/**
 * ProjectFormData: Manages the volatile state of the 4-step project configuration process.
 * FIXED: Proper user role handling
 */
export class ProjectFormData {
    projectName = '';
    description = '';
    auxDataDrafts = [];

    users = []; // FIXED: Array of {userId: string, roles: number[]}
    aoiDrafts = [];
    subscriptions = [];

    isUpdateMode = false;
    currentStep = 1;
    projectIdToUpdate = null;

    constructor(isUpdate = false, projectId = null) {
        this.isUpdateMode = isUpdate;
        this.projectIdToUpdate = projectId;
        this.users = [];
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
                try {
                    finalAuxData[item.key] = JSON.parse(item.value);
                } catch {
                    finalAuxData[item.key] = item.value;
                }
            }
        });
        return finalAuxData;
    }

    /**
     * Get the correct aoiId for a given clientAoiId
     */
    getAoiIdForClient(clientAoiId) {
        const aoi = this.aoiDrafts.find(a => a.clientAoiId === clientAoiId);
        if (!aoi) return null;
        
        return aoi.aoiId || `aoi_${clientAoiId}`;
    }

    /**
     * Adds or updates a subscription
     */
    addOrUpdateSubscription(clientAoiId, channelId, userIds, subscriptionId = null) {
        const aoiId = this.getAoiIdForClient(clientAoiId);
        
        if (!aoiId) {
            console.error(`Cannot create subscription: AOI with clientAoiId ${clientAoiId} not found`);
            return;
        }

        let existingIndex = -1;
        
        if (subscriptionId) {
            existingIndex = this.subscriptions.findIndex(s => s.subscriptionId === subscriptionId);
        } else {
            const userIdsStr = JSON.stringify([...userIds].sort());
            existingIndex = this.subscriptions.findIndex(s => 
                s.aoiId === aoiId && 
                s.channelId === channelId &&
                JSON.stringify([...s.userIds].sort()) === userIdsStr &&
                s.status !== 2
            );
        }

        const subscription = {
            aoiId,
            clientAoiId,
            channelId,
            userIds: [...userIds],
            subscriptionId,
            status: 1,
            alertDisseminationMode: ['notify'],
            auxData: null
        };

        if (existingIndex >= 0) {
            this.subscriptions[existingIndex] = subscription;
        } else {
            this.subscriptions.push(subscription);
        }
    }

    /**
     * Soft deletes a subscription
     */
    softDeleteSubscription(subscription) {
        const index = this.subscriptions.findIndex(
            s => s.clientAoiId === subscription.clientAoiId && 
                 s.channelId === subscription.channelId && 
                 s.subscriptionId === subscription.subscriptionId &&
                 s.status !== 2
        );

        if (index === -1) {
            console.warn('Subscription not found for soft deletion:', subscription);
            return;
        }

        if (this.subscriptions[index].subscriptionId) {
            this.subscriptions[index].status = 0;
        } else {
            this.subscriptions.splice(index, 1);
        }
    }

    /**
     * Hard removes a subscription (status=2)
     */
    hardRemoveSubscription(clientAoiIdOrSubscription, channelId = null) {
        let subscription = null;
        if (typeof clientAoiIdOrSubscription === 'object' && clientAoiIdOrSubscription !== null) {
            subscription = clientAoiIdOrSubscription;
        } else {
            subscription = this.subscriptions.find(
                s => (s.aoiId === clientAoiIdOrSubscription || s.clientAoiId === clientAoiIdOrSubscription) 
                    && s.channelId === channelId
            );
        }

        if (!subscription) {
            console.warn('Subscription not found for removal');
            return;
        }

        const index = this.subscriptions.findIndex(s => s === subscription);
        if (index === -1) return;

        if (subscription.subscriptionId) {
            this.subscriptions[index].status = 2;
        } else {
            this.subscriptions.splice(index, 1);
        }
    }

    /**
     * Gets subscriptions for a specific AOI
     */
    getSubscriptionsForAoi(clientAoiId, includeSoftDeleted = false) {
        if (includeSoftDeleted) {
            return this.subscriptions.filter(
                s => s.clientAoiId === clientAoiId && s.status !== 2
            );
        }
        return this.subscriptions.filter(
            s => s.clientAoiId === clientAoiId && s.status === 1
        );
    }

    /**
     * Check if an AOI has at least one active subscription
     */
    aoiHasSubscription(clientAoiId) {
        return this.subscriptions.some(
            s => s.clientAoiId === clientAoiId && s.status === 1
        );
    }

    /**
     * Removes a subscription
     */
    removeSubscription(clientAoiIdOrSubscription, channelId = null) {
        let subscription = null;
        
        if (typeof clientAoiIdOrSubscription === 'object' && clientAoiIdOrSubscription !== null) {
            subscription = clientAoiIdOrSubscription;
        } else {
            subscription = this.subscriptions.find(
                s => (s.aoiId === clientAoiIdOrSubscription || s.clientAoiId === clientAoiIdOrSubscription) 
                    && s.channelId === channelId
            );
        }

        if (!subscription) {
            console.warn('Subscription not found for removal');
            return;
        }

        const index = this.subscriptions.findIndex(s => s === subscription);
        if (index === -1) return;

        if (subscription.subscriptionId) {
            this.subscriptions[index].status = 2;
        } else {
            this.subscriptions.splice(index, 1);
        }
    }

    /**
     * FIXED: Converts to backend bundle format with proper user/role structure
     */
    toBackendBundle() {
        const finalAuxData = this.getFinalAuxData();
        
        return {
            projectBasicInfo: {
                projectName: this.projectName,
                description: this.description,
                auxData: Object.keys(finalAuxData).length > 0 ? finalAuxData : null,
            },
            // FIXED: Handle both object and string user formats for backwards compatibility
            userData: this.users.map(user => {
                // If user is already an object with userId and roles
                if (typeof user === 'object' && user.userId) {
                    return {
                        userId: user.userId,
                        roles: user.roles || []
                    };
                }
                // If user is just a string (legacy format)
                return {
                    userId: user,
                    roles: []
                };
            }),
            aoiData: this.aoiDrafts.map(draft => {
                const aoiData = draft.toBackendData();
                if (!aoiData.aoiId) {
                    aoiData.aoiId = `aoi_${draft.clientAoiId}`;
                }
                return aoiData;
            }),
            subscriptionData: this.subscriptions.map(sub => ({
                aoiId: sub.aoiId,
                channelId: sub.channelId,
                userIds: sub.userIds,
                alertDisseminationMode: sub.alertDisseminationMode,
                auxData: sub.auxData,
                status: sub.status,
                subscriptionId: sub.subscriptionId
            }))
        };
    }

    reset() {
        this.projectName = '';
        this.description = '';
        this.auxDataDrafts = [];
        this.users = [];
        this.aoiDrafts = [];
        this.subscriptions = [];
        this.isUpdateMode = false;
        this.currentStep = 1;
        this.projectIdToUpdate = null;
    }
}