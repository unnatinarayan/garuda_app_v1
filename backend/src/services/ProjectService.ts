// ProjectService.ts


import { DBClient } from '../db/DBClient.ts';

import { ProjectModel } from '../models/ProjectModel.ts';
import type { ProjectData } from '../models/ProjectModel.ts';

import { AreaOfInterestModel } from '../models/AreaOfInterestModel.ts';
import type { AreaOfInterestData } from '../models/AreaOfInterestModel.ts';

import type { GeoJsonPolygon } from '../types/GeoJson.ts';

import { AoiAlgorithmMappingModel } from '../models/AoiAlgorithmMappingModel.ts';
import { UsersToProjectModel } from '../models/UsersToProjectModel.ts';
import type { UsersToProjectData } from '../models/UsersToProjectModel.ts';
import { AlgorithmCatalogueModel } from '../models/AlgorithmCatalogueModel.ts';
import type { AlgorithmCatalogueData } from '../models/AlgorithmCatalogueModel.ts';

const db = DBClient.getInstance();

// Define a structure for the complete data bundle coming from the frontend's 4-step process
export interface ProjectCreationBundle {
    projectBasicInfo: {
        projectName: string;
        description: string | null;
        auxData: Record<string, any> | null;
    };
    aoiData: {
        aoiId: string;
        name: string;
        geomGeoJson: GeoJsonPolygon;
        geomProperties: Record<string, any> | null;
        mappedAlgorithms: { algoId: string; configArgs: Record<string, any> }[]; // Note: algoId is now the STRING algo_id
    }[];
    userData: { userId: string; role: string }[];
}

/**
 * ProjectService: Manages complex business logic and database transactions 
 * across multiple models for Project management.
 */
export class ProjectService {

    /**
     */

