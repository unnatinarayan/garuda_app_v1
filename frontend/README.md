garuda_app_v1
backend
└── 📁src
    └── 📁controllers
        ├── AlertsController.ts
        ├── AuthController.ts
        ├── ProjectController.ts
    └── 📁db
        ├── DBClient.ts
    └── 📁models
        ├── AlertModel.ts
        ├── AlgorithmCatalogueModel.ts
        ├── AoiAlgorithmMappingModel.ts
        ├── AreaOfInterestModel.ts
        ├── ProjectModel.ts
        ├── UserModel.ts
        ├── UsersToProjectModel.ts
    └── 📁services
        ├── AlertsService.ts
        ├── ProjectService.ts
    └── 📁types
        ├── GeoJson.ts
    ├── App.ts
    └── server.ts
frontend
└── 📁src
    └── 📁api
        ├── ApiClient.ts
    └── 📁assets
        ├── garuda.png
    └── 📁classes
        ├── AreaOfInterestDraft.ts
        ├── ProjectFormData.ts
        ├── UserSession.ts
    └── 📁components
        └── 📁auth
            ├── LoginForm.vue
        └── 📁map
            ├── MapVisualization.vue
        └── 📁steps
            ├── Step1BasicInfo.vue
            ├── Step2DefineAOI.vue
            ├── Step3AlgoMapping.vue
            ├── Step4AddUsers.vue
    └── 📁router
        ├── index.ts
    └── 📁stores
        ├── ProjectStore.ts
    └── 📁types
        ├── ProjectTypes.ts
    └── 📁views
        ├── ConfigureProjectUI.vue
        ├── DisplayProjectUI.vue
        ├── HomeViewUI.vue
        ├── MonitorMapView.vue
    ├── App.vue
    ├── main.ts
    └── style.css


    // ApiClient.ts

import axios from 'axios';
import type { AxiosInstance } from 'axios';
import type { ProjectCreationBundle } from '../types/ProjectTypes';
/**
 * ApiClient: Manages all API calls, including setting headers for authentication.
 */
export class ApiClient {
    private client: AxiosInstance;
    private static instance: ApiClient;
    private userId: string | null = null;
    
