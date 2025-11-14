// AoiAlgorithmMappingModel.js


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
    status = 1;

    /**
     * @param {Object} data 
     */
    constructor(data) {
        this.id = data.id || null;
        this.projectId = data.project_id;
        this.aoiId = data.aoi_id;
        this.algoId = data.change_algo_id;
        this.configArgs = data.change_algo_configured_args || null;
        this.status = data.status ?? 1;
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
            (project_id, aoi_id, change_algo_id, change_algo_configured_args, status)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id;
        `;
        const values = [
            this.projectId,
            this.aoiId,
            this.algoId,
            this.configArgs,
            this.status
        ];



        const result = await db.query(query, values); // Note: This should ideally use a client
        this.id = result.rows[0].id;
        return this.id;
    }

    static async updateStatus(client, mappingId, newStatus) {
        const query = `
            UPDATE aoi_algorithm_mapping
            SET status = $1
            WHERE id = $2
            RETURNING id;
        `;
        const result = await client.query(query, [newStatus, mappingId]);
        return result.rowCount;
    }

    // NEW: Method to retrieve mappings by project, respecting status
    static async findByProjectId(projectId, includeStatus = [1]) {
        // Convert array to string for PostgreSQL IN clause
        const statusList = includeStatus.join(',');
        const query = `
            SELECT * FROM aoi_algorithm_mapping 
            WHERE project_id = $1 AND status IN (${statusList});
        `;
        const result = await db.query(query, [projectId]);
        return result.rows.map(row => new AoiAlgorithmMappingModel(row));
    }
}


