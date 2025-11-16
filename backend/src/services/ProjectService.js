// ProjectService.js

import { DBClient } from '../db/DBClient.js';
import { ProjectModel } from '../models/ProjectModel.js';
import { AreaOfInterestModel } from '../models/AreaOfInterestModel.js';
import { AlgorithmCatalogueModel } from '../models/AlgorithmCatalogueModel.js';

const db = DBClient.getInstance();

/**
 * ProjectService: Manages complex business logic and database transactions
 * across multiple models for Project management.
 */
export class ProjectService {

    /**
     * @param {Object} bundle 
     * @param {string} currentUserId
     * @returns {Promise<ProjectModel>}
     */
    // ProjectService.js - Updated createProject method to handle GeometryCollection

    async createProject(bundle, currentUserId) {
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');

            const { projectName, description, auxData } = bundle.projectBasicInfo;

            // 1. Create the Project record
            const projectResult = await client.query(`
            INSERT INTO project
            (name, description, created_by_userid, auxdata)
            VALUES ($1, $2, $3, $4)
            RETURNING id, creation_timestamp;
        `, [projectName, description, currentUserId, auxData]);

            const projectId = projectResult.rows[0].id;

            const newProject = new ProjectModel({
                id: projectId,
                name: projectName,
                description: description,
                created_by_userid: currentUserId,
                auxdata: auxData,
                creation_timestamp: projectResult.rows[0].creation_timestamp
            });

            // 2. Process AOIs with multi-polygon support
            for (const aoiItem of bundle.aoiData) {
                const geomString = JSON.stringify(aoiItem.geomGeoJson);

                if (!geomString || geomString.length < 10) {
                    throw new Error("Invalid GeoJSON geometry provided for AOI: " + aoiItem.name);
                }

                // --- MULTI-POLYGON PROCESSING LOGIC ---
                let finalGeometry;

                if (aoiItem.geomGeoJson.type === 'GeometryCollection') {
                    // Handle multiple geometries with individual buffers
                    const bufferConfig = aoiItem.geomProperties?.bufferConfig || [];

                    // Process each geometry and collect results
                    const geometryParts = [];
                    for (let idx = 0; idx < aoiItem.geomGeoJson.geometries.length; idx++) {
                        const geom = aoiItem.geomGeoJson.geometries[idx];
                        const config = bufferConfig[idx] || {};
                        const buffer = Number(config.buffer) || 0;
                        const geomType = geom.type;
                        const individualGeomStr = JSON.stringify(geom);

                        // Process geometry with buffer in separate query
                        if (geomType === 'Point' || geomType === 'LineString') {
                            const bufferedResult = await client.query(`
                            SELECT ST_AsText(
                                ST_Transform(
                                    ST_Buffer(
                                        ST_Transform(ST_GeomFromGeoJSON($1::text), 3857),
                                        $2::float
                                    ),
                                    4326
                                )
                            ) as geom_wkt
                        `, [individualGeomStr, buffer > 0 ? buffer : 0.0001]);

                            geometryParts.push(bufferedResult.rows[0].geom_wkt);
                        } else {
                            const result = await client.query(`
                            SELECT ST_AsText(ST_GeomFromGeoJSON($1::text)) as geom_wkt
                        `, [individualGeomStr]);

                            geometryParts.push(result.rows[0].geom_wkt);
                        }
                    }

                    // Union all parts into single geometry
                    const unionQuery = `
                    SELECT ST_AsText(
                        ST_Union(ARRAY[${geometryParts.map((_, i) => `ST_GeomFromText($${i + 1}, 4326)`).join(', ')}])
                    ) as final_geom_wkt
                `;

                    const unionResult = await client.query(unionQuery, geometryParts);
                    const finalWKT = unionResult.rows[0].final_geom_wkt;

                    // Insert AOI with the unioned geometry
                    const aoiQuery = `
                    INSERT INTO area_of_interest
                    (project_id, aoi_id, name, geom, geom_properties, status)
                    VALUES ($1, $2, $3, ST_GeomFromText($4, 4326), $5, 1)
                    RETURNING id;
                `;

                    await client.query(aoiQuery, [
                        projectId,
                        aoiItem.aoiId,
                        aoiItem.name,
                        finalWKT,
                        aoiItem.geomProperties
                    ]);

                } else {
                    // Single geometry (existing logic with proper types)
                    const buffer = Number(aoiItem.geomProperties?.buffer) || 0;

                    const aoiQuery = `
                    WITH original_geom AS (
                        SELECT ST_GeomFromGeoJSON($4::text) AS geom
                    )
                    INSERT INTO area_of_interest
                    (project_id, aoi_id, name, geom, geom_properties, status)
                    SELECT
                        $1, $2, $3,
                        CASE
                            WHEN ST_GeometryType(geom) IN ('ST_Point', 'ST_LineString') THEN
                                ST_Transform(
                                    ST_Buffer(
                                        ST_Transform(geom, 3857),
                                        CASE WHEN $5::float > 0 THEN $5::float ELSE 0.0001 END
                                    ),
                                    4326
                                )
                            ELSE
                                geom
                        END,
                        $6, 1
                    FROM original_geom
                    RETURNING id;
                `;

                    await client.query(aoiQuery, [
                        projectId,
                        aoiItem.aoiId,
                        aoiItem.name,
                        geomString,
                        buffer,
                        aoiItem.geomProperties
                    ]);
                }


                // 3. Insert AOI-Algorithm Mappings
                for (const algo of aoiItem.mappedAlgorithms) {
                    const mappingQuery = `
                    INSERT INTO aoi_algorithm_mapping 
                    (project_id, aoi_id, change_algo_id, change_algo_configured_args, status)
                    VALUES ($1, $2, $3, $4, $5);
                `;
                    await client.query(mappingQuery, [
                        projectId,
                        aoiItem.aoiId,
                        algo.algoId,
                        algo.configArgs,
                        1
                    ]);
                }
            }

            // 4. Add Users
            const creatorIncluded = bundle.userData.some(u => u.userId === currentUserId);
            if (!creatorIncluded) {
                const creatorPlaceholderIndex = bundle.userData.findIndex(
                    u => u.userId === 'current_user_id'
                );
                if (creatorPlaceholderIndex !== -1) {
                    bundle.userData[creatorPlaceholderIndex].userId = currentUserId;
                } else {
                    bundle.userData.push({ userId: currentUserId, role: 'owner' });
                }
            }

            for (const user of bundle.userData) {
                const userQuery = `
                INSERT INTO users_to_project (user_id, project_id, user_role)
                VALUES ($1, $2, $3)
                ON CONFLICT (user_id, project_id) DO UPDATE SET user_role = EXCLUDED.user_role;
            `;
                await client.query(userQuery, [user.userId, projectId, user.role]);
            }

            await client.query('COMMIT');
            return newProject;

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Project creation failed, transaction rolled back:', error);
            throw new Error(`Transaction failed. Details: ${error.detail || error.message}`);
        } finally {
            client.release();
        }
    }


    // ===== SIMILAR UPDATE FOR updateProject METHOD =====
    /**
        * Executes a complete transaction to update an existing project,
        * including project info, AOIs, Algo Mappings, and User Assignments.
        * @param {number} projectId
        * @param {Object} bundle
        * @param {string} currentUserId
        * @returns {Promise<ProjectModel>}
        */

    // ProjectService.js - Fixed updateProject method