    private constructor() {
        this.client = axios.create({
            baseURL: 'http://localhost:3000/api', // Backend base URL
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    public static getInstance(): ApiClient {
        if (!ApiClient.instance) {
            ApiClient.instance = new ApiClient();
        }
        return ApiClient.instance;
    }

    public setUserId(userId: string): void {
        this.userId = userId;
        this.client.defaults.headers['X-User-ID'] = userId;
    }

    public getUserId(): string | null {
        return this.userId;
    }
    
    // --- Auth Endpoints ---
    public async login(username: string, password: string): Promise<{ userId: string, username: string }> { 
        const response = await this.client.post('/auth/login', { username, password });
        const { userId, username: returnedUsername } = response.data; // Destructure username
        this.setUserId(userId);
        // CRITICAL: Return username to be stored in UserSession
        return { userId, username: returnedUsername }; 
    }

    public async signup(username: string, password: string): Promise<{ userId: string, username: string }> {
        const response = await this.client.post('/auth/signup', { username, password });
        const { userId, username: returnedUsername } = response.data;
        return { userId, username: returnedUsername };
    }

    // --- Project Endpoints ---
    

    public async createProject(bundle: ProjectCreationBundle): Promise<any> {
        return this.client.post('/projects', bundle);
    }

    // NEW: Fetch algorithm catalogue
    public async getAlgorithmCatalogue(): Promise<any[]> {
        const response = await this.client.get('/projects/algorithms');
        return response.data;
    }
    
    public async getProjects(): Promise<any[]> {
        const response = await this.client.get('/projects');
        return response.data;
    }
    
    public async getProjectDetails(projectId: number): Promise<any> {
        const response = await this.client.get(`/projects/${projectId}`);
        return response.data;
    }
    
    public async deleteProject(projectId: number): Promise<void> {
        await this.client.delete(`/projects/${projectId}`);
    }
    
    // Add updateProject, deleteProject methods here...
}


// frontend/src/classes/AreaOfInterestDraft.ts

export interface GeoJsonPolygon {
    type: 'Polygon';
    coordinates: number[][][];
}

interface MappedAlgorithm {
    algoId: number; // The primary key ID of the algorithm from the catalogue
    name: string;   // For display in the UI
    configArgs: Record<string, any>; // Specific arguments for this AOI/Algo
}

export class AreaOfInterestDraft {
    public clientAoiId: number; 
    public name: string;
    public aoiId: string; 
    public geometry: GeoJsonPolygon;
    public mappedAlgorithms: MappedAlgorithm[] = [];
    public bufferDistance: number | null; // NEW: Holds buffer distance in meters
    public geometryType: 'Polygon' | 'LineString' | 'Point'; // NEW: To know if buffer is needed
    public geomProperties: Record<string, any> = {};
    
    
    
    constructor(
        name: string, 
        geometry: GeoJsonPolygon, 
        clientAoiId: number, 
        geometryType: 'Polygon' | 'LineString' | 'Point' = 'Polygon', // Default added
        bufferDistance: number | null = null
    ) {
        this.clientAoiId = clientAoiId;
        this.name = name;
        this.aoiId = `aoi-${clientAoiId}`; 
        this.geometry = geometry;
        this.geometryType = geometryType;
        this.bufferDistance = bufferDistance;
    }

   

    public mapAlgorithm(algoId: number, name: string, configArgs: Record<string, any> = {}): void {
        const existing = this.mappedAlgorithms.find(a => a.algoId === algoId);
        if (existing) {
            existing.configArgs = configArgs;
        } else {
            this.mappedAlgorithms.push({ algoId, name, configArgs });
        }
    }
    

    public toBackendData(): any {
        // Prepare geomProperties for the backend (ProjectService)
        const geomProps = {
            ...this.geomProperties,
            // Include buffer distance and geometry type for backend PostGIS processing
            originalType: this.geometryType,
            buffer: this.bufferDistance, 
        };

        return {
            aoiId: this.aoiId,
            name: this.name,
            geomGeoJson: this.geometry,
            geomProperties: geomProps,
            mappedAlgorithms: this.mappedAlgorithms.map(a => ({
                algoId: a.algoId,
                configArgs: a.configArgs
            }))
        };
    }
}

// frontend/src/classes/ProjectFormData.ts

import { AreaOfInterestDraft } from './AreaOfInterestDraft';

interface UserRoleAssignment {
    userId: string;
    role: 'owner' | 'analyst' | 'viewer' | string;
    username: string;
}

export interface AuxDataDraft {
    key: string;
    value: string;
}
/**
 * ProjectFormData: Manages the volatile state of the 4-step project configuration process.
 */
export class ProjectFormData {
    public projectName: string = '';
    public description: string = '';
    public auxDataDrafts: AuxDataDraft[] = [];

    public aoiDrafts: AreaOfInterestDraft[] = [];
    public users: UserRoleAssignment[] = [];
    
    public isUpdateMode: boolean = false;
    public currentStep: number = 1;
    public projectIdToUpdate: number | null = null;
    
    constructor(isUpdate: boolean = false, projectId: number | null = null) {
        this.isUpdateMode = isUpdate;
        this.projectIdToUpdate = projectId;
        // Initialize with creator as owner (will be updated/overridden later)
        this.users = [{ userId: 'current_user_id', role: 'owner', username: 'Creator' }]; 
    }

    public nextStep(): void {
        if (this.currentStep < 4) {
            this.currentStep++;
        }
    }
    public prevStep(): void {
        if (this.currentStep > 1) {
            this.currentStep--;
        }
    }

    public addAOIDraft(aoi: AreaOfInterestDraft): void {
        this.aoiDrafts.push(aoi);
    }

    private getFinalAuxData(): Record<string, any> {
        const finalAuxData: Record<string, any> = {};
        this.auxDataDrafts.forEach(item => {
            if (item.key && item.value) {
                // Try to parse non-string values (numbers, booleans, objects)
                try {
                    finalAuxData[item.key] = JSON.parse(item.value);
                } catch {
                    finalAuxData[item.key] = item.value;
                }
            }
        });
        return finalAuxData;
    }

    public toBackendBundle(): any {
        // CRITICAL FIX: Ensure projectName and description are included here
        const finalAuxData = this.getFinalAuxData();
        return {
            projectBasicInfo: {
                projectName: this.projectName,
                description: this.description,
                auxData: Object.keys(finalAuxData).length > 0 ? finalAuxData : null,
            },
            aoiData: this.aoiDrafts.map(draft => draft.toBackendData()),
            userData: this.users.map(u => ({ userId: u.userId, role: u.role })),
        };
    }
    
    public reset(): void {
        this.projectName = '';
        this.description = '';
        this.auxDataDrafts = [];
        this.aoiDrafts = [];
        this.users = [{ userId: 'current_user_id', role: 'owner', username: 'Creator' }];
        this.isUpdateMode = false;
        this.currentStep = 1;
        this.projectIdToUpdate = null;
    }
}



// frontend/src/classes/UserSession.ts

import { ApiClient } from '../api/ApiClient';

/**
 * UserSession: Manages the logged-in state and user details.
 */
export class UserSession {
    public userId: string | null = null;
    public username: string | null = null;
    public isLoggedIn: boolean = false;
    
    private static instance: UserSession;

    private static readonly STORAGE_KEY = 'garuda_user_session';

    private constructor() {
        this.loadSession();
    }

    public static getInstance(): UserSession {
        if (!UserSession.instance) {
            UserSession.instance = new UserSession();
        }
        return UserSession.instance;
    }


    private saveSession(): void {
        const data = {
            userId: this.userId,
            username: this.username,
            isLoggedIn: this.isLoggedIn,
        };
        localStorage.setItem(UserSession.STORAGE_KEY, JSON.stringify(data));
    }


    private loadSession(): void {
        const storedData = localStorage.getItem(UserSession.STORAGE_KEY);
        if (storedData) {
            try {
                const data = JSON.parse(storedData);
                this.userId = data.userId;
                this.username = data.username;
                this.isLoggedIn = data.isLoggedIn;
                
                // Re-set the Axios header if session is loaded
                if (this.isLoggedIn && this.userId) {
                    ApiClient.getInstance().setUserId(this.userId);
                }
            } catch (e) {
                console.error("Failed to parse session data from storage:", e);
                this.logout();
            }
        }
    }

    
    public async attemptLogin(username: string, password: string): Promise<boolean> {
        try {
            const api = ApiClient.getInstance();
            // CRITICAL: Get username from API response
            const { userId, username: returnedUsername } = await api.login(username, password);
            
            this.userId = userId;
            this.username = returnedUsername; // Store the actual username
            this.isLoggedIn = true;
            this.saveSession(); // 💾 Save session after successful login

            return true;
        } catch (error) {
            this.logout();
            return false;
        }
    }

    public async attemptSignup(username: string, password: string): Promise<boolean> {
        try {
            const api = ApiClient.getInstance();
            await api.signup(username, password);
            return true;
        } catch (error) {
            console.error('Signup failed:', error);
            return false;
        }
    }

    public logout(): void {
        this.userId = null;
        this.username = null;
        this.isLoggedIn = false;
        ApiClient.getInstance().setUserId('');

        localStorage.removeItem(UserSession.STORAGE_KEY);
    }
}


<!-- auth/LoginForm.vue: -->


<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { UserSession } from '@/classes/UserSession'; 

const router = useRouter();
const session = UserSession.getInstance();

const username = ref('testuser');
const password = ref('pass');
const errorMessage = ref('');
const isSigningUp = ref(false); // New state for toggling between login/signup

const submitAuth = async () => {
    errorMessage.value = '';

    if (isSigningUp.value) {
        // --- SIGNUP LOGIC ---
        const success = await session.attemptSignup(username.value, password.value);
        if (success) {
            errorMessage.value = 'Signup successful! Please log in with your new account.';
            isSigningUp.value = false; // Switch to login view
        } else {
            errorMessage.value = 'Signup failed. User may already exist or invalid input.';
        }

    } else {
        // --- LOGIN LOGIC ---
        const success = await session.attemptLogin(username.value, password.value);

        if (success) {
            router.push('/');
        } else {
            errorMessage.value = 'Login failed. Check username and password.';
        }
    }
};
</script>

<template>
  <div class="login-container max-w-sm mx-auto p-8 mt-20 bg-gray-800 rounded-xl shadow-2xl text-white">
    <h2 class="text-3xl font-bold mb-6 text-center text-cyan-400">{{ isSigningUp ? 'Sign Up' : 'Login' }} to Garuda V1</h2>
    <form @submit.prevent="submitAuth">
      
      <p v-if="errorMessage" class="error-message bg-red-600 p-3 rounded mb-4 text-sm text-center">
        {{ errorMessage }}
      </p>

      <div class="input-group mb-4">
        <label for="username" class="block text-gray-400 mb-1">Username (User ID):</label>
        <input 
            id="username" 
            type="text" 
            v-model="username" 
            required 
            class="w-full p-3 bg-gray-700 text-white rounded border border-gray-600 focus:ring-cyan-500 focus:border-cyan-500"
        />
      </div>
      
      <div class="input-group mb-6">
        <label for="password" class="block text-gray-400 mb-1">Password:</label>
        <input 
            id="password" 
            type="password" 
            v-model="password" 
            required 
            class="w-full p-3 bg-gray-700 text-white rounded border border-gray-600 focus:ring-cyan-500 focus:border-cyan-500"
        />
      </div>
      
      <button 
        type="submit"
        class="w-full py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-lg transition duration-200 shadow-md"
      >
        {{ isSigningUp ? 'Create Account' : 'Login' }}
      </button>

    </form>
    
    <div class="mt-6 text-center">
        <button 
            @click="isSigningUp = !isSigningUp; errorMessage = ''" 
            class="text-sm font-medium text-gray-400 hover:text-cyan-400 transition duration-150"
        >
            {{ isSigningUp ? 'Already have an account? Log In' : "Don't have an account? Sign Up" }}
        </button>
    </div>
  </div>
</template>


<!-- MapVisualization.vue -->

<template>
    <div class="map-container">
        <div class="map-header bg-gray-700 p-4 rounded-t-xl">
            <h3 class="text-lg font-semibold text-white">Interactive Map: Draw Your Area of Interest</h3>
            <p class="text-sm text-gray-400">Draw a Polygon, Point, or Line. Use the tools on the left.</p>
        </div>
        <div id="map" class="map-view"></div>

        <div v-if="requiresBufferInput" class="buffer-control bg-gray-700 p-3 flex items-center justify-center space-x-3 border-t border-gray-600">
            <label for="buffer" class="text-gray-300 font-medium">Buffer Distance (meters):</label>
            <input type="number" id="buffer" v-model.number="bufferDistance" min="0" placeholder="0" class="p-1 w-24 bg-gray-600 text-white rounded border border-gray-500">
        </div>
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref, nextTick } from 'vue';
import 'leaflet/dist/leaflet.css';
 
import 'leaflet-draw/dist/leaflet.draw.css';

// Ensure you have run: npm install leaflet leaflet-draw leaflet-geometryutil leaflet.gridlayer.googlemutant
import L from 'leaflet';
import 'leaflet-draw';
import 'leaflet-geometryutil'; 
import 'leaflet.gridlayer.googlemutant'; 

const emit = defineEmits(['aoi-drawn']);

// Reactive State
const map = ref<L.Map | null>(null);
const drawnItems = ref<L.FeatureGroup | null>(null);
const bufferDistance = ref<number | null>(null);
const requiresBufferInput = ref(false); 

// Utility function to patch Leaflet Draw (your original code included this, good practice!)
const safePatch = (handler: any) => {
    if (handler && handler.prototype && !handler.prototype._fireCreatedEvent) {
        handler.prototype._fireCreatedEvent = function (layer: L.Layer) {
            this._map.fire(L.Draw.Event.CREATED, { layer: layer, layerType: this.type });
        };
    }
};

onMounted(() => {
    // CRITICAL: Ensure the DOM element is ready and visible before initializing Leaflet
    nextTick(() => {
        // 1. Initialize Map
        if (!document.getElementById('map')) return;

        map.value = L.map('map').setView([21.5937, 80.9629], 5);
        
        const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' });
        // NOTE: Google Mutant requires API key in production, but we use it for visual realism
        const satelliteLayer = (L as any).gridLayer.googleMutant({ type: 'hybrid', attribution: 'Map data © Google' });
        
        const baseLayers = { 'OpenStreetMap': osmLayer, 'Satellite': satelliteLayer };
        L.control.layers(baseLayers).addTo(map.value!);
        osmLayer.addTo(map.value!);
        
        // 2. Setup Drawing Control
        safePatch(L.Draw.Polygon);
        safePatch(L.Draw.Rectangle);
        safePatch(L.Draw.Circle);

        drawnItems.value = new (L.FeatureGroup as any)();
        map.value!.addLayer(drawnItems.value);
        
        const drawControl = new (L.Control as any).Draw({
            draw: {
                polygon: true,
                rectangle: false, // Rectangle creates a polygon, simplify drawing options
                circle: false,    // Circle creates a polygon via calculation, but less common
                polyline: true,   // Enable Line
                marker: true      // Enable Point
            },
            edit: {
                featureGroup: drawnItems.value
            }
        });
        map.value!.addControl(drawControl);
        
        // 3. Handle Drawing Events
        map.value!.on((L.Draw as any).Event.DRAWSTART, (e: any) => {
            drawnItems.value!.clearLayers();
            requiresBufferInput.value = (e.layerType === 'marker' || e.layerType === 'polyline');
            bufferDistance.value = null;
        });

        map.value!.on((L.Draw as any).Event.CREATED, (e: any) => {
            let layer = e.layer;
            const layerType = e.layerType;

            // Handle Circle/Rectangle/Polygon normalization (similar to your provided logic)
            if (layer instanceof L.Circle) {
                // Convert circle to polygon here if needed, but for simplicity, we treat it as a polygon buffer case.
            }
            
            drawnItems.value!.addLayer(layer);
            
            // 4. Convert to GeoJSON and Emit
            const geoJsonFeature = layer.toGeoJSON();
            
            // Final object to emit
            const aoiData = {
                geometry: geoJsonFeature.geometry,
                geometryType: layerType === 'marker' ? 'Point' : (layerType === 'polyline' ? 'LineString' : 'Polygon'),
                buffer: bufferDistance.value || 0
            };

            // Emit the data, allowing the parent (Step 2) to save the draft
            emit('aoi-drawn', aoiData);
        });
    });
});
</script>



// frontend/src/components/steps/Step1BasicInfo.vue

<script setup lang="ts">
import { type AuxDataDraft } from '@/classes/ProjectFormData';
import { ref } from 'vue';
import { useProjectStore } from '@/stores/ProjectStore'; // Import the store

// We no longer need the prop, we use the store directly
const projectStore = useProjectStore(); 
const projectData = projectStore.projectForm; // Still keep a reference for auxDataDrafts

// Local reactive properties for aux data inputs only
const newAuxKey = ref('');
const newAuxValue = ref('');

const addAuxData = () => {
    if (newAuxKey.value && newAuxValue.value) {
        // Direct mutation on the array property is usually fine
        projectData.auxDataDrafts.push({
            key: newAuxKey.value,
            value: newAuxValue.value
        } as AuxDataDraft);
        newAuxKey.value = '';
        newAuxValue.value = '';
    }
};

const removeAuxData = (key: string) => {
    projectData.auxDataDrafts = projectData.auxDataDrafts.filter(draft => draft.key !== key);
};
</script>


<template>
  <div>
    <h3 class="text-xl font-bold text-white mb-4">Step 1: Project Basic Info</h3>
    
    <div class="form-group mb-4">
      <label class="text-gray-400">Project Name:</label>
      <input type="text" v-model="projectStore.projectName" required class="w-full p-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-cyan-500" />
    </div>
    <div class="form-group mb-4">
      <label class="text-gray-400">Description:</label>
      <textarea v-model="projectStore.description" rows="3" class="w-full p-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-cyan-500"></textarea>
    </div>

    <h4 class="text-lg font-semibold text-cyan-400 mt-6 mb-3">Custom Auxiliary Data (JSONB)</h4>
    <div class="aux-data-entry flex gap-3 mb-4">
        <input type="text" v-model="newAuxKey" placeholder="Key (e.g., Client)" class="p-2 bg-gray-700 text-white rounded border border-gray-600" />
        <input type="text" v-model="newAuxValue" placeholder="Value (e.g., NASA)" class="p-2 bg-gray-700 text-white rounded border border-gray-600" />
        <button @click="addAuxData" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded">Add Field</button>
    </div>
    <div class="aux-list space-y-2">
        <div v-for="draft in projectData.auxDataDrafts" :key="draft.key" class="aux-item flex justify-between p-2 bg-gray-700 rounded border border-gray-600">
            <span class="text-gray-300">{{ draft.key }}: <span class="text-white font-mono">{{ draft.value }}</span></span>
            <button @click="removeAuxData(draft.key as string)" class="text-red-400 hover:text-red-500 font-bold">x</button>
        </div>
    </div>
  </div>
</template>


Step2DefineAOI.vue
<script setup lang="ts">
import { ProjectFormData } from '@/classes/ProjectFormData';
import { AreaOfInterestDraft, GeoJsonPolygon } from '@/classes/AreaOfInterestDraft';
import MapVisualization from '@/components/map/MapVisualization.vue';
import { ref } from 'vue';

const props = defineProps<{
  projectData: ProjectFormData;
}>();

const currentAoiName = ref('');
// Initialize counter based on existing drafts (important for update mode)
let aoiCounter = props.projectData.aoiDrafts.length > 0 
                 ? Math.max(...props.projectData.aoiDrafts.map(a => a.clientAoiId)) + 1 
                 : 1;


// The main method called by the MapVisualization component when a geometry is drawn
const handleAOISubmission = (data: { geometry: GeoJsonPolygon, geometryType: string, buffer: number }) => {
    if (!currentAoiName.value) {
        alert('Please enter a name for your AOI first.');
        return;
    }
    
    // 1. Instantiate the AreaOfInterestDraft class
    const newAOI = new AreaOfInterestDraft(
        currentAoiName.value,
        data.geometry,
        aoiCounter,
        data.geometryType as any,
        data.buffer
    );
    
    const updatedAoiDrafts = [...props.projectData.aoiDrafts, newAOI];

    props.projectData.aoiDrafts = updatedAoiDrafts; // Force-updates the reactive property
    // 2. Add the new object to the ProjectFormData class (This is the critical line)
    
    // 3. Increment counter and reset UI input
    aoiCounter++;
    currentAoiName.value = ''; 
    alert(`AOI draft "${newAOI.name}" saved.`);
};

const removeAOI = (clientAoiId: number) => {
    props.projectData.aoiDrafts = props.projectData.aoiDrafts.filter(
        aoi => aoi.clientAoiId !== clientAoiId
    );
};
</script>



<template>
  <div>
    <h3>Step 2: Define Areas of Interest (AOI)</h3>
    
    <div class="form-group mb-4">
        <label class="text-white">AOI Name:</label>
        <input type="text" v-model="currentAoiName" placeholder="e.g., Farm Field 1 or Rio Grande Buffer Zone" required class="w-full p-2 bg-gray-700 text-white rounded border border-gray-600">
    </div>

    <div class="map-wrapper">
        <MapVisualization @aoi-drawn="handleAOISubmission" />
    </div>

    <h4 class="text-lg font-semibold mt-6 text-cyan-400">Draft AOIs ({{ projectData.aoiDrafts.length }})</h4>
    <div class="aoi-list-manager space-y-2 max-h-40 overflow-y-auto">
        <div v-for="aoi in projectData.aoiDrafts" :key="aoi.clientAoiId" class="aoi-draft flex justify-between items-center p-3 bg-gray-700 rounded shadow-md">
            <span>
                {{ aoi.name }} 
                <span :class="{'text-yellow-400': aoi.bufferDistance}" class="text-sm ml-2">({{ aoi.geometryType }})</span>
                <span v-if="aoi.bufferDistance" class="text-sm text-green-400 ml-2"> (+{{ aoi.bufferDistance }}m buffer)</span>
            </span>
            <button @click="removeAOI(aoi.clientAoiId)" class="remove-btn bg-red-600 hover:bg-red-700 text-white p-1 rounded">Remove</button>
        </div>
        <p v-if="projectData.aoiDrafts.length === 0" class="text-center text-gray-400 p-4">Draw an AOI on the map above to begin.</p>
    </div>
  </div>
</template>



// frontend/src/components/steps/Step3AlgoMapping.vue

<script setup lang="ts">
import { ProjectFormData } from '@/classes/ProjectFormData';
import { onMounted, ref, watch } from 'vue';
import { ApiClient } from '@/api/ApiClient';

const props = defineProps<{
  projectData: ProjectFormData;
}>();

const api = ApiClient.getInstance();

// Algorithms will now be fetched from the database via API
const algorithms = ref<any[]>([]); 

const selectedAOI = ref(props.projectData.aoiDrafts[0] || null);
const selectedAlgoId = ref<number | null>(null);
const currentConfigArgs = ref<string>('{}'); 

const loadConfig = () => {
    if (!selectedAOI.value || !selectedAlgoId.value) {
        currentConfigArgs.value = '{}';
        return;
    }

    const mapping = selectedAOI.value.mappedAlgorithms.find(
        a => a.algoId === selectedAlgoId.value
    );
    if (mapping) {
        currentConfigArgs.value = JSON.stringify(mapping.configArgs, null, 2);
    } else {
        const algo = algorithms.value.find(a => a.id === selectedAlgoId.value);
        // NOTE: Uses 'args' property from the fetched algorithm object
        currentConfigArgs.value = JSON.stringify(algo?.args || {}, null, 2); 
    }
};

const mapAlgoToAOI = () => {
    if (!selectedAOI.value || !selectedAlgoId.value) {
        alert('Please select an AOI and an Algorithm.');
        return;
    }
    try {
        const algo = algorithms.value.find(a => a.id === selectedAlgoId.value);
        if (!algo) {
            throw new Error("Algorithm not found in catalogue.");
        }
        const args = JSON.parse(currentConfigArgs.value);

        selectedAOI.value.mapAlgorithm(selectedAlgoId.value, algo.name, args);
        alert(`Algorithm ${algo.name} mapped/updated for AOI ${selectedAOI.value.name}.`);
    } catch (e) {
        alert('Invalid JSON in Configuration Arguments or Algorithm not found.');
        console.error(e);
    }
};

onMounted(async () => {
    try {
        const fetchedAlgos = await api.getAlgorithmCatalogue();
        algorithms.value = fetchedAlgos.map(a => ({
            id: a.id,
            name: a.algo_id, 
            algoId: a.id, // CRITICAL: Use PK 'id' for the algoId mapping, NOT the algo_id string
            category: a.category,
            args: a.args, 
        }));
        
        if (props.projectData.aoiDrafts.length > 0) {
            selectedAOI.value = props.projectData.aoiDrafts[0];
            selectedAlgoId.value = algorithms.value[0]?.id || null;
            loadConfig();
        }
    } catch (error) {
        console.error("Failed to load algorithm catalogue:", error);
        alert("Could not load algorithms from the database.");
    }
});

watch([selectedAOI, selectedAlgoId], loadConfig);
</script>

<template>
  <div class="p-4">
    <h3 class="text-xl font-bold text-white mb-4">Step 3: Configure AOI Watch (Algorithm Mapping)</h3>
    <div v-if="projectData.aoiDrafts.length === 0" class="bg-red-800 p-3 rounded text-white">
        You must define at least one AOI in Step 2 before configuring algorithms.
    </div>

    <div v-else class="mapping-container space-y-4">
        <div class="form-group">
            <label class="text-gray-400 block mb-1">Select AOI:</label>
            <select v-model="selectedAOI" class="w-full p-2 bg-gray-700 text-white rounded border border-gray-600">
                <option v-for="aoi in projectData.aoiDrafts" :key="aoi.clientAoiId" :value="aoi">
                    {{ aoi.name }} ({{ aoi.aoiId }})
                </option>
            </select>
        </div>
        
        <div class="form-group">
            <label class="text-gray-400 block mb-1">Select Algorithm:</label>
            <select v-model="selectedAlgoId" @change="loadConfig" class="w-full p-2 bg-gray-700 text-white rounded border border-gray-600">
                <option :value="null" disabled>-- Select an Algorithm --</option>
                <option v-for="algo in algorithms" :key="algo.id" :value="algo.id">
                    {{ algo.name }} ({{ algo.category }})
                </option>
            </select>
        </div>

        <div class="form-group">
            <label class="text-gray-400 block mb-1">Configuration Arguments (JSONB):</label>
            <textarea v-model="currentConfigArgs" rows="8" placeholder="{ }" class="w-full p-2 bg-gray-700 text-white rounded border border-gray-600 font-mono"></textarea>
            <p class="text-sm text-gray-500 mt-1">Define specific parameters for this AOI/Algorithm combination in valid JSON format.</p>
        </div>

        <button @click="mapAlgoToAOI" class="w-full px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-lg transition duration-200">
            Map / Update Algorithm
        </button>
    </div>
  </div>
</template>


Step4AddUsers.vue

<script setup lang="ts">
import { ProjectFormData } from '@/classes/ProjectFormData';
import { ref, computed } from 'vue';

const props = defineProps<{
  projectData: ProjectFormData;
}>();

const newUser = ref('');
const newRole = ref('viewer');
const availableRoles = ['owner', 'analyst', 'viewer'];

const canAddUser = computed(() => {
    return newUser.value.trim() !== '' && 
           !props.projectData.users.some(u => u.userId === newUser.value.trim());
});

const addUser = () => {
    if (canAddUser.value) {
        props.projectData.users.push({ 
            userId: newUser.value.trim(), 
            role: newRole.value,
            username: newUser.value.trim() // Using userId as username for mock
        });
        newUser.value = '';
        newRole.value = 'viewer';
    }
};

const removeUser = (userId: string) => {
    // Prevent removing the initial creator (simulated)
    if (userId === 'current_user_id') {
        alert("The creator cannot be removed.");
        return;
    }
    props.projectData.users = props.projectData.users.filter(u => u.userId !== userId);
};
</script>

<template>
  <div>
    <h3>Step 4: Add Users and Roles</h3>

    <div class="user-entry">
        <input type="text" v-model="newUser" placeholder="User ID / Email" />
        <select v-model="newRole">
            <option v-for="role in availableRoles" :key="role" :value="role">{{ role }}</option>
        </select>
        <button @click="addUser" :disabled="!canAddUser">Add User</button>
    </div>
    
    <h4>Current Collaborators</h4>
    <div class="user-list">
        <div v-for="user in projectData.users" :key="user.userId" class="user-item">
            <span>{{ user.username }} ({{ user.role }})</span>
            <button v-if="user.userId !== 'current_user_id'" @click="removeUser(user.userId)" class="remove-btn">x</button>
            <span v-else class="owner-tag">Creator (Owner)</span>
        </div>
    </div>
  </div>
</template>


// // router/index.ts
import { createRouter, createWebHistory } from 'vue-router';
// Standardizing imports to use the @ alias where possible
import { UserSession } from '@/classes/UserSession';

import HomeViewUI from '@/views/HomeViewUI.vue';
import ConfigureProjectUI from '@/views/ConfigureProjectUI.vue';
import LoginForm from '@/components/auth/LoginForm.vue';
import DisplayProjectUI from '@/views/DisplayProjectUI.vue';
import MonitorMapView from '@/views/MonitorMapView.vue';

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/login',
            name: 'login',
            component: LoginForm,
        },
        {
            path: '/',
            name: 'home',
            component: HomeViewUI,
            meta: { requiresAuth: true },
        },
        // ADD/CREATE Project route
        {
            path: '/project/new',
            name: 'add-project',
            component: ConfigureProjectUI,
            meta: { requiresAuth: true },
        },
        // MANAGE/UPDATE Project route (reuses ConfigureProjectUI)
        {
            path: '/project/update/:id', 
            name: 'update-project',
            component: ConfigureProjectUI,
            meta: { requiresAuth: true },
            props: true 
        },
        // LIST/MANAGE Projects route
        {
            path: '/projects/manage',
            name: 'manage-project',
            component: DisplayProjectUI,
            meta: { requiresAuth: true },
        },
        // MONITOR Map view route
        {
            path: '/project/monitor/:id', 
            name: 'monitor-map',
            component: MonitorMapView,
            meta: { requiresAuth: true },
            props: true
        }
    ],
});

