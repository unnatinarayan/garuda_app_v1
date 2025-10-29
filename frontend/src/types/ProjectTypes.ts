// ProjectTypes.ts
// Re-define the required imported types first (these were already defined in classes)
export interface GeoJsonPolygon {
    type: 'Polygon';
    coordinates: number[][][];
}

/**
 * Defines the complete data structure that the frontend's ProjectFormData.toBackendBundle() 
 * method must produce, and which the backend's ProjectService.createProject() expects.
 */
export interface ProjectCreationBundle {
    projectBasicInfo: {
        projectName: string;
        description: string | null;
        auxData: Record<string, any> | null;
    };
    aoiData: {
        aoiId: string;
        name: string;
        geomGeoJson: GeoJsonPolygon;
        geomProperties: Record<string, any> | null;
        mappedAlgorithms: { algoId: string; configArgs: Record<string, any> }[]; // <-- algoId is now STRING
    }[];
    userData: { userId: string; role: string }[];
}