async updateProject(projectId, bundle, currentUserId) {
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Update Project Basic Info
        const projectModel = await ProjectModel.findById(projectId);
        if (!projectModel) {
            throw new Error(`Project with ID ${projectId} not found.`);
        }

        projectModel.projectName = bundle.projectBasicInfo.projectName;
        projectModel.description = bundle.projectBasicInfo.description;
        projectModel.auxData = bundle.projectBasicInfo.auxData;
        projectModel.createdByUserId = currentUserId;

        await projectModel.update(client);
        console.log(`[Update] Updated project ${projectId} basic info.`);

        // 2. Delete old alerts and mappings (CASCADE)
        await client.query(
            `DELETE FROM alerts WHERE mapping_id IN 
             (SELECT id FROM aoi_algorithm_mapping WHERE project_id = $1);`,
            [projectId]
        );

        // CRITICAL FIX: Track processed AOI IDs to avoid duplicates
        const processedAoiIds = new Set();

        // 3. Process AOIs with multi-polygon support
        for (const aoiItem of bundle.aoiData) {
            const { aoiId, dbId, status, name, geomGeoJson, geomProperties, mappedAlgorithms } = aoiItem;

            console.log(`[Update] Processing AOI: ${aoiId}, dbId: ${dbId}, status: ${status}`);

            // CRITICAL FIX: Check for duplicate AOI IDs in this update batch
            if (processedAoiIds.has(aoiId)) {
                console.error(`[Update] Duplicate aoiId detected: ${aoiId}. Skipping.`);
                continue;
            }
            processedAoiIds.add(aoiId);

            // CASE 1: Existing AOI with dbId
            if (dbId) {
                if (status === 2) {
                    // Soft delete existing AOI
                    console.log(`[Update] Soft-deleting AOI ${aoiId} (DB ID: ${dbId})`);
                    await client.query(
                        `UPDATE area_of_interest SET status = 2 WHERE id = $1;`,
                        [dbId]
                    );
                    await client.query(
                        `UPDATE aoi_algorithm_mapping SET status = 2 
                         WHERE project_id = $1 AND aoi_id = $2;`,
                        [projectId, aoiId]
                    );
                    continue;
                } else {
                    // Update metadata only (geometry usually doesn't change in edit mode)
                    console.log(`[Update] Updating AOI ${aoiId} metadata.`);
                    await client.query(
                        `UPDATE area_of_interest 
                         SET name = $1, geom_properties = $2, status = $3 
                         WHERE id = $4;`,
                        [name, geomProperties, status, dbId]
                    );
                }
            }
            // CASE 2: New AOI (no dbId)
            else {
                console.log(`[Update] Creating new AOI ${aoiId}`);
                
                // CRITICAL FIX: Check if this aoiId already exists (even if soft-deleted)
                const existingCheck = await client.query(
                    `SELECT id, status FROM area_of_interest 
                     WHERE project_id = $1 AND aoi_id = $2;`,
                    [projectId, aoiId]
                );

                if (existingCheck.rows.length > 0) {
                    const existing = existingCheck.rows[0];
                    console.log(`[Update] AOI ${aoiId} already exists (status: ${existing.status})`);
                    
                    if (existing.status === 2) {
                        // Reuse the soft-deleted AOI by updating it
                        console.log(`[Update] Reusing soft-deleted AOI ${aoiId} (DB ID: ${existing.id})`);
                        
                        const geomString = JSON.stringify(geomGeoJson);
                        
                        // Process geometry based on type
                        if (geomGeoJson.type === 'GeometryCollection') {
                            const bufferConfig = geomProperties?.bufferConfig || [];
                            const geometryParts = [];
                            
                            for (let idx = 0; idx < geomGeoJson.geometries.length; idx++) {
                                const geom = geomGeoJson.geometries[idx];
                                const config = bufferConfig[idx] || {};
                                const buffer = Number(config.buffer) || 0;
                                const geomType = geom.type;
                                const individualGeomStr = JSON.stringify(geom);

                                if (geomType === 'Point' || geomType === 'LineString') {
                                    const bufferedResult = await client.query(`
                                        SELECT ST_AsText(
                                            ST_Transform(
                                                ST_Buffer(
                                                    ST_Transform(ST_GeomFromGeoJSON($1::text), 3857),
                                                    $2::float
                                                ),
                                                4326
                                            )
                                        ) as geom_wkt
                                    `, [individualGeomStr, buffer > 0 ? buffer : 0.0001]);
                                    geometryParts.push(bufferedResult.rows[0].geom_wkt);
                                } else {
                                    const result = await client.query(`
                                        SELECT ST_AsText(ST_GeomFromGeoJSON($1::text)) as geom_wkt
                                    `, [individualGeomStr]);
                                    geometryParts.push(result.rows[0].geom_wkt);
                                }
                            }

                            const unionQuery = `
                                SELECT ST_AsText(
                                    ST_Union(ARRAY[${geometryParts.map((_, i) => `ST_GeomFromText($${i + 1}, 4326)`).join(', ')}])
                                ) as final_geom_wkt
                            `;
                            const unionResult = await client.query(unionQuery, geometryParts);
                            const finalWKT = unionResult.rows[0].final_geom_wkt;

                            // Update the existing row
                            await client.query(`
                                UPDATE area_of_interest
                                SET name = $1, geom = ST_GeomFromText($2, 4326), 
                                    geom_properties = $3, status = 1
                                WHERE id = $4;
                            `, [name, finalWKT, geomProperties, existing.id]);
                            
                        } else {
                            // Single geometry
                            const buffer = Number(geomProperties?.buffer) || 0;
                            
                            await client.query(`
                                WITH original_geom AS (
                                    SELECT ST_GeomFromGeoJSON($1::text) AS geom
                                )
                                UPDATE area_of_interest
                                SET name = $2,
                                    geom = CASE
                                        WHEN ST_GeometryType((SELECT geom FROM original_geom)) IN ('ST_Point', 'ST_LineString') THEN
                                            ST_Transform(
                                                ST_Buffer(
                                                    ST_Transform((SELECT geom FROM original_geom), 3857),
                                                    CASE WHEN $3::float > 0 THEN $3::float ELSE 0.0001 END
                                                ),
                                                4326
                                            )
                                        ELSE (SELECT geom FROM original_geom)
                                    END,
                                    geom_properties = $4,
                                    status = 1
                                WHERE id = $5;
                            `, [geomString, name, buffer, geomProperties, existing.id]);
                        }
                        
                        console.log(`[Update] Successfully reused AOI ${aoiId}`);
                    } else {
                        // AOI exists and is active - this is a genuine duplicate
                        throw new Error(`AOI ID ${aoiId} already exists in project ${projectId} and is active`);
                    }
                } else {
                    // Brand new AOI - insert it
                    const geomString = JSON.stringify(geomGeoJson);

                    if (geomGeoJson.type === 'GeometryCollection') {
                        // Multi-polygon logic (same as create)
                        const bufferConfig = geomProperties?.bufferConfig || [];
                        const geometryParts = [];

                        for (let idx = 0; idx < geomGeoJson.geometries.length; idx++) {
                            const geom = geomGeoJson.geometries[idx];
                            const config = bufferConfig[idx] || {};
                            const buffer = Number(config.buffer) || 0;
                            const geomType = geom.type;
                            const individualGeomStr = JSON.stringify(geom);

                            if (geomType === 'Point' || geomType === 'LineString') {
                                const bufferedResult = await client.query(`
                                    SELECT ST_AsText(
                                        ST_Transform(
                                            ST_Buffer(
                                                ST_Transform(ST_GeomFromGeoJSON($1::text), 3857),
                                                $2::float
                                            ),
                                            4326
                                        )
                                    ) as geom_wkt
                                `, [individualGeomStr, buffer > 0 ? buffer : 0.0001]);
                                geometryParts.push(bufferedResult.rows[0].geom_wkt);
                            } else {
                                const result = await client.query(`
                                    SELECT ST_AsText(ST_GeomFromGeoJSON($1::text)) as geom_wkt
                                `, [individualGeomStr]);
                                geometryParts.push(result.rows[0].geom_wkt);
                            }
                        }

                        const unionQuery = `
                            SELECT ST_AsText(
                                ST_Union(ARRAY[${geometryParts.map((_, i) => `ST_GeomFromText($${i + 1}, 4326)`).join(', ')}])
                            ) as final_geom_wkt
                        `;
                        const unionResult = await client.query(unionQuery, geometryParts);
                        const finalWKT = unionResult.rows[0].final_geom_wkt;

                        await client.query(`
                            INSERT INTO area_of_interest
                            (project_id, aoi_id, name, geom, geom_properties, status)
                            VALUES ($1, $2, $3, ST_GeomFromText($4, 4326), $5, 1);
                        `, [projectId, aoiId, name, finalWKT, geomProperties]);
                    } else {
                        // Single geometry
                        const buffer = Number(geomProperties?.buffer) || 0;

                        await client.query(`
                            WITH original_geom AS (
                                SELECT ST_GeomFromGeoJSON($4::text) AS geom
                            )
                            INSERT INTO area_of_interest
                            (project_id, aoi_id, name, geom, geom_properties, status)
                            SELECT $1, $2, $3,
                                CASE
                                    WHEN ST_GeometryType(geom) IN ('ST_Point', 'ST_LineString') THEN
                                        ST_Transform(
                                            ST_Buffer(
                                                ST_Transform(geom, 3857),
                                                CASE WHEN $5::float > 0 THEN $5::float ELSE 0.0001 END
                                            ),
                                            4326
                                        )
                                    ELSE geom
                                END,
                                $6, 1
                            FROM original_geom;
                        `, [projectId, aoiId, name, geomString, buffer, geomProperties]);
                    }

                    console.log(`[Update] Inserted brand new AOI ${aoiId}.`);
                }
            }

            // 4. Process Algorithm Mappings (same as before)
            for (const algo of mappedAlgorithms) {
                const { algoId, configArgs, status: algoStatus, mappingId } = algo;

                if (mappingId) {
                    if (algoStatus === 2) {
                        await client.query(
                            `UPDATE aoi_algorithm_mapping SET status = 2 WHERE id = $1;`,
                            [mappingId]
                        );
                    } else {
                        await client.query(
                            `UPDATE aoi_algorithm_mapping 
                             SET status = $1, change_algo_configured_args = $2 
                             WHERE id = $3;`,
                            [algoStatus, configArgs, mappingId]
                        );
                    }
                } else if (algoStatus !== 2) {
                    await client.query(
                        `INSERT INTO aoi_algorithm_mapping 
                         (project_id, aoi_id, change_algo_id, change_algo_configured_args, status)
                         VALUES ($1, $2, $3, $4, $5);`,
                        [projectId, aoiId, algoId, configArgs, algoStatus]
                    );
                }
            }
        }

        // 5. Update Users (same as before)
        const usersToKeep = bundle.userData.map(u => u.userId);
        await client.query(`
            DELETE FROM users_to_project
            WHERE project_id = $1 AND user_id NOT IN (SELECT unnest($2::text[]));
        `, [projectId, usersToKeep]);

        for (const user of bundle.userData) {
            await client.query(`
                INSERT INTO users_to_project (user_id, project_id, user_role)
                VALUES ($1, $2, $3)
                ON CONFLICT (user_id, project_id) DO UPDATE SET user_role = EXCLUDED.user_role;
            `, [user.userId, projectId, user.role]);
        }

        await client.query('COMMIT');
        console.log(`[Update] Project ${projectId} update completed successfully.`);
        return projectModel;

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Project update failed, transaction rolled back:', error);
        throw new Error(`Update failed. Details: ${error.detail || error.message}`);
    } finally {
        client.release();
    }
}

    /**
     * Fetches all projects associated with a given user ID,
     * using the users_to_project table.
     * @param {string} userId
     * @returns {Promise<any[]>}
     */
    async getUserProjects(userId) {
        const query = `
            SELECT
                p.id, p.name as project_name, p.description, p.creation_timestamp, p.last_modified_timestamp, p.created_by_userid, p.auxdata,
                up.user_role as role
            FROM project p
            JOIN users_to_project up ON p.id = up.project_id
            WHERE up.user_id = $1
            ORDER BY p.last_modified_timestamp DESC;
        `;
        const result = await db.query(query, [userId]);

        // Return projects with the user's role included (for display purposes)
        return result.rows.map(row => ({
            ...row,
            role: row.role
        }));
    }

    /**
     * Fetches a single project and all its associated data (AOIs, Mappings, Users).
     * @param {number} projectId
     * @returns {Promise<any>}
     */

    // ProjectService.js - Add this logging to getProjectDetails method