// Navigation Guard (enforces login check using the UserSession class)
router.beforeEach((to, from, next) => {
    // We instantiate the class object here to check the login state
    const session = UserSession.getInstance();

    if (to.meta.requiresAuth && !session.isLoggedIn) {
        // Redirect to login if auth is required and user is logged out
        next('/login');
    } else if (to.name === 'login' && session.isLoggedIn) {
        // Redirect home if user is trying to access login while already logged in
        next('/');
    } else {
        next();
    }
});

export default router;

// ProjectStore.ts

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
// STATIC IMPORTS FOR CLASSES
import { ProjectFormData } from '../classes/ProjectFormData'; 
import { AreaOfInterestDraft } from '../classes/AreaOfInterestDraft'; // <-- Ensure this is added
import { ApiClient } from '../api/ApiClient';

const api = ApiClient.getInstance();

/**
 * Helper function to map the complex backend structure to the simpler ProjectFormData class structure.
 * This is now synchronous, relying on static imports.
 */
function mapBackendToForm(data: any): ProjectFormData {
    
    // Instantiate the ProjectFormData class
    const form = new ProjectFormData(true, data.id); // Set to update mode

    // Step 1 Mapping
    form.projectName = data.project_name;
    form.description = data.description;
    form.auxData = data.auxdata || {};
    form.currentStep = 1; // Reset to start step

    // Step 2 & 3 Mapping (AOIs and Mappings)
    let aoiCounter = 1;
    form.aoiDrafts = data.aois.map((aoi: any) => {
        // Instantiate the AreaOfInterestDraft class
        const aoiDraft = new AreaOfInterestDraft(aoi.name, aoi.geomGeoJson, aoiCounter++);
        aoiDraft.aoiId = aoi.aoi_id; 
        aoiDraft.geomProperties = aoi.geom_properties || {};

        // Map algorithms
        aoi.mappedAlgorithms.forEach((algo: any) => {
            aoiDraft.mapAlgorithm(
                algo.mapping_id, 
                algo.algo_id, // We should pass algo_id string here for better mapping logic
                algo.config_args
            );
        });
        return aoiDraft;
    });

    // Step 4 Mapping (Users)
    form.users = data.users.map((u: any) => ({
        userId: u.user_id,
        role: u.role,
        username: u.user_id,
    }));
    
    return form;
}


