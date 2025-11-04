// AreaOfInterestDraft.js

export class AreaOfInterestDraft {
    clientAoiId;
    name;
    aoiId;
    geometry;
    mappedAlgorithms = [];
    bufferDistance = null; // NEW: Holds buffer distance in meters
    geometryType = 'Polygon'; // NEW: To know if buffer is needed
    geomProperties = {};


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
        this.geometryType = geometryType;
        this.bufferDistance = bufferDistance;
    }


    mapAlgorithm(algoId, name, configArgs = {}) { // <-- algoId is now string
        const existing = this.mappedAlgorithms.find(a => a.algoId === algoId);
        if (existing) {
            existing.configArgs = configArgs;
        } else {
            this.mappedAlgorithms.push({ algoId, name, configArgs });
        }
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
            name: this.name,
            geomGeoJson: this.geometry,
            geomProperties: geomProps,
            mappedAlgorithms: this.mappedAlgorithms.map(a => ({
                algoId: a.algoId, // <-- Send the string algoId
                configArgs: a.configArgs
            }))
        };
    }
}