async getProjectDetails(projectId) {
    const client = await db.pool.connect();
    try {
        // 1. Fetch Project Details
        const projectResult = await client.query(`
            SELECT id, name as project_name, description, creation_timestamp, 
                   last_modified_timestamp, created_by_userid, auxdata 
            FROM project WHERE id = $1;
        `, [projectId]);
        
        if (projectResult.rows.length === 0) return null;
        const project = projectResult.rows[0];

        // 2. Fetch Users
        const userResult = await client.query(`
            SELECT user_id, user_role FROM users_to_project WHERE project_id = $1;
        `, [projectId]);

        // 3. Fetch AOIs
        const aois = await AreaOfInterestModel.findByProjectId(projectId);
        console.log(`[ProjectService] Fetched ${aois.length} AOIs for project ${projectId}`);

        const aoisWithAlgos = [];
        for (const aoiInstance of aois) {
            // CRITICAL FIX: Log geometry for debugging
            console.log(`[ProjectService] Processing AOI: ${aoiInstance.name}`);
            console.log(`[ProjectService] Geometry type: ${aoiInstance.geomGeoJson?.type}`);
            
            if (!aoiInstance.geomGeoJson) {
                console.error(`[ProjectService] AOI ${aoiInstance.name} has null geometry!`);
                continue; // Skip this AOI
            }

            // Validate geometry structure
            if (aoiInstance.geomGeoJson.type === 'GeometryCollection') {
                if (!aoiInstance.geomGeoJson.geometries || 
                    aoiInstance.geomGeoJson.geometries.length === 0) {
                    console.error(`[ProjectService] AOI ${aoiInstance.name} has empty GeometryCollection`);
                    continue;
                }
            } else {
                if (!aoiInstance.geomGeoJson.coordinates || 
                    aoiInstance.geomGeoJson.coordinates.length === 0) {
                    console.error(`[ProjectService] AOI ${aoiInstance.name} has invalid coordinates`);
                    continue;
                }
            }

            const algorithms = await aoiInstance.getMappedAlgorithms(client);

            aoisWithAlgos.push({
                id: aoiInstance.id,
                project_id: aoiInstance.projectId,
                aoi_id: aoiInstance.aoiId,
                name: aoiInstance.name,
                auxdata: aoiInstance.auxData,
                geom_properties: aoiInstance.geomProperties,
                geomGeoJson: aoiInstance.geomGeoJson,
                status: aoiInstance.status || 1, // Include status
                mappedAlgorithms: algorithms,
            });
        }

        console.log(`[ProjectService] Returning ${aoisWithAlgos.length} valid AOIs`);

        return {
            ...project,
            users: userResult.rows,
            aois: aoisWithAlgos,
        };
    } catch (error) {
        console.error('[ProjectService] Error fetching project details:', error);
        throw error;
    } finally {
        client.release();
    }
}   



    async getProjectAlerts(projectId, aoiId = null) {
        let aoiFilter = '';
        const params = [projectId];

        if (aoiId) {
            params.push(aoiId);
            aoiFilter = ` AND aam.aoi_id = $${params.length}`;
        }

        const query = `
        SELECT
            a.id,
            a.message,
            a.alert_timestamp AS timestamp,
            p.name AS project_name,
            aoi.name AS aoi_name,
            aam.aoi_id,
            aam.project_id,
            aam.change_algo_id AS algo_id
        FROM alerts a
        JOIN aoi_algorithm_mapping aam ON a.mapping_id = aam.id
        JOIN project p ON aam.project_id = p.id
        JOIN area_of_interest aoi ON aam.project_id = aoi.project_id AND aam.aoi_id = aoi.aoi_id
        WHERE aam.project_id = $1
        ${aoiFilter}
        ORDER BY a.alert_timestamp ASC;
    `;

        const result = await db.query(query, params);

        // Derive first and last timestamps for frontend auto-scaling
        const timestamps = result.rows.map(r => new Date(r.timestamp).getTime());
        const firstTimestamp = timestamps.length ? Math.min(...timestamps) : null;
        const lastTimestamp = timestamps.length ? Math.max(...timestamps) : null;

        return {
            alerts: result.rows.map(row => ({
                id: row.id,
                projectId: row.project_id,
                projectName: row.project_name,
                aoiId: row.aoi_id,
                aoiName: row.aoi_name,
                algoId: row.algo_id,
                message: row.message,
                timestamp: row.timestamp
            })),
            timeRange: { from: firstTimestamp, to: lastTimestamp }
        };
    }


    /**
     * Deletes a project and all related records (cascade deletes handle most).
     * @param {number} projectId
     * @returns {Promise<boolean>}
     */
    async deleteProject(projectId) {
        // Due to CASCADE DELETE constraints, deleting from the parent (project) table
        // will automatically clean up records in: area_of_interest, users_to_project, aoi_algorithm_mapping, alerts.

        const query = `DELETE FROM project WHERE id = $1;`;
        const result = await db.query(query, [projectId]);

        return result.rowCount > 0;
    }


    /**
     * Fetches the entire algorithm catalogue.
     * @returns {Promise<any[]>}
     */
    async getAlgorithmCatalogue() {
        const algorithmModels = await AlgorithmCatalogueModel.findAll();

        return algorithmModels.map(algo => ({
            id: algo.id,
            algo_id: algo.algoId,
            args: algo.defaultArgs,
            description: algo.description,
            category: algo.category,
        }));
    }
}