/**
 * ProjectStore: Manages the state and logic related to Project instances.
 */
export const useProjectStore = defineStore('project', () => {
// ... The rest of the Pinia store remains the same ...
// ... All functions (actions) correctly call mapBackendToForm now ...
    
    // State: Holds the active form object and the list of projects
    const projectForm = ref<ProjectFormData>(new ProjectFormData());
    const userProjects = ref<any[]>([]); 
    
    // Getters
    const isEditing = computed(() => projectForm.value.isUpdateMode);
    const currentStep = computed(() => projectForm.value.currentStep);

    // Actions
    
    function initNewProjectForm() {
        projectForm.value = new ProjectFormData(false, null);
    }

    async function submitProject(): Promise<void> {
        // ... (existing submitProject logic) ...
        const bundle = projectForm.value.toBackendBundle();
        
        // --- ADD DEBUG LOGGING ---
        console.log("--- SUBMIT PAYLOAD ---");
        console.log("Project Name:", bundle.projectBasicInfo.projectName);
        console.log("AOI Count:", bundle.aoiData.length);
        console.log("User Count:", bundle.userData.length);
        console.log("Full Bundle:", JSON.stringify(bundle, null, 2));
        console.log("------------------------");
        // -------------------------

        try {
            const response = await api.createProject(bundle);
            console.log('Project submitted successfully:', response.data);
            
            
            
            projectForm.value.reset();
            
        } catch (error) {
            console.error('Error submitting project:', error);
            // This is critical: Re-throw the error so the UI handles it
            throw new Error('Failed to submit project. See console for API error details.');
        }
    
    }
    
    async function fetchUserProjects(): Promise<void> {
        // ... (existing fetchUserProjects logic) ...

        try {
            const projects = await api.getProjects();
            // --- ADD DEBUG LOGGING ---
            console.log(`[ProjectStore] Fetched ${projects.length} projects.`);
            // -------------------------
            userProjects.value = projects;
        } catch (error) {
            console.error('Error fetching projects:', error);
            userProjects.value = [];
        }
    }

    async function loadProjectForUpdate(projectId: number): Promise<void> {
        try {
            const response = await api.getProjectDetails(projectId);
            projectForm.value = mapBackendToForm(response); 
        } catch (error) {
            console.error(`Error loading project ${projectId}:`, error);
            throw new Error('Failed to load project data for editing.');
        }
    }
    
    async function deleteProject(projectId: number): Promise<void> {
        await api.deleteProject(projectId);
    }

    // NEW ACTION: Use this in the component to go to the next step
    function nextStep() {
        projectForm.value.nextStep();
    }

    // NEW ACTION: Use this in the component to go to the previous step
    function prevStep() {
        projectForm.value.prevStep();
    }

    return {
        projectForm,
        userProjects,
        isEditing,
        currentStep,
        initNewProjectForm,
        submitProject,
        fetchUserProjects,
        loadProjectForUpdate,
        deleteProject,
        nextStep,
        prevStep,


        projectName: computed({
            get: () => projectForm.value.projectName,
            set: (val: string) => { projectForm.value.projectName = val; }
        }),
        description: computed({
            get: () => projectForm.value.description,
            set: (val: string | null) => { projectForm.value.description = val; }
        }),

    };
});


// ProjectTypes.ts
// Re-define the required imported types first (these were already defined in classes)
export interface GeoJsonPolygon {
    type: 'Polygon';
    coordinates: number[][][];
}

/**
 * Defines the complete data structure that the frontend's ProjectFormData.toBackendBundle() 
 * method must produce, and which the backend's ProjectService.createProject() expects.
 */
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
        mappedAlgorithms: { algoId: number; configArgs: Record<string, any> }[]; // PK 'id' is used
    }[];
    userData: { userId: string; role: string }[];
}


ConfigureProjectUI.vue

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useProjectStore } from '@/stores/ProjectStore';
import { storeToRefs } from 'pinia'; // <-- NEW IMPORT
import "tailwindcss";

// Component Imports
import Step1BasicInfo from '@/components/steps/Step1BasicInfo.vue';
import Step2DefineAOI from '@/components/steps/Step2DefineAOI.vue';
import Step3AlgoMapping from '@/components/steps/Step3AlgoMapping.vue';
import Step4AddUsers from '@/components/steps/Step4AddUsers.vue';

const router = useRouter();
const route = useRoute();
const projectStore = useProjectStore();


const { projectForm, projectName, description } = storeToRefs(projectStore);

const isDataLoading = ref(false);
const isMenuMode = ref(true); // NEW: Controls whether we show the card menu or the form

// Computed properties rely on the store's state for reactivity
const currentStep = computed(() => projectStore.currentStep);
const isFinalStep = computed(() => currentStep.value === 4);
const isUpdateMode = computed(() => projectForm.value.isUpdateMode);

const projectIdParam = route.params.id ? parseInt(route.params.id as string) : null;


onMounted(async () => {
    if (projectIdParam) {
        // If in update mode, load data and jump directly into the editing menu
        isDataLoading.value = true;
        try {
            await projectStore.loadProjectForUpdate(projectIdParam);
            isMenuMode.value = true; // Show the menu initially for updates
        } catch (error) {
            alert('Error loading project: ' + (error as Error).message);
            router.push('/');
        } finally {
            isDataLoading.value = false;
        }
    } else {
        // For new projects, start the form reset
        projectStore.initNewProjectForm();
        isMenuMode.value = true; // Show the menu to start
    }
});

/**
 * NEW: Switches from the menu card view to the specific step form view.
 */
const startStep = (stepNumber: number) => {
    projectForm.currentStep = stepNumber; // Directly set the step number on the class object
    isMenuMode.value = false; // Switch to form view
};

// Method to handle form submission
const handleSubmit = async () => {
    
    if (!projectName.value || projectForm.value.aoiDrafts.length === 0) {
        alert('Please complete Step 1 (Project Name) and Step 2 (Draw at least one AOI) before final submission.');
        return; 
    }
    try {
        await projectStore.submitProject();
        alert('Project successfully ' + (isUpdateMode.value ? 'updated.' : 'created!'));
        router.push('/');
    } catch (error) {
        console.error("Submission Error:", error);
        alert('Error submitting project. Check the console for API error details.');
    }
};

// Helper for navigation (Modified to handle menu mode)
const goBack = () => {
    if (!isMenuMode.value) {
        // If currently in a form step, go back to the main menu
        isMenuMode.value = true;
    } else {
        // If currently in the main menu, go back to the Home page
        router.push('/');
    }
};

// Helper for validation and moving forward (linear flow, used inside the form view)
const nextStep = () => {
    // Validation (as before)
    if (currentStep.value === 1 && !projectName.value) {
        alert('Please enter a Project Name.');
        return;
    }
    if (currentStep.value === 2 && projectForm.value.aoiDrafts.length === 0) {
        alert('Please define at least one Area of Interest.');
        return;
    }
    // CRITICAL DEBUG LOGGING: Check the state right now
    console.log(`--- DEBUG: BEFORE STEP ${projectStore.currentStep} ADVANCE ---`);
    console.log('ProjectName:', projectName.value);
    console.log('Description:', description.value);
    console.log('AOI Count:', projectForm.value.aoiDrafts.length);
    console.log('--------------------------------------------------');

    // Use the store action to safely advance the step counter
    projectStore.nextStep(); 
};

// Helper to determine active/visited status for styling the step indicators
const isStepActive = (step: number) => currentStep.value === step && !isMenuMode.value;
const isStepVisited = (step: number) => step < currentStep.value || (step === currentStep.value && !isMenuMode.value);


</script>

<template>
    <div v-if="isDataLoading" class="loading-message">Loading existing project data...</div>
    <div v-else class="configure-project-ui bg-gray-900 text-white">
        <div class="w-full max-w-6xl mx-auto rounded-2xl bg-gray-800 shadow-2xl p-6 relative pt-10">

            <!-- Header -->
            <header class="pb-4 app-header mb-6">
                <button class="mb-4 text-cyan-400 hover:text-cyan-300 transition duration-150" @click="goBack">
                    <svg class="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                    {{ isMenuMode ? 'Back to Home' : 'Back to Menu' }}
                </button>
                <h1 class="text-3xl font-bold text-white">{{ isUpdateMode ? 'Update Project' : 'Add New Project' }}</h1>
            </header>

            <!-- 1. Selection Menu (Visible when isMenuMode is true) -->
            <div v-if="isMenuMode" id="add-select-menu">
                <p class="mb-6 text-gray-400">Select a step to begin configuring your project:</p>
                
                <div class="space-y-4">
                    <!-- Step 1: Basic Info -->
                    <div @click="startStep(1)" class="w-full p-4 bg-gray-700 hover:bg-gray-600 transition duration-150 rounded-xl shadow-lg flex items-center space-x-4 cursor-pointer border-l-4 border-cyan-500">
                        <span class="text-xl font-bold text-cyan-400">1</span>
                        <span class="font-medium text-white">Project Basic Info</span>
                    </div>
                    
                    <!-- Step 2: Define AOI -->
                    <div @click="startStep(2)" class="w-full p-4 bg-gray-700 hover:bg-gray-600 transition duration-150 rounded-xl shadow-lg flex items-center space-x-4 cursor-pointer border-l-4 border-cyan-500">
                        <span class="text-xl font-bold text-cyan-400">2</span>
                        <span class="font-medium text-white">Define AOI</span>
                    </div>
                    
                    <!-- Step 3: Configure AOI Watch -->
                    <div @click="startStep(3)" class="w-full p-4 bg-gray-700 hover:bg-gray-600 transition duration-150 rounded-xl shadow-lg flex items-center space-x-4 cursor-pointer border-l-4 border-cyan-500">
                        <span class="text-xl font-bold text-cyan-400">3</span>
                        <span class="font-medium text-white">Configure AOI Watch</span>
                    </div>
                    
                    <!-- Step 4: Add Users -->
                    <div @click="startStep(4)" class="w-full p-4 bg-gray-700 hover:bg-gray-600 transition duration-150 rounded-xl shadow-lg flex items-center space-x-4 cursor-pointer border-l-4 border-cyan-500">
                        <span class="text-xl font-bold text-cyan-400">4</span>
                        <span class="font-medium text-white">Add Users</span>
                    </div>
                </div>
                
                <!-- Submit button for the main menu -->
                <div class="mt-8 text-center">
                    <button 
                        @click="handleSubmit" 
                        class="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg transition duration-200"
                        :disabled="projectForm.projectName === ''"
                        :class="{'opacity-50 cursor-not-allowed': projectForm.projectName === ''}"
                    >
                        {{ isUpdateMode ? 'FINAL UPDATE' : 'FINAL SUBMIT' }}
                    </button>
                    <p v-if="projectForm.projectName === ''" class="text-red-400 mt-2 text-sm">Please complete Step 1 before final submission.</p>
                </div>
            </div>

            <!-- 2. Step Form (Visible when isMenuMode is false) -->
            <div v-else id="add-step-form">
                
                <!-- Progress Bar -->
                <div class="flex justify-between items-center relative mb-10 mt-4">
                    <template v-for="step in 4" :key="step">
                        <!-- Step Indicator -->
                        <div class="w-1/4 flex flex-col items-center relative z-10">
                            <div 
                                class="w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-all duration-300"
                                :class="{
                                    'bg-cyan-500 border-cyan-500 text-white': isStepActive(step),
                                    'bg-green-600 border-green-600 text-white': isStepVisited(step) && !isStepActive(step),
                                    'bg-gray-700 border-gray-600 text-gray-400': !isStepVisited(step) && !isStepActive(step)
                                }"
                            >
                                {{ step }}
                            </div>
                            <span class="text-xs mt-1 text-center" :class="{'text-cyan-400 font-bold': isStepActive(step), 'text-gray-400': !isStepActive(step)}">
                                {{ ['Basic Info', 'Define AOI', 'Config Watch', 'Add Users'][step - 1] }}
                            </span>
                        </div>
                        <!-- Line Connector -->
                        <div 
                            v-if="step < 4" 
                            class="absolute top-4 h-0.5 z-0 transition-all duration-500"
                            :style="{ 
                                left: (step * 25 - 12.5) + '%', 
                                width: '25%', 
                                transform: 'translateX(-50%)',
                            }"
                            :class="{'bg-green-600': isStepVisited(step), 'bg-gray-700': !isStepVisited(step)}"
                        ></div>
                    </template>
                </div>
                
                <!-- Step Content -->
                <div class="step-content border border-gray-700 p-4 rounded-xl">
                    <Step1BasicInfo v-if="currentStep === 1" :project-data="projectForm" />
                    <Step2DefineAOI v-if="currentStep === 2" :project-data="projectForm" />
                    <Step3AlgoMapping v-if="currentStep === 3" :project-data="projectForm" />
                    <Step4AddUsers v-if="currentStep === 4" :project-data="projectForm" />
                </div>

                <!-- Navigation Buttons (Back to Menu, Next Step) -->
                <div class="navigation-controls mt-6">
                    <button @click="goBack" class="btn-secondary bg-gray-700 text-white hover:bg-gray-600">
                        ← Back to Menu
                    </button>

                    <button v-if="!isFinalStep" @click="nextStep" class="btn-primary bg-cyan-600 hover:bg-cyan-700 text-white">
                        Next (Step {{ currentStep + 1 }})
                    </button>

                    <button v-else @click="handleSubmit" class="btn-submit bg-blue-600 hover:bg-blue-700 text-white">
                        {{ isUpdateMode ? 'Final Update' : 'Final Submit' }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>



<!-- DisplayProjectUI.vue -->

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useProjectStore } from '@/stores/ProjectStore';

