//AreaOfInterestModel.ts


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
    auxdata: Record<string, any> | null; // <-- Removed publish_flag
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
    public geomProperties: Record<string, any> | null; // <-- Removed publishFlag

    constructor(data: Partial<AreaOfInterestData> & { geomGeoJson?: GeoJsonPolygon, projectId: number }) {
        this.id = data.id || null;
        this.projectId = data.project_id || data.projectId;
        this.aoiId = data.aoi_id || '';
        this.name = data.name || '';
        // NOTE: In a full app, you'd convert DB string representation back to GeoJSON object
        this.geomGeoJson = data.geomGeoJson as GeoJsonPolygon;
        this.auxData = data.auxdata || null;
        this.geomProperties = data.geom_properties || null;
    }


    /**
     * Saves a single AOI to the database (for NEW projects).
     * The geometry is converted from GeoJSON string to PostGIS GEOMETRY.
     */
    public async save(client: any): Promise<number> {
        if (!this.projectId) throw new Error("AOI must be tied to an existing Project.");

        const query = `
            INSERT INTO area_of_interest
            (project_id, aoi_id, name, geom, auxdata, geom_properties) -- <-- Removed publish_flag
            VALUES ($1, $2, $3, ST_GeomFromGeoJSON($4), $5, $6)
            RETURNING id;
        `;
        const geomString = JSON.stringify(this.geomGeoJson);

        const values = [
            this.projectId,
            this.aoiId,
            this.name,
            geomString,
            this.auxData,
            this.geomProperties
        ];

        // Use the passed client for transaction context
        const result = await client.query(query, values);
        this.id = result.rows[0].id;
        return this.id!;
    }

    /**
     * Deletes all AOIs associated with a project ID.
     * This is used during an UPDATE to clear existing AOIs before re-inserting the new list.
     * @returns The number of rows deleted.
     */
    public static async deleteByProjectId(client: any, projectId: number): Promise<number> {
        const query = `DELETE FROM area_of_interest WHERE project_id = $1;`;
        const result = await client.query(query, [projectId]);
        return result.rowCount;
    }


    /**
     * Fetches all AOIs for a specific project.
     */
    public static async findByProjectId(projectId: number): Promise<AreaOfInterestModel[]> {
        // NOTE: We use ST_AsGeoJSON to retrieve the geometry in a usable format for the frontend
        const query = `
            SELECT
                id, project_id, aoi_id, name, auxdata, geom_properties, -- <-- Removed publish_flag
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
        // CRITICAL: Now joins using the aoi_id (text) and project_id (int) as join keys.
        // Also joins to algorithm_catalogue using algo_id (text) instead of id (int).
        const query = `
            SELECT
                aam.id as mapping_id,
                aam.change_algo_configured_args as config_args, -- <-- Corrected column name
                ac.algo_id,
                ac.description,
                ac.category,
                ac.id as algo_pk_id -- Included the PK 'id' for frontend convenience
            FROM aoi_algorithm_mapping aam
            -- Join condition: aoi_algorithm_mapping uses project_id and aoi_id for linkage
            JOIN area_of_interest aoi ON aam.project_id = aoi.project_id AND aam.aoi_id = aoi.aoi_id
            -- Join to algorithm catalogue using the algo_id (text)
            JOIN algorithm_catalogue ac ON aam.change_algo_id = ac.algo_id
            -- Filter by the current AOI's aoi_id and project_id for specificity
            WHERE aam.project_id = $1 AND aam.aoi_id = $2;
        `;
        // Use the passed client for transaction context (important for reuse)
        const result = await client.query(query, [this.projectId, this.aoiId]); // Use projectId and aoiId (string)
        return result.rows;
    }

    // Add update, delete, and other core methods here... to be completed
}