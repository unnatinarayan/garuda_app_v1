//AreaOfInterestModel.ts

import { DBClient } from '../db/DBClient.ts';
import type { GeoJsonPolygon } from '../types/GeoJson.ts'; // We will define this type below

const db = DBClient.getInstance();

export interface AreaOfInterestData {
    id: number;
    project_id: number;
    aoi_id: string;
    name: string;
    geom: string; // Stored as GEOMETRY in DB, handled as GeoJSON string/object here
    auxdata: Record<string, any> | null;
    publish_flag: boolean;
    geom_properties: Record<string, any> | null;
}

/**
 * AreaOfInterestModel: Handles persistence logic for the 'area_of_interest' table.
 */
export class AreaOfInterestModel {
    public id: number | null;
    public projectId: number;
    public aoiId: string;
    public name: string;
    public geomGeoJson: GeoJsonPolygon; // Frontend will pass GeoJSON Polygon object
    public auxData: Record<string, any> | null;
    public publishFlag: boolean;
    public geomProperties: Record<string, any> | null;

    constructor(data: Partial<AreaOfInterestData> & { geomGeoJson?: GeoJsonPolygon, projectId: number }) {
        this.id = data.id || null;
        this.projectId = data.project_id || data.projectId;
        this.aoiId = data.aoi_id || '';
        this.name = data.name || '';
        // NOTE: In a full app, you'd convert DB string representation back to GeoJSON object
        this.geomGeoJson = data.geomGeoJson as GeoJsonPolygon;
        this.auxData = data.auxdata || null;
        this.publishFlag = data.publish_flag ?? true;
        this.geomProperties = data.geom_properties || null;
    }

    /**
     * Saves a single AOI to the database.
     * The geometry is converted from GeoJSON string to PostGIS GEOMETRY.
     */
    public async save(): Promise<number> {
        if (!this.projectId) throw new Error("AOI must be tied to an existing Project.");
        
        const query = `
            INSERT INTO area_of_interest 
            (project_id, aoi_id, name, geom, auxdata, publish_flag, geom_properties)
            VALUES ($1, $2, $3, ST_GeomFromGeoJSON($4), $5, $6, $7)
            RETURNING id;
        `;
        // Convert the GeoJSON object to a string for the PostGIS function
        const geomString = JSON.stringify(this.geomGeoJson);
        
        const values = [
            this.projectId,
            this.aoiId,
            this.name,
            geomString,
            this.auxData,
            this.publishFlag,
            this.geomProperties
        ];
        
        const result = await db.query(query, values);
        this.id = result.rows[0].id;
        return this.id!;
    }
    
    /**
     * Fetches all AOIs for a specific project.
     */
    public static async findByProjectId(projectId: number): Promise<AreaOfInterestModel[]> {
        // NOTE: We use ST_AsGeoJSON to retrieve the geometry in a usable format for the frontend
        const query = `
            SELECT 
                id, project_id, aoi_id, name, auxdata, publish_flag, geom_properties,
                ST_AsGeoJSON(geom) AS geom_geojson_string 
            FROM area_of_interest 
            WHERE project_id = $1;
        `;
        const result = await db.query(query, [projectId]);

        return result.rows.map(row => new AreaOfInterestModel({
            ...row, 
            geomGeoJson: JSON.parse(row.geom_geojson_string), // Parse the GeoJSON string back to object
            project_id: row.project_id // Ensure projectId is passed
        }));
    }

    /**
     * Fetches all mapped algorithms and their configurations for this AOI.
     */
    public async getMappedAlgorithms(client: any): Promise<any[]> {
        const query = `
            SELECT 
                aam.id as mapping_id,
                aam.config_args,
                ac.algo_id,
                ac.description,
                ac.category
            FROM aoi_algorithm_mapping aam
            JOIN algorithm_catalogue ac ON aam.algo_id = ac.id
            WHERE aam.aoi_id = $1;
        `;
        // Use the passed client for transaction context (important for reuse)
        const result = await client.query(query, [this.id]); 
        return result.rows;
    }

    // Add update, delete, and other core methods here... to be completed
}