const router = useRouter();
const route = useRoute();
const projectStore = useProjectStore();

// UI State
const isLoading = ref(true);
const errorMessage = ref('');
const isMonitorMode = computed(() => route.query.mode === 'monitor');

// Filter/Search State
const searchTerm = ref('');
const filterRole = ref('');
const filterStatus = ref('');
const filterDate = ref('');

// Available filter options (derived from store data or mock)
const availableRoles = ['owner', 'analyst', 'viewer'];
const availableStatuses = ['Active', 'Draft', 'Archived']; 

onMounted(async () => {
    isLoading.value = true;
    try {
        await projectStore.fetchUserProjects();
    } catch (error) {
        errorMessage.value = 'Failed to load projects.';
    } finally {
        isLoading.value = false;
    }
});

// COMPUTED PROPERTY FOR FILTERING
const filteredProjects = computed(() => {
    if (isLoading.value) return [];
    
    // Start with all projects from the store
    let projects = projectStore.userProjects;

    // 1. Search Filter (by name/description)
    if (searchTerm.value) {
        const term = searchTerm.value.toLowerCase();
        projects = projects.filter(p =>
            p.project_name.toLowerCase().includes(term) ||
            p.description?.toLowerCase().includes(term)
        );
    }
    
    // 2. Role Filter (based on the user's role in the project)
    if (filterRole.value) {
        projects = projects.filter(p => p.role === filterRole.value);
    }
    
    // 3. Status Filter (MOCK - requires a 'status' field in the DB)
    if (filterStatus.value) {
        // For demonstration, we mock Status based on the first letter of the project name
        // In a real app, this would be a DB column.
        if (filterStatus.value === 'Active') {
            projects = projects.filter(p => p.project_name.startsWith('A'));
        }
    }

    // 4. Mode Filter (Monitor vs Manage)
    if (isMonitorMode.value) {
        // In monitor mode, maybe only show projects where the user is an analyst or owner
        projects = projects.filter(p => p.role === 'owner' || p.role === 'analyst');
    }

    return projects;
});


const handleProjectAction = (project: any) => {
    if (isMonitorMode.value) {
        // Action: Monitor Project (opens map UI with live AOIs)
        router.push({ name: 'monitor-map', params: { id: project.id } }); 
    } else {
        // Action: Manage/Update Project (reuses ConfigureProjectUI)
        router.push({ name: 'update-project', params: { id: project.id } }); 
    }
};

const handleDelete = async (projectId: number, projectName: string) => {
    // Note: Replaced `confirm` with a simple alert/check as per core rules.
    const confirmed = prompt(`Type DELETE to confirm deletion of project: "${projectName}"`);
    if (confirmed === 'DELETE') {
        try {
            await projectStore.deleteProject(projectId);
            await projectStore.fetchUserProjects(); // Refresh list
            alert(`Project "${projectName}" deleted successfully.`);
        } catch (error) {
            alert('Deletion failed: You must be the project owner. See console for details.');
            console.error(error);
        }
    }
};

const goBack = () => {
    router.push('/');
};

</script>

<template>
  <div id="manage-view" class="min-h-screen bg-gray-900 text-white flex justify-center pt-20">
    <div class="w-full max-w-4xl mx-auto rounded-2xl bg-gray-800 shadow-2xl p-6 relative">
        
        <!-- Header for Manage View -->
        <header class="pb-6 mb-6 flex items-center">
            <button @click="goBack" class="mr-4 text-cyan-400 hover:text-cyan-300 transition duration-150" title="Back to Home">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
            </button>
            <h1 class="text-3xl font-bold text-white">{{ isMonitorMode ? 'Monitor Projects' : 'Manage Projects' }}</h1>
            <span v-if="isMonitorMode" class="ml-4 px-3 py-1 bg-purple-600 rounded-full text-sm font-semibold">Live Mode</span>
        </header>

        <!-- Project List Section -->
        <div>
            
            <!-- Smart Search and Filters Container -->
            <div class="flex justify-between items-center mb-4 space-x-3">
                <input 
                    type="text" 
                    v-model="searchTerm" 
                    placeholder="Search Name/Desc..." 
                    class="w-full p-3 rounded-xl bg-gray-700 text-white border border-gray-600 focus:ring-cyan-500 focus:border-cyan-500 transition duration-150" 
                >
                <!-- Add Project Button -->
                <button 
                    @click="router.push({ name: 'add-project' })" 
                    class="ml-3 p-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl shadow-lg transition duration-150 flex-shrink-0" 
                    title="Add New Project"
                >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                </button>
            </div>
            
            <!-- Filter Selects -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 text-sm">
                <select v-model="filterStatus" class="p-3 rounded-xl bg-gray-700 text-gray-400 border border-gray-600">
                    <option value="">Filter Status</option>
                    <option v-for="s in availableStatuses" :key="s" :value="s">{{ s }}</option>
                </select>
                <select v-model="filterRole" class="p-3 rounded-xl bg-gray-700 text-gray-400 border border-gray-600">
                    <option value="">Filter Role</option>
                    <option v-for="r in availableRoles" :key="r" :value="r">{{ r.charAt(0).toUpperCase() + r.slice(1) }}</option>
                </select>
                <!-- Filter Type (MOCK) -->
                <select class="p-3 rounded-xl bg-gray-700 text-gray-400 border border-gray-600">
                    <option value="">Filter Type</option>
                </select>
                <!-- Filter Date -->
                <input type="date" v-model="filterDate" class="p-3 rounded-xl bg-gray-700 text-gray-400 border border-gray-600">
            </div>
            
            <!-- Project List -->
            <div class="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                <p v-if="isLoading" class="text-center py-8 text-gray-400">Loading projects...</p>
                <p v-else-if="errorMessage" class="text-center py-8 text-red-500">{{ errorMessage }}</p>
                <p v-else-if="filteredProjects.length === 0" class="text-center py-8 text-gray-400">No projects match your criteria.</p>

                <div 
                    v-for="project in filteredProjects" 
                    :key="project.id" 
                    class="flex justify-between items-center p-4 rounded-xl bg-gray-700 hover:bg-gray-600 transition duration-150 shadow-md border-l-4 border-cyan-500"
                >
                    <!-- Project Info -->
                    <div class="flex-grow">
                        <h3 class="text-xl font-bold text-white">{{ project.project_name }}</h3>
                        <p class="text-sm text-gray-400 truncate">{{ project.description || 'No description.' }}</p>
                        <span class="text-xs font-semibold px-2 py-0.5 mt-1 rounded text-cyan-200 bg-cyan-700 inline-block">Role: {{ project.role }}</span>
                    </div>

                    <!-- Actions -->
                    <div class="flex space-x-2 flex-shrink-0 ml-4">
                        <button 
                            @click="handleProjectAction(project)" 
                            class="p-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white transition duration-150"
                            :title="isMonitorMode ? 'View Live Map' : 'Edit Project'"
                        >
                            <svg v-if="isMonitorMode" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                            <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                        </button>

                        <button 
                            v-if="!isMonitorMode" 
                            @click="handleDelete(project.id, project.project_name)" 
                            class="p-2 rounded-full bg-red-600 hover:bg-red-700 text-white transition duration-150"
                            title="Delete Project (Requires Owner Role)"
                        >
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
  </div>
</template>


<!-- HomeViewUI.vue -->

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useProjectStore } from '@/stores/ProjectStore';
import { UserSession } from '@/classes/UserSession';
import { ref, onMounted, computed } from 'vue';


const router = useRouter();
const projectStore = useProjectStore();
const session = UserSession.getInstance();


const totalProjects = ref(0);
const activeAlerts = computed(() => projectStore.totalAlerts); // Reactive alert count

onMounted(async () => {
    // Fetch projects to update the count in the dashboard sneak peek
    await Promise.all([
        projectStore.fetchUserProjects(),
    ]);
    totalProjects.value = projectStore.userProjects.length;
    // In a future phase, activeAlerts would be fetched from the backend Alert table
});


const handleAddProject = () => {
    projectStore.initNewProjectForm();
    router.push({ name: 'add-project' });
};

const handleManageProject = () => {
    router.push({ name: 'manage-project' });
};

const handleMonitorProject = () => {
    router.push({ name: 'manage-project', query: { mode: 'monitor' } });
};

const handleLogout = () => {
    session.logout();
    router.push('/login');
};
</script>



