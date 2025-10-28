import { DBClient } from '../db/DBClient.ts';

const db = DBClient.getInstance();

export interface AlgorithmCatalogueData {
    id: number;
    algo_id: string;
    args: Record<string, any> | null;
    description: string | null;
    category: string | null;
}

/**
 * AlgorithmCatalogueModel: Provides read-only access to the available algorithms.
 */
export class AlgorithmCatalogueModel {
    public id: number | null;
    public algoId: string;
    public defaultArgs: Record<string, any> | null;
    public description: string | null;
    public category: string | null;

    constructor(data: Partial<AlgorithmCatalogueData>) {
        this.id = data.id || null;
        this.algoId = data.algo_id || '';
        this.defaultArgs = data.args ?? null; 
        this.description = data.description ?? null;
        this.category = data.category ?? null;
    }

    /**
     * Fetches all algorithms from the catalogue.
     */
    public static async findAll(): Promise<AlgorithmCatalogueModel[]> {
        const query = `SELECT * FROM algorithm_catalogue ORDER BY category, algo_id;`;
        // Check 1: Ensure DB is connected and this query runs without error in your PG console.
        const result = await db.query<AlgorithmCatalogueData>(query);

        return result.rows.map(row => new AlgorithmCatalogueModel(row));
    }

    /**
     * Fetches a single algorithm by its unique string ID.
     */
    public static async findByAlgoId(algoId: string): Promise<AlgorithmCatalogueModel | null> {
        const query = `SELECT * FROM algorithm_catalogue WHERE algo_id = $1;`;
        const result = await db.query<AlgorithmCatalogueData>(query, [algoId]);

        if (result.rows.length === 0) return null;
        return new AlgorithmCatalogueModel(result.rows[0]);
    }
}