    public async createProject(
        bundle: ProjectCreationBundle,
        currentUserId: string
    ): Promise<ProjectModel> {
        // Start a database client connection to manage the transaction
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');


            const { projectName, description, auxData } = bundle.projectBasicInfo;

            // 1. Create the Project record
            const projectResult = await client.query(`
                INSERT INTO project
                (name, description, created_by_userid, auxdata) -- <-- Updated column name
                VALUES ($1, $2, $3, $4)
                RETURNING id, creation_timestamp; -- <-- Updated column name
            `, [
                projectName,           // $1: name (User Input)
                description,           // $2: description (User Input)
                currentUserId,         // $3: created_by_userid (Server Determined)
                auxData                // $4: auxdata (User Input JSONB)
            ]);

            const projectId = projectResult.rows[0].id;

            // Correctly instantiate the model with all the new data
            const newProject = new ProjectModel({
                id: projectId,
                name: projectName, // <-- Use 'name' for model constructor
                description: description,
                created_by_userid: currentUserId,
                auxdata: auxData,
                creation_timestamp: projectResult.rows[0].creation_timestamp // <-- Use DB-generated date column name
            });


            // --- Step 2 & 3: Define AOI and Configure AOI Watch ---
            for (const aoiItem of bundle.aoiData) {

                // --- GEOMETRY PROCESSING LOGIC ---
                const geomString = JSON.stringify(aoiItem.geomGeoJson);
                const buffer = Number(aoiItem.geomProperties?.buffer) || 0;

                // Check for valid GeoJSON before proceeding
                if (!geomString || geomString.length < 10) {
                    throw new Error("Invalid GeoJSON geometry provided for AOI: " + aoiItem.name);
                }

                const aoiQuery = `
    WITH original_geom AS (
        SELECT ST_GeomFromGeoJSON($4) AS geom -- $4 is GeoJSON string
    )
    INSERT INTO area_of_interest
    (project_id, aoi_id, name, geom, geom_properties) -- <-- Removed 'publish_flag' and 'auxdata' used differently
    SELECT
        $1, $2, $3,
        CASE
            -- Check if the geometry type is Point (ST_Point) or Line (ST_LineString)
            -- If it is, we MUST buffer it to comply with the table's Polygon constraint.
            WHEN ST_GeometryType(geom) IN ('ST_Point', 'ST_LineString') THEN
                -- Use a minimum buffer of 0.0001 meters if buffer is 0, to force a Polygon output.
                ST_Transform(
                    ST_Buffer(
                        ST_Transform(geom, 3857),
                        CASE WHEN $5 > 0 THEN $5 ELSE 0.0001 END
                    ),
                    4326
                )
            -- If it's already a Polygon, use the geometry as-is.
            ELSE
                geom
        END,
        $6
    FROM original_geom
    RETURNING id; -- We still return the PK ID for internal tracking, but the lookup is by aoi_id
`;

                const aoiResult = await client.query(aoiQuery, [
                    projectId,             // $1
                    aoiItem.aoiId,         // $2 (The Unique String ID)
                    aoiItem.name,          // $3
                    geomString,            // $4 (GeoJSON String)
                    buffer,                // $5 (Buffer Distance - used in CASE)
                    aoiItem.geomProperties, // $6 (JSONB)
                ]);


                // const aoiPkId = aoiResult.rows[0].id; // Not strictly needed, we use project_id + aoi_id

                // 2. Insert AOI-Algorithm Mappings (Uses aoi_id and algo_id string)
                for (const algo of aoiItem.mappedAlgorithms) {
                    const mappingQuery = `
                        INSERT INTO aoi_algorithm_mapping (project_id, aoi_id, change_algo_id, change_algo_configured_args)
                        VALUES ($1, $2, $3, $4);
                    `;
                    await client.query(mappingQuery, [
                        projectId,            // $1
                        aoiItem.aoiId,        // $2 (The Unique String ID)
                        algo.algoId,          // $3 (The Algorithm STRING ID)
                        algo.configArgs       // $4
                    ]);
                }


            }

            // --- Step 4: Add Users (Unchanged, uses PKs and user_id string) ---
            // Ensure the creator is the owner (if not already included)
            const creatorIncluded = bundle.userData.some(u => u.userId === currentUserId);
            if (!creatorIncluded) {
                // The frontend sets a placeholder 'current_user_id', replace it with the real one
                const creatorPlaceholderIndex = bundle.userData.findIndex(u => u.userId === 'current_user_id');
                if (creatorPlaceholderIndex !== -1) {
                    // Replace the placeholder user entry with the actual user ID from the header
                    bundle.userData[creatorPlaceholderIndex].userId = currentUserId;
                } else {
                    // If no placeholder, explicitly add the owner
                    bundle.userData.push({ userId: currentUserId, role: 'owner' });
                }
            }


            for (const user of bundle.userData) {
                const userQuery = `
                    INSERT INTO users_to_project (user_id, project_id, role)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (user_id, project_id) DO UPDATE SET role = EXCLUDED.role;
                `;
                await client.query(userQuery, [user.userId, projectId, user.role]);
            }

            // Finalize the transaction
            await client.query('COMMIT');
            return newProject;

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Project creation failed, transaction rolled back:', error);
            // Re-throw with more specific error for debugging
            throw new Error(`Transaction failed. Details: ${(error as any).detail || (error as Error).message}`);
        } finally {
            client.release();
        }
    }

    /**
     * Executes a complete transaction to update an existing project, 
     * including project info, AOIs, Algo Mappings, and User Assignments.
     */
    public async updateProject(
        projectId: number,
        bundle: ProjectCreationBundle,
        currentUserId: string
    ): Promise<ProjectModel> {
        // 1. Start a database client connection to manage the transaction
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');

            // --------------------- Step 1: Update Project Basic Info ---------------------
            const projectModel = await ProjectModel.findById(projectId);
            if (!projectModel) {
                throw new Error(`Project with ID ${projectId} not found.`);
            }

            // Update model properties
            projectModel.projectName = bundle.projectBasicInfo.projectName;
            projectModel.description = bundle.projectBasicInfo.description;
            projectModel.auxData = bundle.projectBasicInfo.auxData;
            projectModel.createdByUserId = currentUserId; // Owner info usually doesn't change on update

            // Execute the UPDATE query for the project table
            await projectModel.update(client);

            // --------------------- Step 2 & 3: AOI and Algo Mapping Update ---------------------
            // AOI/Mapping Update Strategy: Delete all existing AOIs/Mappings and re-insert the new list
            // NOTE: Due to CASCADE DELETE from project table on aoi_algorithm_mapping, deleting AOI is enough.

            // A. Clean up old AOIs (which also cascades to aoi_algorithm_mapping)
            const deletedAoiCount = await AreaOfInterestModel.deleteByProjectId(client, projectId);
            console.log(`[Update] Deleted ${deletedAoiCount} old AOIs for Project ${projectId}.`);

            // B. Insert the new list of AOIs and their Mappings (reusing the create logic)
            for (const aoiItem of bundle.aoiData) {
                // --- GEOMETRY PROCESSING LOGIC (SAME AS CREATE) ---
                const geomString = JSON.stringify(aoiItem.geomGeoJson);
                const buffer = Number(aoiItem.geomProperties?.buffer) || 0;


                const aoiQuery = `
    WITH original_geom AS (
        SELECT ST_GeomFromGeoJSON($4) AS geom -- $4 is GeoJSON string
    )
    INSERT INTO area_of_interest
    (project_id, aoi_id, name, geom, geom_properties)
    SELECT
        $1, $2, $3,
        CASE
            -- Check if the geometry type is Point (ST_Point) or Line (ST_LineString)
            -- If it is, we MUST buffer it to comply with the table's Polygon constraint.
            WHEN ST_GeometryType(geom) IN ('ST_Point', 'ST_LineString') THEN
                -- Use a minimum buffer of 0.0001 meters if buffer is 0, to force a Polygon output.
                ST_Transform(
                    ST_Buffer(
                        ST_Transform(geom, 3857),
                        CASE WHEN $5 > 0 THEN $5 ELSE 0.0001 END
                    ),
                    4326
                )
            -- If it's already a Polygon, use the geometry as-is.
            ELSE
                geom
        END,
        $6
    FROM original_geom
    RETURNING id;
`;

                const aoiResult = await client.query(aoiQuery, [
                    projectId,             // $1
                    aoiItem.aoiId,         // $2
                    aoiItem.name,          // $3
                    geomString,            // $4 (GeoJSON String)
                    buffer,                // $5 (Buffer Distance - used in CASE)
                    aoiItem.geomProperties, // $6 (JSONB)
                ]);
                // const aoiPkId = aoiResult.rows[0].id; // Not strictly needed

                // Insert new AOI-Algorithm Mappings
                for (const algo of aoiItem.mappedAlgorithms) {
                    const mappingQuery = `
                        INSERT INTO aoi_algorithm_mapping (project_id, aoi_id, change_algo_id, change_algo_configured_args)
                        VALUES ($1, $2, $3, $4);
                    `;
                    await client.query(mappingQuery, [
                        projectId,            // $1
                        aoiItem.aoiId,        // $2
                        algo.algoId,          // $3 (The Algorithm STRING ID)
                        algo.configArgs       // $4
                    ]);
                }
            }


            // --------------------- Step 4: Update Users (No change) ---------------------
            const usersToKeep = bundle.userData.map(u => u.userId);

            // A. Delete users that were REMOVED in the frontend UI
            await UsersToProjectModel.deleteExcludedUsers(client, projectId, usersToKeep);

            // B. Upsert (Insert or Update Role) for the remaining/new users
            for (const user of bundle.userData) {
                const userQuery = `
                    INSERT INTO users_to_project (user_id, project_id, role)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (user_id, project_id) DO UPDATE SET role = EXCLUDED.role;
                `;
                await client.query(userQuery, [user.userId, projectId, user.role]);
            }

            // Finalize the transaction
            await client.query('COMMIT');
            return projectModel;

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Project update failed, transaction rolled back:', error);
            throw new Error(`Transaction failed. Details: ${(error as any).detail || (error as Error).message}`);
        } finally {
            client.release();
        }
    }


    /**
     * Fetches all projects associated with a given user ID, 
     * using the users_to_project table.
     */
    public async getUserProjects(userId: string): Promise<ProjectData[]> {
        const query = `
            SELECT
                p.id, p.name as project_name, p.description, p.creation_timestamp, p.last_modified_timestamp, p.created_by_userid, p.auxdata, -- <-- Updated column names
                up.role
            FROM project p
            JOIN users_to_project up ON p.id = up.project_id
            WHERE up.user_id = $1
            ORDER BY p.last_modified_timestamp DESC; -- <-- Updated column name
        `;
        // Note: ProjectData interface is now updated in ProjectModel.ts
        const result = await db.query<ProjectData & { project_name: string, role: string }>(query, [userId]);

        // Return projects with the user's role included (for display purposes)
        return result.rows.map(row => ({
            ...row,
            role: row.role
        }));
    }

    /**
     * Fetches a single project and all its associated data (AOIs, Mappings, Users).
     */
    public async getProjectDetails(projectId: number): Promise<any> {
        const client = await db.pool.connect();
        try {
            // 1. Fetch Project Details
            const projectResult = await client.query(`
                SELECT id, name as project_name, description, creation_timestamp, last_modified_timestamp, created_by_userid, auxdata FROM project WHERE id = $1; -- <-- Updated column names
            `, [projectId]);
            if (projectResult.rows.length === 0) return null;
            const project = projectResult.rows[0];

            // 2. Fetch Users (Unchanged)
            const userResult = await client.query(`
                SELECT user_id, role FROM users_to_project WHERE project_id = $1;
            `, [projectId]);

            // 3. Fetch AOIs and 4. Fetch Mapped Algorithms for each AOI
            // Re-use the logic from AreaOfInterestModel.findByProjectId and getMappedAlgorithms
            const aois = await AreaOfInterestModel.findByProjectId(projectId);

            const aoisWithAlgos = [];
            for (const aoiInstance of aois) {
                // The getMappedAlgorithms logic in AreaOfInterestModel.ts is updated
                const algorithms = await aoiInstance.getMappedAlgorithms(client);

                aoisWithAlgos.push({
                    // Flatten AOI properties
                    id: aoiInstance.id,
                    project_id: aoiInstance.projectId,
                    aoi_id: aoiInstance.aoiId,
                    name: aoiInstance.name,
                    auxdata: aoiInstance.auxData,
                    geom_properties: aoiInstance.geomProperties,
                    geomGeoJson: aoiInstance.geomGeoJson,
                    // Add algorithms
                    mappedAlgorithms: algorithms,
                });
            }

            return {
                ...project,
                users: userResult.rows,
                aois: aoisWithAlgos,
            };
        } catch (error) {
            console.error('Error fetching project details:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Deletes a project and all related records (cascade deletes handle most).
     */
    public async deleteProject(projectId: number): Promise<boolean> {
        // Due to CASCADE DELETE constraints, deleting from the parent (project) table
        // will automatically clean up records in: area_of_interest, users_to_project, aoi_algorithm_mapping, alerts.

        const query = `DELETE FROM project WHERE id = $1;`;
        const result = await db.query(query, [projectId]);

        return result.rowCount > 0;
    }


    /**
     * Fetches the entire algorithm catalogue.
     */


    public async getAlgorithmCatalogue(): Promise<AlgorithmCatalogueData[]> {
        const algorithmModels = await AlgorithmCatalogueModel.findAll();


        return algorithmModels.map(algo => ({
            id: algo.id!,
            algo_id: algo.algoId,
            args: algo.defaultArgs,
            description: algo.description,
            category: algo.category,
        }));
    }


    // Add methods for updateProject, deleteProject, etc. here...
}