<template>
  <div id="home-view" class="main-container  flex items-center justify-center" style="background-color: var(--bg-color);">
    <div class="w-full max-w-2xl mx-auto p-8 rounded-2xl app-card text-center pt-20"> 
        <h1 class="text-5xl font-extrabold mb-2 tracking-tight" style="color: var(--text-color);">Welcome {{ session.username || 'Admin' }}</h1>
        <p class="text-lg mb-10" style="color: var(--accent-color);">Geospatial Area Monitoring with Unified Data Analytics</p>

        <div class="flex justify-center space-x-4 mb-12 text-sm">
            <div class="px-4 py-2 app-card-item rounded-xl">
                <p class="text-gray-400" style="color: var(--text-muted);">Total Projects</p>
                <p class="font-bold text-xl" style="color: var(--text-color);">{{ totalProjects }}</p>
            </div>
            <div class="px-4 py-2 app-card-item rounded-xl">
                <p class="text-gray-400" style="color: var(--text-muted);">Active Alerts</p>
                <p class="font-bold text-xl" :style="{color: activeAlerts > 0 ? '#dc2626' : 'var(--text-color)'}">{{ activeAlerts }}</p>
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <div @click="handleAddProject" class="cursor-pointer p-6 rounded-2xl border-b-4 border-blue-600 shadow-xl" style="background-color: var(--card-bg);">
                <svg class="w-12 h-12 mx-auto text-blue-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <h2 class="text-xl font-bold mb-1" style="color: var(--text-color);">Add Project</h2>
                <p class="text-sm" style="color: var(--text-muted);">Define a new Area of Interest (AOI) and monitoring rules.</p>
            </div>

            <div @click="handleManageProject" class="cursor-pointer p-6 rounded-2xl border-b-4 border-orange-600 shadow-xl" style="background-color: var(--card-bg);">
                <svg class="w-12 h-12 mx-auto text-orange-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.294.58 3.35 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                <h2 class="text-xl font-bold mb-1" style="color: var(--text-color);">Manage Projects</h2>
                <p class="text-sm" style="color: var(--text-muted);">View, filter, edit details, and modify users for existing AOIs.</p>
            </div>

            <div @click="handleMonitorProject" class="cursor-pointer p-6 rounded-2xl border-b-4 border-purple-600 shadow-xl" style="background-color: var(--card-bg);">
                 <svg class="w-12 h-12 mx-auto text-purple-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                <h2 class="text-xl font-bold mb-1" style="color: var(--text-color);">Monitor Projects</h2>
                <p class="text-sm" style="color: var(--text-muted);">Real-time geospatial visualization and alert analysis.</p>
            </div>

        </div>
    </div>
  </div>
</template>


MonitorMapView.vue

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ApiClient } from '@/api/ApiClient';
import MapVisualization from '@/components/map/MapVisualization.vue';

const props = defineProps<{
    id: string; // The project ID from the route parameter
}>();

const router = useRouter();
const apiClient = ApiClient.getInstance();

const isLoading = ref(true);
const project = ref<any>(null);

onMounted(async () => {
    try {
        // Fetch the detailed project data needed for visualization
        const data = await apiClient.getProjectDetails(parseInt(props.id));
        project.value = data;
    } catch (error) {
        alert('Could not load project for monitoring.');
        router.push('/');
    } finally {
        isLoading.value = false;
    }
});

// NOTE: In a complete application, the MapVisualization component would 
// be extended here to include logic for adding GeoJSON layers (the AOIs)
// and potentially real-time data or alerts.
</script>

<template>
  <div class="monitor-map-view">
    <button @click="router.back()" class="btn-back">← Back to Projects</button>
    
    <div v-if="isLoading" class="loading">Loading Monitor Data for Project ID: {{ props.id }}...</div>
    
    <div v-else-if="project" class="map-content">
      <h2>Monitoring: {{ project.project_name }}</h2>
      <p class="aoi-count">AOIs Under Watch: {{ project.aois.length }}</p>
      
      <div class="map-container">
        <MapVisualization :aois-to-display="project.aois" />
      </div>
    </div>

    <div v-else class="error">Project not found.</div>
  </div>
</template>

<!-- App.vue -->

<script setup lang="ts">
import { ref, watchEffect, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { UserSession } from './classes/UserSession';
import { useProjectStore } from './stores/ProjectStore'; // Import store for alerts

const router = useRouter();
const route = useRoute();
const session = UserSession.getInstance();
const projectStore = useProjectStore(); // Use project store for alert count


const showNavbar = ref(false);
const isDarkMode = ref(false); // Default to false (Light Theme)
const alertCount = computed(() => projectStore.userProjects.length > 0 ? 1 : 0); // Mocked alert count for demonstration

// Watch for changes in the route/login state to determine if the navbar should show


// Theme Toggle Function
const toggleTheme = () => {
    isDarkMode.value = !isDarkMode.value;
    document.body.classList.toggle('dark', isDarkMode.value);
    document.body.classList.toggle('light', !isDarkMode.value);
};

onMounted(() => {
    // Set initial theme based on preference or system (default to light)
    document.body.classList.add('light'); 
    
    // Simulate splash screen fade out
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.style.opacity = '0';
            setTimeout(() => {
                splash.style.display = 'none';
            }, 500);
        }
    }, 500);
    
});

watchEffect(() => {
    // Show navbar/layout elements only if the user is logged in AND not on the login page
    showNavbar.value = session.isLoggedIn && route.name !== 'login';
    console.log(session.isLoggedIn);
});



// A simple navigation function for the top-level view
const goToHome = () => {
    if (session.isLoggedIn) {
        router.push('/');
    }
};

const handleLogout = () => {
    session.logout();
    router.push('/login');
};

