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
        mappedAlgorithms: { algoId: number; configArgs: Record<string, any> }[]; // Note: algoId is the PK 'id'
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

            // CRITICAL FIX: Ensure the destructured variables are used in the query
            const projectResult = await client.query(`
                INSERT INTO project 
                (project_name, description, created_by_userid, auxdata)
                VALUES ($1, $2, $3, $4)
                RETURNING id, creation_date; -- Return creation_date for the model
            `, [
                projectName,       // $1: project_name (User Input)
                description,       // $2: description (User Input)
                currentUserId,     // $3: created_by_userid (Server Determined)
                auxData            // $4: auxdata (User Input JSONB)
            ]);

            const projectId = projectResult.rows[0].id;

            // Correctly instantiate the model with all the new data
            const newProject = new ProjectModel({
                id: projectId,
                project_name: projectName,
                description: description,
                created_by_userid: currentUserId,
                auxdata: auxData,
                creation_date: projectResult.rows[0].creation_date // Use the DB-generated date
            });


            // --- Step 2 & 3: Define AOI and Configure AOI Watch ---
            // This part of your code is ALREADY correct and uses the client for transaction context
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
                
                // NOTE: Removed $7 (auxdata) from area_of_interest insert as it's not a required field
                const aoiResult = await client.query(aoiQuery, [
                    projectId,              // $1
                    aoiItem.aoiId,          // $2
                    aoiItem.name,           // $3
                    geomString,             // $4 (GeoJSON String)
                    buffer,                 // $5 (Buffer Distance - used in CASE)
                    aoiItem.geomProperties, // $6 (JSONB)
                ]);
                

                const aoiPkId = aoiResult.rows[0].id;


                for (const algo of aoiItem.mappedAlgorithms) {
                    const mappingQuery = `
                        INSERT INTO aoi_algorithm_mapping (aoi_id, algo_id, config_args)
                        VALUES ($1, $2, $3);
                    `;
                    await client.query(mappingQuery, [
                        aoiPkId,
                        algo.algoId,
                        algo.configArgs
                    ]);
                }

               
            }

            // --- Step 4: Add Users ---
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
            // NOTE: If using strict foreign keys with CASCADE DELETE, deleting AOIs cleans mappings.
            
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
                    projectId,                  // $1
                    aoiItem.aoiId,              // $2
                    aoiItem.name,               // $3
                    geomString,                 // $4 (GeoJSON String)
                    buffer,                     // $5 (Buffer Distance - used in CASE)
                    aoiItem.geomProperties,     // $6 (JSONB)
                ]);
                const aoiPkId = aoiResult.rows[0].id;
                
                // Insert new AOI-Algorithm Mappings
                for (const algo of aoiItem.mappedAlgorithms) {
                    const mappingQuery = `
                        INSERT INTO aoi_algorithm_mapping (aoi_id, algo_id, config_args)
                        VALUES ($1, $2, $3);
                    `;
                    await client.query(mappingQuery, [
                        aoiPkId,
                        algo.algoId,
                        algo.configArgs
                    ]);
                }
            }


            // --------------------- Step 4: Update Users ---------------------
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
                p.*,
                up.role 
            FROM project p
            JOIN users_to_project up ON p.id = up.project_id
            WHERE up.user_id = $1
            ORDER BY p.last_modified_date DESC;
        `;
        const result = await db.query<ProjectData & { role: string }>(query, [userId]);

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
                SELECT * FROM project WHERE id = $1;
            `, [projectId]);
            if (projectResult.rows.length === 0) return null;
            const project = projectResult.rows[0];

            // 2. Fetch Users
            const userResult = await client.query(`
                SELECT user_id, role FROM users_to_project WHERE project_id = $1;
            `, [projectId]);

            // 3. Fetch AOIs
            const aoisQuery = `
                SELECT 
                    id, project_id, aoi_id, name, auxdata, publish_flag, geom_properties,
                    ST_AsGeoJSON(geom) AS geom_geojson_string 
                FROM area_of_interest 
                WHERE project_id = $1;
            `;
            const aoiResult = await client.query(aoisQuery, [projectId]);

            const aois = [];
            for (const row of aoiResult.rows) {
                const aoiInstance = new AreaOfInterestModel({ ...row, project_id: projectId });
                aoiInstance.id = row.id; // Must set ID for the next call

                // 4. Fetch Mapped Algorithms for each AOI
                const algorithms = await aoiInstance.getMappedAlgorithms(client);

                aois.push({
                    ...row,
                    geomGeoJson: JSON.parse(row.geom_geojson_string),
                    mappedAlgorithms: algorithms,
                });
            }

            return {
                ...project,
                users: userResult.rows,
                aois: aois,
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
        // will automatically clean up records in: area_of_interest, users_to_project, alerts.
        // aoi_algorithm_mapping is cleaned by CASCADE from area_of_interest.

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