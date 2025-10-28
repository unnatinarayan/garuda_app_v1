// AoiAlgorithmMappingModel


import { DBClient } from '../db/DBClient.ts';

const db = DBClient.getInstance();

export interface AoiAlgorithmMappingData {
    id: number;
    aoi_id: number;
    algo_id: number;
    config_args: Record<string, any> | null;
}

/**
 * AoiAlgorithmMappingModel: Handles the mapping between AOI and Algorithm, 
 * including configuration arguments.
 */
export class AoiAlgorithmMappingModel {
    public id: number | null;
    public aoiId: number; // FK to area_of_interest.id
    public algoId: number; // FK to algorithm_catalogue.id
    public configArgs: Record<string, any> | null;

    constructor(data: Partial<AoiAlgorithmMappingData>) {
        this.id = data.id || null;
        this.aoiId = data.aoi_id!;
        this.algoId = data.algo_id!;
        this.configArgs = data.config_args || null;
    }


    /**
     * Deletes all mappings associated with a project's AOIs.
     * This relies on cascade deletion from area_of_interest (if set in DB schema).
     * If cascade is NOT set, this explicit deletion is required.
     */
    public static async deleteByProjectId(client: any, projectId: number): Promise<number> {
        const query = `
            DELETE FROM aoi_algorithm_mapping 
            WHERE aoi_id IN (SELECT id FROM area_of_interest WHERE project_id = $1);
        `;
        const result = await client.query(query, [projectId]);
        return result.rowCount;
    }

    /**
     * Saves a single AOI-Algorithm mapping.
     */
    public async save(): Promise<number> {
        const query = `
            INSERT INTO aoi_algorithm_mapping 
            (aoi_id, algo_id, config_args)
            VALUES ($1, $2, $3)
            ON CONFLICT (aoi_id, algo_id) 
            DO UPDATE SET config_args = EXCLUDED.config_args 
            RETURNING id;
        `;
        const values = [
            this.aoiId,
            this.algoId,
            this.configArgs
        ];
        
        const result = await db.query(query, values);
        this.id = result.rows[0].id;
        return this.id!;
    }

    // Add static methods for fetching mappings by aoiId or algoId...
}