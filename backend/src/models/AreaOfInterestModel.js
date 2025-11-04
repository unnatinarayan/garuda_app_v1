import { DBClient } from '../db/DBClient.js';
// REMOVED: import type { GeoJsonPolygon } from '../types/GeoJson.ts'; // We will define this type below

const db = DBClient.getInstance();

/**
 * AreaOfInterestModel: Handles persistence logic for the 'area_of_interest' table.
 */
export class AreaOfInterestModel {
    id = null;
    projectId;
    aoiId;
    name;
    geomGeoJson; // Frontend will pass GeoJSON Polygon object
    auxData = null;
    geomProperties = null;

    /**
     * @param {Object} data 
     */
    constructor(data) {
        this.id = data.id || null;
        this.projectId = data.project_id || data.projectId;
        this.aoiId = data.aoi_id || '';
        this.name = data.name || '';
        // NOTE: In a full app, you'd convert DB string representation back to GeoJSON object
        this.geomGeoJson = data.geomGeoJson;
        this.auxData = data.auxdata || null;
        this.geomProperties = data.geom_properties || null;
    }


    /**
     * Saves a single AOI to the database (for NEW projects).
     * @param {any} client
     * @returns {Promise<number>}
     */
    async save(client) {
        if (!this.projectId) throw new Error("AOI must be tied to an existing Project.");

        const query = `
            INSERT INTO area_of_interest
            (project_id, aoi_id, name, geom, auxdata, geom_properties)
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
        return this.id;
    }

    /**
     * Deletes all AOIs associated with a project ID.
     * @param {any} client
     * @param {number} projectId
     * @returns {Promise<number>} The number of rows deleted.
     */
    static async deleteByProjectId(client, projectId) {
        const query = `DELETE FROM area_of_interest WHERE project_id = $1;`;
        const result = await client.query(query, [projectId]);
        return result.rowCount;
    }


    /**
     * Fetches all AOIs for a specific project.
     * @param {number} projectId
     * @returns {Promise<AreaOfInterestModel[]>}
     */
    static async findByProjectId(projectId) {
        // NOTE: We use ST_AsGeoJSON to retrieve the geometry in a usable format for the frontend
        const query = `
            SELECT
                id, project_id, aoi_id, name, auxdata, geom_properties,
                ST_AsGeoJSON(geom) AS geom_geojson_string
            FROM area_of_interest
            WHERE project_id = $1;
        `;
        const result = await db.query(query, [projectId]);

        return result.rows.map(row => new AreaOfInterestModel({
            ...row,
            geomGeoJson: JSON.parse(row.geom_geojson_string), // Parse the GeoJSON string back to object
            project_id: row.project_id
        }));
    }

    /**
     * Fetches all mapped algorithms and their configurations for this AOI.
     * @param {any} client
     * @returns {Promise<any[]>}
     */
    async getMappedAlgorithms(client) {
        // CRITICAL: Now joins using the aoi_id (text) and project_id (int) as join keys.
        const query = `
            SELECT
                aam.id as mapping_id,
                aam.change_algo_configured_args as config_args,
                ac.algo_id,
                ac.description,
                ac.category,
                ac.id as algo_pk_id
            FROM aoi_algorithm_mapping aam
            JOIN area_of_interest aoi ON aam.project_id = aoi.project_id AND aam.aoi_id = aoi.aoi_id
            JOIN algorithm_catalogue ac ON aam.change_algo_id = ac.algo_id
            WHERE aam.project_id = $1 AND aam.aoi_id = $2;
        `;
        // Use the passed client for transaction context (important for reuse)
        const result = await client.query(query, [this.projectId, this.aoiId]); // Use projectId and aoiId (string)
        return result.rows;
    }

    // Add update, delete, and other core methods here... to be completed
}