// Compute initials for profile icon
const profileInitials = computed(() => {
    const name = session.username || 'User';

    const words = name.split(' ');
    if (words.length > 1) {
        return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name[0]?.toUpperCase() || 'AD';
});
</script>



<template>
  <div id="app-wrapper">
    
    <div id="splash-screen" class="fixed inset-0 flex flex-col justify-center items-center z-50 transition-opacity duration-500" style="background-color: var(--bg-color);">
        <div class="text-4xl font-extrabold tracking-widest flex items-center space-x-4" style="color: var(--text-color);">
            <div class="h-40 w-40 bg-cyan-100 rounded-full flex items-center justify-center text-white text-3xl">
              <img src="@/assets/garuda.png" alt="Garuda Logo" class="h-20 w-auto">

            </div> 
        </div>
        <p class="mt-4 text-sm tracking-wider" style="color: var(--accent-color);"><b>G</b>eospatial <b>Ar</b>ea Monitoring with <b>U</b>nified <b>D</b>ata <b>A</b>nalytics</p>
    </div>
    
<div v-if="showNavbar"  class="fixed top-0 left-0 right-0 px-8 py-3 flex justify-between items-center z-20 shadow-md transition-colors duration-300" style="background-color: var(--container-bg); border-bottom: 1px solid var(--header-border);">        
        <div class="flex items-center space-x-2 cursor-pointer" @click="goToHome">
             <img src="@/assets/garuda.png" alt="Garuda Logo" class="h-10 w-auto">
        </div>
        
        <div class="flex items-center space-x-4">
            
            <button @click="toggleTheme" class="p-2 transition-colors duration-200" :style="{color: isDarkMode ? 'var(--accent-color)' : 'var(--text-muted)'}">
                <svg v-if="isDarkMode" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>
                <svg v-else class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
            </button>

            <button class="relative p-2 hover:text-red-500 transition-colors duration-200" style="color: var(--text-muted);">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
                <span v-if="alertCount > 0" class="absolute top-1 right-1 bg-red-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                    {{ alertCount > 99 ? '99+' : alertCount }}
                </span>
            </button>
            
            <div @click="handleLogout" title="Logout" class="cursor-pointer w-9 h-9 bg-cyan-600 rounded-full flex items-center justify-center text-white font-semibold text-sm hover:bg-red-500 transition-colors duration-200">
                {{ profileInitials }}
            </div>
        </div>
    </div>
    <main class="app-content" :class="{'pt-20': showNavbar}"> 
      <RouterView />
    </main>
  </div>
</template>

import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import './style.css'; // Global styles
import "tailwindcss";

// Create the root Vue application instance
const app = createApp(App);

// Install Pinia for state management (used by your ProjectStore)
app.use(createPinia());

// Install the Vue Router
app.use(router);

// Mount the application to the DOM (assuming index.html has <div id="app"></div>)
app.mount('#app');


the above was my frontend files, now lets move to the backend folder files

// backend/src/controllers/AlertsController.ts

import { Router } from 'express'; 

// which handles the difference between CommonJS and ES Modules better.
import type { Request, Response, NextFunction } from 'express'; 

import { AlertsService } from '../services/AlertsService.ts';
import type { NewAlertPayload } from '../services/AlertsService.ts';

/**
 * AlertsController: Manages all API endpoints related to alerts.
 */
export class AlertsController {
    public router: Router;
    private alertsService: AlertsService;

    constructor() {
        this.router = Router();
        this.alertsService = new AlertsService();
        this.initializeRoutes();
    }

    private initializeRoutes() {
        // POST /api/alerts - Endpoint to insert a new alert
        this.router.post('/', this.recordAlert);
        
        // You would add GET/DELETE/etc. routes here later
    }

    /**
     * Express handler to record a new alert based on the request body.
     */
    private recordAlert = async (req: Request, res: Response, next: NextFunction) => {
        try {
            // TypeScript casting for clarity, matching the service interface
            const payload: NewAlertPayload = req.body; 

            // Assuming the project_id, aoi_fk_id, and algo_fk_id are valid FKs 
            // This relies on the database to throw an error if the FKs are invalid.

            const newAlert = await this.alertsService.recordNewAlert(payload);

            // Respond with the newly created alert details (including the generated ID and timestamp)
            res.status(201).json({ 
                message: 'Alert successfully recorded.',
                alert: {
                    id: newAlert.id,
                    project_id: newAlert.projectId,
                    aoi_fk_id: newAlert.aoiFkId,
                    algo_fk_id: newAlert.algoFkId,
                    message: newAlert.message,
                    alert_timestamp: newAlert.alertTimestamp
                }
            });

        } catch (error) {
            // Pass the error to the Express error handler middleware
            console.error('Error in recordAlert:', error);
            const errorMessage = (error as Error).message;
            // Use 400 for bad data (missing fields, invalid FKs)
            res.status(400).json({ error: errorMessage });
        }
    };
}


// AuthController.ts

import { Router } from 'express';
import type { Request, Response } from 'express';
import { UserModel } from '../models/UserModel.ts'; // <-- NEW IMPORT
/**
 * AuthController: Handles user login and signup using the database.
 */
export class AuthController {
    public router: Router;

    constructor() {
        this.router = Router();
        this.initializeRoutes();
    }

    private initializeRoutes() {
        this.router.post('/login', this.login); 
        this.router.post('/signup', this.signup); // <-- NEW SIGNUP ROUTE
    }

    /**
     * POST /api/auth/login - Checks credentials against the users table.
     */
    public login = async (req: Request, res: Response): Promise<Response> => {
        const { username, password } = req.body;
        const userId = username; // Assume userId is the same as the username/email for login

        try {
            const user = await UserModel.findById(userId);

            if (!user) {
                return res.status(401).json({ success: false, message: 'Invalid credentials or user not found.' });
            }

            // CRITICAL: Simple plain text password check (replace with bcrypt in production)
            if (user.passwordHash !== password) {
                return res.status(401).json({ success: false, message: 'Invalid credentials.' });
            }

            return res.status(200).json({ 
                success: true, 
                userId: user.userId,
                username: user.username,
                message: 'Login successful'
            });
        } catch (error) {
            console.error('Login Error:', error);
            return res.status(500).json({ success: false, message: 'Server error during login.' });
        }
    }

    /**
     * POST /api/auth/signup - Creates a new user in the users table.
     */
    public signup = async (req: Request, res: Response): Promise<Response> => {
        const { username, password } = req.body;
        const userId = username; // Use username as the unique user_id for simplicity

        // Simple validation
        if (!username || !password || username.length < 3 || password.length < 3) {
            return res.status(400).json({ success: false, message: 'Username and password must be at least 3 characters long.' });
        }

        try {
            // Check if user already exists
            const existingUser = await UserModel.findById(userId);
            if (existingUser) {
                return res.status(409).json({ success: false, message: 'User already exists.' });
            }

            // Create new user (password is stored as plain text for now)
            const newUser = new UserModel({
                user_id: userId,
                username: username,
                password_hash: password // Plain text password for mock hash
            });
            await newUser.save();

            return res.status(201).json({ 
                success: true, 
                userId: newUser.userId,
                username: newUser.username,
                message: 'Signup successful. Please log in.'
            });
        } catch (error) {
            console.error('Signup Error:', error);
            if (error.code === '23505') {
                 return res.status(409).json({ success: false, message: 'User already exists (unique constraint violation).' });
            }
            return res.status(500).json({ success: false, message: 'Server error during signup.' });
        }
    }
}



// ProjectController.ts


import { Router } from 'express';

import type { Request, Response, NextFunction } from 'express';

import { ProjectService } from '../services/ProjectService.ts';
import type { ProjectCreationBundle } from '../services/ProjectService.ts';

/**
 * ProjectController: Handles routing and HTTP request/response logic for projects.
 */
export class ProjectController {
    public router: Router;
    private projectService: ProjectService;

    constructor() {
        this.router = Router();
        this.projectService = new ProjectService();
        this.initializeRoutes();
    }

    private initializeRoutes() {
    this.router.post('/', this.createProject);          // POST /api/projects
    this.router.get('/', this.getProjectsByUser);       // GET /api/projects
    this.router.get('/algorithms', this.getAlgorithmCatalogue); // GET /api/projects/algorithms
    this.router.get('/:id', this.getProjectDetails);    // GET /api/projects/:id
    this.router.delete('/:id', this.deleteProject);     // DELETE /api/projects/:id
};

    /**
     * POST /api/projects
     * Handles the final submission of the 4-step project creation form.
     */
    public createProject = async (req: Request, res: Response): Promise<Response> => {
        // NOTE: In this single-user simulation, we hardcode the userId from the simple login
        const currentUserId = req.header('X-User-ID') || 'user123'; // Assume header is set after login

        const projectBundle: ProjectCreationBundle = req.body;

        try {
            // Service handles the transaction logic
            const newProject = await this.projectService.createProject(projectBundle, currentUserId);

            return res.status(201).json({
                message: 'Project created successfully across all tables.',
                project: newProject
            });
        } catch (error) {
            console.error('Controller Error during project creation:', error);
            // Send a generic error response to the client
            return res.status(500).json({
                error: 'Failed to create project.',
                details: (error as Error).message
            });
        }
    }

    /**
     * GET /api/projects
     * Fetches all projects the current user is involved in (for HomeViewUI: Manage/Monitor)
     */
    public getProjectsByUser = async (req: Request, res: Response): Promise<Response> => {
        const currentUserId = req.header('X-User-ID') || 'user123';

        try {
            const projects = await this.projectService.getUserProjects(currentUserId);
            return res.status(200).json(projects);
        } catch (error) {
            console.error('Controller Error fetching projects:', error);
            return res.status(500).json({ error: 'Failed to fetch user projects.' });
        }
    }
 
    public getProjectDetails = async (req: Request, res: Response): Promise<Response> => {
        const projectIdParam = req.params.id;
        const projectId = parseInt(projectIdParam);

        // CRITICAL FIX: Validate that projectId is a number before passing it to the service
        if (isNaN(projectId)) {
            return res.status(400).json({ message: 'Invalid Project ID format.' });
        }

        try {
            const details = await this.projectService.getProjectDetails(projectId);

            if (!details) {
                return res.status(404).json({ message: 'Project not found.' });
            }
            // Check if user has permission (can be added here using a lookup in UsersToProjectModel)

            return res.status(200).json(details);
        } catch (error) {
            console.error('Controller Error fetching project details:', error);
            return res.status(500).json({ error: 'Failed to fetch project details.' });
        }
    }

    

    /**
     * DELETE /api/projects/:id
     * Deletes a project and all associated data.
     */
    public deleteProject = async (req: Request, res: Response): Promise<Response> => {
        const projectId = parseInt(req.params.id);
        // Note: A security check should be added here to ensure the user is the 'owner'

        try {
            const success = await this.projectService.deleteProject(projectId);

            if (success) {
                return res.status(204).send(); // 204 No Content is standard for successful deletion
            } else {
                return res.status(404).json({ message: 'Project not found or already deleted.' });
            }
        } catch (error) {
            console.error('Controller Error deleting project:', error);
            return res.status(500).json({ error: 'Failed to delete project.' });
        }
    }

    public getAlgorithmCatalogue = async (req: Request, res: Response): Promise<Response> => {
        try {
            const algorithms = await this.projectService.getAlgorithmCatalogue();
            return res.status(200).json(algorithms);
        } catch (error) {
            console.error('Controller Error fetching algorithms:', error);
            return res.status(500).json({ error: 'Failed to fetch algorithm catalogue.' });
        }
    }
}




// backend/src/db/DBClient.ts

import { Pool } from 'pg';
import type { QueryResult } from 'pg';

import * as dotenv from 'dotenv';

dotenv.config();

// Singleton class for managing the PostgreSQL connection pool
export class DBClient {
    private static instance: DBClient;
    // CRITICAL: Make the pool public so ProjectService can manage transactions
    public pool: Pool; 

    private constructor() {
        this.pool = new Pool({
            user: process.env.DB_USER,
            host: process.env.DB_HOST,
            database: process.env.DB_DATABASE,
            password: process.env.DB_PASSWORD,
            port: parseInt(process.env.DB_PORT || '5432'),
        });

        this.pool.on('error', (err) => {
            console.error('Unexpected error on idle client', err);
            // Non-transactional queries might fail, but let's not exit the process for a single error
            // process.exit(-1); // Removed to keep the server running unless fatal
        });
        console.log('Database Pool Initialized.');
    }

    public static getInstance(): DBClient {
        if (!DBClient.instance) {
            DBClient.instance = new DBClient();
        }
        return DBClient.instance;
    }

    // Generic method to execute SQL queries (used outside of transactions)
    public async query<T>(text: string, params: any[] = []): Promise<QueryResult<T>> {
        const client = await this.pool.connect();
        try {
            const result = await client.query(text, params);
            return result;
        } catch (error) {
            console.error('Database query error:', error);
            throw error;
        } finally {
            client.release();
        }
    }
}

// AlertModel.ts

import { DBClient } from '../db/DBClient.ts';
import type { QueryResult } from 'pg';

const db = DBClient.getInstance();

/**
 * Interface representing the structure of a row in the 'alerts' database table.
 */
export interface AlertData {
    id: number;
    project_id: number;
    aoi_fk_id: number; // FK to area_of_interest.id
    algo_fk_id: number; // FK to algorithm_catalogue.id
    message: Record<string, any>;
    alert_timestamp: Date;
}

/**
 * AlertModel: Handles persistence and retrieval logic for the 'alerts' table.
 */
export class AlertModel {
    public id: number | null;
    public projectId: number;
    public aoiFkId: number;
    public algoFkId: number;
    public message: Record<string, any>;
    public alertTimestamp: Date | null;

    /**
     * Initializes a new AlertModel instance.
     * @param data - Partial data to initialize the model.
     */
    constructor(data: Partial<AlertData>) {
        this.id = data.id || null;
        this.projectId = data.project_id!;
        this.aoiFkId = data.aoi_fk_id!;
        this.algoFkId = data.algo_fk_id!;
        this.message = data.message || {};
        this.alertTimestamp = data.alert_timestamp || null;
    }

    /**
     * Records a new alert in the database.
     * @returns The ID of the newly created alert.
     */
    public async save(): Promise<number> {
        if (!this.projectId || !this.aoiFkId || !this.algoFkId) {
            throw new Error("Alert must reference a Project, AOI, and Algorithm.");
        }

        const query = `
            INSERT INTO alerts 
            (project_id, aoi_fk_id, algo_fk_id, message)
            VALUES ($1, $2, $3, $4)
            RETURNING id, alert_timestamp;
        `;
        const values = [
            this.projectId,
            this.aoiFkId,
            this.algoFkId,
            this.message
        ];
        
        const result: QueryResult<AlertData> = await db.query(query, values);
        this.id = result.rows[0].id;
        this.alertTimestamp = result.rows[0].alert_timestamp;
        return this.id!;
    }

    /**
     * Fetches all alerts associated with a specific project.
     * @param projectId - The ID of the project.
     * @returns An array of AlertModel instances.
     */
    public static async findByProjectId(projectId: number): Promise<AlertModel[]> {
        const query = `SELECT * FROM alerts WHERE project_id = $1 ORDER BY alert_timestamp DESC;`;
        const result: QueryResult<AlertData> = await db.query(query, [projectId]);

        return result.rows.map(row => new AlertModel(row));
    }
    
    /**
     * Counts the total number of alerts for a given user across all their projects.
     * @param userId - The ID of the user.
     * @returns The total count of alerts.
     */
    public static async countAlertsByUserId(userId: string): Promise<number> {
        const query = `
            SELECT COUNT(a.id)
            FROM alerts a
            JOIN users_to_project up ON a.project_id = up.project_id
            WHERE up.user_id = $1;
        `;
        const result: QueryResult<{ count: string }> = await db.query(query, [userId]);
        
        return parseInt(result.rows[0].count, 10);
    }
}


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





//AreaOfInterestModel.ts

import { DBClient } from '../db/DBClient.ts';
import type { GeoJsonPolygon } from '../types/GeoJson.ts'; // We will define this type below

const db = DBClient.getInstance();

export interface AreaOfInterestData {
    id: number;
    project_id: number;
    aoi_id: string;
    name: string;
    geom: string; // Stored as GEOMETRY in DB, handled as GeoJSON string/object here
    auxdata: Record<string, any> | null;
    publish_flag: boolean;
    geom_properties: Record<string, any> | null;
}

/**
 * AreaOfInterestModel: Handles persistence logic for the 'area_of_interest' table.
 */
export class AreaOfInterestModel {
    public id: number | null;
    public projectId: number;
    public aoiId: string;
    public name: string;
    public geomGeoJson: GeoJsonPolygon; // Frontend will pass GeoJSON Polygon object
    public auxData: Record<string, any> | null;
    public publishFlag: boolean;
    public geomProperties: Record<string, any> | null;

    constructor(data: Partial<AreaOfInterestData> & { geomGeoJson?: GeoJsonPolygon, projectId: number }) {
        this.id = data.id || null;
        this.projectId = data.project_id || data.projectId;
        this.aoiId = data.aoi_id || '';
        this.name = data.name || '';
        // NOTE: In a full app, you'd convert DB string representation back to GeoJSON object
        this.geomGeoJson = data.geomGeoJson as GeoJsonPolygon;
        this.auxData = data.auxdata || null;
        this.publishFlag = data.publish_flag ?? true;
        this.geomProperties = data.geom_properties || null;
    }

    /**
     * Saves a single AOI to the database.
     * The geometry is converted from GeoJSON string to PostGIS GEOMETRY.
     */
    public async save(): Promise<number> {
        if (!this.projectId) throw new Error("AOI must be tied to an existing Project.");
        
        const query = `
            INSERT INTO area_of_interest 
            (project_id, aoi_id, name, geom, auxdata, publish_flag, geom_properties)
            VALUES ($1, $2, $3, ST_GeomFromGeoJSON($4), $5, $6, $7)
            RETURNING id;
        `;
        // Convert the GeoJSON object to a string for the PostGIS function
        const geomString = JSON.stringify(this.geomGeoJson);
        
        const values = [
            this.projectId,
            this.aoiId,
            this.name,
            geomString,
            this.auxData,
            this.publishFlag,
            this.geomProperties
        ];
        
        const result = await db.query(query, values);
        this.id = result.rows[0].id;
        return this.id!;
    }
    
    /**
     * Fetches all AOIs for a specific project.
     */
    public static async findByProjectId(projectId: number): Promise<AreaOfInterestModel[]> {
        // NOTE: We use ST_AsGeoJSON to retrieve the geometry in a usable format for the frontend
        const query = `
            SELECT 
                id, project_id, aoi_id, name, auxdata, publish_flag, geom_properties,
                ST_AsGeoJSON(geom) AS geom_geojson_string 
            FROM area_of_interest 
            WHERE project_id = $1;
        `;
        const result = await db.query(query, [projectId]);

        return result.rows.map(row => new AreaOfInterestModel({
            ...row, 
            geomGeoJson: JSON.parse(row.geom_geojson_string), // Parse the GeoJSON string back to object
            project_id: row.project_id // Ensure projectId is passed
        }));
    }

    /**
     * Fetches all mapped algorithms and their configurations for this AOI.
     */
    public async getMappedAlgorithms(client: any): Promise<any[]> {
        const query = `
            SELECT 
                aam.id as mapping_id,
                aam.config_args,
                ac.algo_id,
                ac.description,
                ac.category
            FROM aoi_algorithm_mapping aam
            JOIN algorithm_catalogue ac ON aam.algo_id = ac.id
            WHERE aam.aoi_id = $1;
        `;
        // Use the passed client for transaction context (important for reuse)
        const result = await client.query(query, [this.id]); 
        return result.rows;
    }

    // Add update, delete, and other core methods here... to be completed
}


// ProjectModel.ts

import { DBClient } from '../db/DBClient.ts';
import { AreaOfInterestModel } from './AreaOfInterestModel.ts';

const db = DBClient.getInstance();

export interface ProjectData {
    id: number;
    project_name: string;
    description: string | null;
    creation_date: Date;
    last_modified_date: Date | null;
    created_by_userid: string;
    auxdata: Record<string, any> | null; // For JSONB
}

/**
 * ProjectModel: Handles persistence logic for the 'project' table.
 */
export class ProjectModel {
    // Properties matching the database columns
    public id: number | null;
    public projectName: string;
    public description: string | null;
    public createdByUserId: string;
    public auxData: Record<string, any> | null;
    public creationDate: Date | null;
    public lastModifiedDate: Date | null;

    // Transient data for the 4-step process (Frontend uses a separate form class, 
    // but the backend model can hold related data for transaction processing)
    public aois: AreaOfInterestModel[] = []; 
    // ... other related models like UsersToProject

    constructor(data: Partial<ProjectData>) {
        this.id = data.id || null;
        this.projectName = data.project_name || '';
        this.description = data.description || null;
        this.createdByUserId = data.created_by_userid || '';
        this.auxData = data.auxdata || null;
        this.creationDate = data.creation_date || null;
        this.lastModifiedDate = data.last_modified_date || null;
    }

    /**
     * Saves a new project to the database.
     * @returns The newly created project ID.
     */
    public async save(userId: string): Promise<number> {
        const query = `
            INSERT INTO project 
            (project_name, description, created_by_userid, auxdata)
            VALUES ($1, $2, $3, $4)
            RETURNING id, creation_date;
        `;
        const values = [
            this.projectName, 
            this.description, 
            userId, 
            this.auxData
        ];
        
        const result = await db.query(query, values);
        this.id = result.rows[0].id;
        this.creationDate = result.rows[0].creation_date;
        return this.id!;
    }

    /**
     * Fetches a project by its ID.
     */
    public static async findById(id: number): Promise<ProjectModel | null> {
        const query = `SELECT * FROM project WHERE id = $1;`;
        const result = await db.query<ProjectData>(query, [id]);
        
        if (result.rows.length === 0) return null;
        
        // Map the database row to a ProjectModel instance
        return new ProjectModel(result.rows[0]);
    }

    // Add update, delete, and other core methods here...
}




// backend/src/models/UserModel.ts

import { DBClient } from '../db/DBClient.ts';

const db = DBClient.getInstance();

export interface UserData {
    user_id: string;
    username: string | null;
    password_hash: string | null;
}

/**
 * UserModel: Handles persistence logic for the 'users' table.
 */
export class UserModel {
    public userId: string;
    public username: string | null;
    public passwordHash: string | null;

    constructor(data: UserData) {
        this.userId = data.user_id;
        this.username = data.username || data.user_id;
        // In a real app, the hash should be stored/validated securely
        this.passwordHash = data.password_hash || null; 
    }

    /**
     * Finds a user by their unique user_id.
     */
    public static async findById(userId: string): Promise<UserModel | null> {
        const query = `SELECT user_id, username, password_hash FROM users WHERE user_id = $1;`;
        const result = await db.query<UserData>(query, [userId]);
        
        if (result.rows.length === 0) return null;
        return new UserModel(result.rows[0]);
    }

    /**
     * Inserts a new user into the database (Sign Up).
     */
    public async save(): Promise<UserModel> {
        const query = `
            INSERT INTO users (user_id, username, password_hash)
            VALUES ($1, $2, $3)
            RETURNING user_id, username;
        `;
        // NOTE: We use userId as the user_id for simplicity, and passwordHash is used for the plain text password check for now.
        const values = [this.userId, this.username, this.passwordHash];
        
        const result = await db.query(query, values);
        return new UserModel(result.rows[0]);
    }
}




import { DBClient } from '../db/DBClient.ts';

const db = DBClient.getInstance();

export interface UsersToProjectData {
    id: number;
    user_id: string;
    project_id: number;
    role: 'owner' | 'analyst' | 'viewer' | string; // Define valid roles
}

/**
 * UsersToProjectModel: Handles assigning users to projects with specific roles.
 */
export class UsersToProjectModel {
    public id: number | null;
    public userId: string;
    public projectId: number;
    public role: string;

    constructor(data: Partial<UsersToProjectData>) {
        this.id = data.id || null;
        this.userId = data.user_id!;
        this.projectId = data.project_id!;
        this.role = data.role!;
    }

    /**
     * Saves a user-to-project role assignment.
     */
    public async save(): Promise<number> {
        const query = `
            INSERT INTO users_to_project 
            (user_id, project_id, role)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, project_id) 
            DO UPDATE SET role = EXCLUDED.role 
            RETURNING id;
        `;
        const values = [this.userId, this.projectId, this.role];
        
        const result = await db.query(query, values);
        this.id = result.rows[0].id;
        return this.id!;
    }

    /**
     * Fetches all projects a user is assigned to.
     */
    public static async findProjectsByUserId(userId: string): Promise<UsersToProjectModel[]> {
        const query = `SELECT * FROM users_to_project WHERE user_id = $1;`;
        const result = await db.query<UsersToProjectData>(query, [userId]);
        
        return result.rows.map(row => new UsersToProjectModel(row));
    }
    
    /**
     * Deletes a user-to-project assignment.
     */
    public static async delete(userId: string, projectId: number): Promise<boolean> {
        const query = `DELETE FROM users_to_project WHERE user_id = $1 AND project_id = $2;`;
        const result = await db.query(query, [userId, projectId]);
        return result.rowCount > 0;
    }
}



// backend/src/services/AlertsService.ts

import { AlertModel } from '../models/AlertModel.ts';
import type { AlertData } from '../models/AlertModel.ts';


export interface NewAlertPayload {
    project_id: number;
    aoi_fk_id: number;
    algo_fk_id: number;
    message: Record<string, any>;
}


/**
 * AlertsService: Manages business logic related to alerts.
 */
export class AlertsService {

    /**
     * Records a new alert using the data provided in the API request body.
     * @param payload - The alert data from the incoming API request.
     * @returns The newly created AlertModel instance.
     */
    public async recordNewAlert(payload: NewAlertPayload): Promise<AlertModel> {
        
        // Input validation (basic check)
        if (!payload.project_id || !payload.aoi_fk_id || !payload.algo_fk_id || !payload.message) {
            throw new Error("Missing required fields for alert: project_id, aoi_fk_id, algo_fk_id, or message.");
        }

        // Create an instance of the model
        const newAlert = new AlertModel({
            project_id: payload.project_id,
            aoi_fk_id: payload.aoi_fk_id,
            algo_fk_id: payload.algo_fk_id,
            message: payload.message,
            // 'id' and 'alert_timestamp' are intentionally left out, to be set by .save()
        });

        // Save the alert to the database
        await newAlert.save();

        // Return the complete model instance with the generated ID and timestamp
        return newAlert;
    }
}



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
                        SELECT ST_GeomFromGeoJSON($4) AS geom  -- $4 is GeoJSON string
                    )
                    INSERT INTO area_of_interest 
                    (project_id, aoi_id, name, geom, geom_properties)
                    SELECT 
                        $1, $2, $3, 
                        CASE 
                            WHEN $5 > 0 AND ST_GeometryType(geom) IN ('ST_Point', 'ST_LineString') THEN 
                                -- Apply buffer: Transform to cartesian (3857), buffer by meters ($5), transform back
                                ST_Transform(ST_Buffer(ST_Transform(geom, 3857), $5), 4326)
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



