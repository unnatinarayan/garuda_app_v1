// AlgorithmCatalogueModel.js


import { DBClient } from '../db/DBClient.js';

const db = DBClient.getInstance();

/**
 * AlgorithmCatalogueModel: Provides read-only access to the available algorithms.
 */
export class AlgorithmCatalogueModel {
    id = null;
    algoId;
    defaultArgs = null;
    description = null;
    category = null;
    displayName = null; 
    isActive = null;

    /**
     * @param {Object} data 
     */
    constructor(data) {
        this.id = data.id || null;
        this.algoId = data.algo_id || '';
        this.defaultArgs = data.args ?? null;
        this.description = data.description ?? null;
        this.category = data.category ?? null;
        this.displayName = data.display_name ?? null; 
        this.isActive = data.isactive ?? data.is_active ?? true;
    }

    /**
     * Fetches all algorithms from the catalogue.
     * @returns {Promise<AlgorithmCatalogueModel[]>}
     */

    static async findAll() {
        // Must select display_name
        const query = `SELECT id, algo_id, args, description, category, auxdata, display_name, isactive FROM algorithm_catalogue ORDER BY category, algo_id;`;
        const result = await db.query(query);

        return result.rows.map(row => new AlgorithmCatalogueModel(row));
    }

    // static async findAll() {
    //     const query = `SELECT * FROM algorithm_catalogue ORDER BY category, algo_id;`;
    //     const result = await db.query(query);

    //     return result.rows.map(row => new AlgorithmCatalogueModel(row));
    // }

    /**
     * Fetches a single algorithm by its unique string ID.
     * @param {string} algoId
     * @returns {Promise<AlgorithmCatalogueModel | null>}
     */
    static async findByAlgoId(algoId) {
        const query = `SELECT * FROM algorithm_catalogue WHERE algo_id = $1;`;
        const result = await db.query(query, [algoId]);

        if (result.rows.length === 0) return null;
        return new AlgorithmCatalogueModel(result.rows[0]);
    }
}
