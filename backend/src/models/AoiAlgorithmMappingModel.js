import { DBClient } from '../db/DBClient.js';

const db = DBClient.getInstance();

/**
 * AoiAlgorithmMappingModel: Handles the mapping between AOI and Algorithm, 
 * including configuration arguments.
 */
export class AoiAlgorithmMappingModel {
    id = null;
    projectId;
    aoiId;
    algoId;
    configArgs = null;

    /**
     * @param {Object} data 
     */
    constructor(data) {
        this.id = data.id || null;
        this.projectId = data.project_id;
        this.aoiId = data.aoi_id;
        this.algoId = data.change_algo_id;
        this.configArgs = data.change_algo_configured_args || null;
    }


    /**
     * Deletes all mappings associated with a project's AOIs.
     * @param {any} client
     * @param {number} projectId
     * @returns {Promise<number>}
     */
    static async deleteByProjectId(client, projectId) {
        const query = `
             DELETE FROM aoi_algorithm_mapping
             WHERE project_id = $1;
        `;
        const result = await client.query(query, [projectId]);
        return result.rowCount;
    }

    /**
     * Saves a single AOI-Algorithm mapping.
     * @returns {Promise<number>}
     */
    async save() {
        // NOTE: This method is kept as a minimal implementation
        // but it's not currently used in the main ProjectService flow.

        const query = `
            INSERT INTO aoi_algorithm_mapping
            (project_id, aoi_id, change_algo_id, change_algo_configured_args)
            VALUES ($1, $2, $3, $4)
            RETURNING id;
        `;
        const values = [
            this.projectId,
            this.aoiId,
            this.algoId,
            this.configArgs
        ];

        const result = await db.query(query, values); // Note: This should ideally use a client
        this.id = result.rows[0].id;
        return this.id;
    }

    // Add static methods for fetching mappings by aoiId or algoId...
}
