// AoiAlgorithmMappingModel


import { DBClient } from '../db/DBClient.ts';

const db = DBClient.getInstance();

export interface AoiAlgorithmMappingData {
    id: number;
    project_id: number; // <-- NEW
    aoi_id: string; // <-- Changed type from number (AOI PK) to string (AOI ID)
    change_algo_id: string; // <-- Changed from number (Algo PK) to string (Algo ID)
    change_algo_configured_args: Record<string, any> | null; // <-- Renamed
}

/**
 * AoiAlgorithmMappingModel: Handles the mapping between AOI and Algorithm, 
 * including configuration arguments.
 */
export class AoiAlgorithmMappingModel {
    public id: number | null;
    public projectId: number; // <-- NEW
    public aoiId: string; // FK to area_of_interest.aoi_id (string)
    public algoId: string; // FK to algorithm_catalogue.algo_id (string)
    public configArgs: Record<string, any> | null;

    constructor(data: Partial<AoiAlgorithmMappingData>) {
        this.id = data.id || null;
        this.projectId = data.project_id!; // <-- NEW
        this.aoiId = data.aoi_id!;
        this.algoId = data.change_algo_id!;
        this.configArgs = data.change_algo_configured_args || null; // <-- Renamed property
    }


    /**
     * Deletes all mappings associated with a project's AOIs.
     * This is no longer necessary since we use CASCADE DELETE on the project table,
     * but the old logic is kept for reference or if the schema changes.
     */
    public static async deleteByProjectId(client: any, projectId: number): Promise<number> {
        const query = `
             DELETE FROM aoi_algorithm_mapping
             WHERE project_id = $1; -- Use project_id directly
        `;
        const result = await client.query(query, [projectId]);
        return result.rowCount;
    }

    /**
     * Saves a single AOI-Algorithm mapping.
     */
    public async save(): Promise<number> {
        // NOTE: The separate save method for AoiAlgorithmMappingModel might be redundant
        // if the insertion logic is done directly in ProjectService, which is preferred
        // for transaction safety. This method is kept as a minimal implementation
        // but it's not currently used in the main ProjectService flow.

        const query = `
            INSERT INTO aoi_algorithm_mapping
            (project_id, aoi_id, change_algo_id, change_algo_configured_args) -- <-- New column names
            VALUES ($1, $2, $3, $4)
            -- You would need a unique constraint on (project_id, aoi_id, change_algo_id) for ON CONFLICT
            -- Assuming the unique constraint is set up in the ProjectService transaction instead.
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
        return this.id!;
    }

    // Add static methods for fetching mappings by aoiId or algoId...
}
