// AreaOfInterestDraft.js

export class AreaOfInterestDraft {
    clientAoiId;
    name;
    aoiId;
    geometry;
    geomGeoJson; 
    mappedAlgorithms = [];
    bufferDistance = null; // NEW: Holds buffer distance in meters
    geometryType = 'Polygon'; // NEW: To know if buffer is needed
    geomProperties = {};
    status = 1; // NEW: Track AOI status (1=active, 2=removed)
    dbId = null;


    constructor(
        name,
        geometry,
        clientAoiId,
        geometryType = 'Polygon', // Default added
        bufferDistance = null
    ) {
        this.clientAoiId = clientAoiId;
        this.name = name;
        this.aoiId = `aoi-${clientAoiId}`;
        this.geometry = geometry;
        this.geomGeoJson = geometry;
        this.geometryType = geometryType;
        this.bufferDistance = bufferDistance;

        this.geomProperties = {
            originalType: geometryType,
            buffer: bufferDistance
        };
    }


    /**
     * CART OPERATION: Add or update an algorithm mapping
     * @param {string} algoId - Algorithm ID from catalogue
     * @param {string} name - Display name
     * @param {Object} configArgs - Configuration arguments
     * @param {number} status - 1=active, 0=inactive, 2=removed
     * @param {number|null} mappingId - Database mapping ID (null for new)
     */
    
    mapAlgorithm(algoId, name, configArgs = {}, status = 1, mappingId = null) { 
    // Find mapping by algoId OR if argument combinations differ (multiple mappings to same algo)
    // For simplicity, we assume one mapping per unique algoId for creation/simple selection UI.
    const existing = this.mappedAlgorithms.find(a => a.algoId === algoId && a.mappingId === mappingId);

    if (existing) {
        existing.configArgs = configArgs;
        existing.status = status; // Update status in edit flow
    } else {
        // For new mappings (mappingId is null), status defaults to 1
        this.mappedAlgorithms.push({ algoId, name, configArgs, status: status, mappingId: mappingId });
    }
}

/**
     * CART OPERATION: Remove algorithm (soft delete)
     */
    removeAlgorithm(algoId, mappingId = null) {
        const mapping = this.mappedAlgorithms.find(a => 
            a.algoId === algoId && a.mappingId === mappingId
        );
        
        if (mapping) {
            if (mapping.mappingId) {
                // Existing mapping: mark as removed
                mapping.status = 2;
            } else {
                // New mapping: remove from cart entirely
                this.mappedAlgorithms = this.mappedAlgorithms.filter(a => 
                    !(a.algoId === algoId && a.mappingId === mappingId)
                );
            }
        }
    }

    /**
     * CART OPERATION: Toggle active/inactive
     */
    toggleAlgorithmStatus(algoId, mappingId = null) {
        const mapping = this.mappedAlgorithms.find(a => 
            a.algoId === algoId && a.mappingId === mappingId
        );
        
        if (mapping && mapping.mappingId) {
            mapping.status = mapping.status === 1 ? 0 : 1;
        }
    }

    /**
     * Get only active/visible algorithms for UI display
     */
    getActiveAlgorithms() {
        return this.mappedAlgorithms.filter(a => a.status !== 2);
    }

    /**
     * Mark this AOI for deletion (soft delete)
     */
    markForDeletion() {
        this.status = 2;
        // Also mark all mappings as removed
        this.mappedAlgorithms.forEach(a => {
            if (a.mappingId) a.status = 2;
        });
    }



    toBackendData() {
        // Prepare geomProperties for the backend (ProjectService)
        const geomProps = {
            ...this.geomProperties,
            // Include buffer distance and geometry type for backend PostGIS processing
            originalType: this.geometryType,
            buffer: this.bufferDistance,
        };

        return {
            aoiId: this.aoiId,
            dbId: this.dbId, // NEW: Include DB ID for updates
            name: this.name,
            geomGeoJson: this.geometry,
            geomProperties: geomProps,
            status: this.status, // NEW: Include status
            mappedAlgorithms: this.mappedAlgorithms.map(a => ({
                algoId: a.algoId,
                configArgs: a.configArgs,
                status: a.status,
                mappingId: a.mappingId // NEW: Include mapping ID
            }))
        };
    }
}
