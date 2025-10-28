// backend/src/types/GeoJson.ts

/**
 * Defines the GeoJSON Polygon geometry type for use in backend models.
 * Coordinates are [longitude, latitude].
 */
export interface GeoJsonPolygon {
    type: 'Polygon';
    coordinates: number[][][];
    // Optional additional GeoJSON properties could be added here
}

/**
 * A simplified interface for a GeoJSON Feature object.
 */
export interface GeoJsonFeature {
    type: 'Feature';
    geometry: GeoJsonPolygon;
    properties: Record<string, any>;
}