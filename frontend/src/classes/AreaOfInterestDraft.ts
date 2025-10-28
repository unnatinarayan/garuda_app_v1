
// frontend/src/classes/AreaOfInterestDraft.ts

export interface GeoJsonPolygon {
    type: 'Polygon';
    coordinates: number[][][];
}

interface MappedAlgorithm {
    algoId: number; // The primary key ID of the algorithm from the catalogue
    name: string;   // For display in the UI
    configArgs: Record<string, any>; // Specific arguments for this AOI/Algo
}

export class AreaOfInterestDraft {
    public clientAoiId: number; 
    public name: string;
    public aoiId: string; 
    public geometry: GeoJsonPolygon;
    public mappedAlgorithms: MappedAlgorithm[] = [];
    public bufferDistance: number | null; // NEW: Holds buffer distance in meters
    public geometryType: 'Polygon' | 'LineString' | 'Point'; // NEW: To know if buffer is needed
    public geomProperties: Record<string, any> = {};
    
    
    
    constructor(
        name: string, 
        geometry: GeoJsonPolygon, 
        clientAoiId: number, 
        geometryType: 'Polygon' | 'LineString' | 'Point' = 'Polygon', // Default added
        bufferDistance: number | null = null
    ) {
        this.clientAoiId = clientAoiId;
        this.name = name;
        this.aoiId = `aoi-${clientAoiId}`; 
        this.geometry = geometry;
        this.geometryType = geometryType;
        this.bufferDistance = bufferDistance;
    }

   

    public mapAlgorithm(algoId: number, name: string, configArgs: Record<string, any> = {}): void {
        const existing = this.mappedAlgorithms.find(a => a.algoId === algoId);
        if (existing) {
            existing.configArgs = configArgs;
        } else {
            this.mappedAlgorithms.push({ algoId, name, configArgs });
        }
    }
    

    public toBackendData(): any {
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
                algoId: a.algoId,
                configArgs: a.configArgs
            }))
        };
    }
}