// backend/src/types/GeoJson.ts

/**
 * Defines the GeoJSON Polygon geometry type for use in backend models.
 * Coordinates are [longitude, latitude].
 */
export interface GeoJsonPolygon {
    type: 'Polygon';
    coordinates: number[][][];
    // Optional additional GeoJSON properties could be added here
}

/**
 * A simplified interface for a GeoJSON Feature object.
 */
export interface GeoJsonFeature {
    type: 'Feature';
    geometry: GeoJsonPolygon;
    properties: Record<string, any>;
}



// App.ts

import express from 'express';
import type { Application, Router } from 'express';
import * as dotenv from 'dotenv';
import cors from 'cors';

import { AuthController } from './controllers/AuthController.ts';
import { ProjectController } from './controllers/ProjectController.ts'; // Assuming ProjectController is updated to export a class

import { AlertsController } from './controllers/AlertsController.ts';

/**
 * App Class: The primary object-oriented wrapper for the Express server.
 * Initializes all controllers and middleware.
 */
export class App {
    private app: Application;
    private port: number;

    constructor() {
        dotenv.config();
        this.app = express();
        this.port = parseInt(process.env.PORT || '3000');
        
        this.initializeMiddleware();
        this.initializeControllers();
    }

    private initializeMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
        // Basic check to ensure user ID is present for authorized routes (mock check)
        this.app.use('/api', (req, res, next) => {
             if (req.url !== '/auth/login' && !req.header('X-User-ID')) {
                 // Simulate user authentication by checking a header after login
                 // In a real app, this would be a JWT middleware check
             }
             next();
        });
    }

    private initializeControllers() {
        this.app.get('/api/status', (req, res) => {
            res.json({ message: 'Garuda V1 API is online.' });
        });
        
        // Register Controllers as the official API endpoints
        this.app.use('/api/auth', new AuthController().router);
        this.app.use('/api/projects', new ProjectController().router);
        this.app.use('/api/alerts', new AlertsController().router);
    }

    public start() {
        this.app.listen(this.port, () => {
            console.log(`⚡️ Garuda V1 Server running on http://localhost:${this.port}`);
        });
    }
}



# backend/.env

# Server Configuration
PORT=3000

# Database Configuration (PostgreSQL/PostGIS)
DB_USER=garuda_user
DB_HOST=localhost
DB_DATABASE=garuda_v1_db
DB_PASSWORD=Minar@123  
DB_PORT=5432


