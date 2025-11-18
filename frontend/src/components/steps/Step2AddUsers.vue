<!-- frontend/src/components/steps/Step2AddUsers.vue -->
<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { ApiClient } from '@/api/ApiClient.js';
import { useMessageStore } from '@/stores/MessageStore.js';
import { UserSession } from '@/classes/UserSession.js';
import RoleSelectionPopup from './RoleSelectionPopup.vue';

const props = defineProps({
    projectData: Object,
});

const api = ApiClient.getInstance();
const messageStore = useMessageStore();
const session = UserSession.getInstance();

const newUserId = ref('');
const isChecking = ref(false);
const userError = ref('');

const showPopup = ref(false);
const selectedUser = ref(null);
const availableRoles = ref([]);
const selectedUserRoles = ref([]);

// Check if user can be added
const canAddUser = computed(() => {
    return newUserId.value.trim() !== '' &&
        userError.value === '' &&
        !props.projectData.users.some(u => u.userId === newUserId.value.trim());
});

// Helper to get role name by ID
const getRoleName = (roleId) => {
    const role = availableRoles.value.find(r => r.id === roleId);
    return role ? role.role : `Role ${roleId}`;
};

// Open role popup for a user
const openRolePopup = async (userId) => {
    selectedUser.value = userId;
    try {
        availableRoles.value = await api.getAllRoles();
        // Find existing roles for this user
        const existingUser = props.projectData.users.find(u => u.userId === userId);
        selectedUserRoles.value = existingUser?.roles || [];
        showPopup.value = true;
    } catch (error) {
        console.error('Error loading roles:', error);
        messageStore.showMessage("Failed to load roles.", "error");
    }
};

// Save roles from popup
const saveRoles = (rolesArr) => {
    const idx = props.projectData.users.findIndex(u => u.userId === selectedUser.value);
    if (idx !== -1) {
        props.projectData.users[idx].roles = rolesArr;
        messageStore.showMessage(`Roles updated for "${selectedUser.value}".`, "success");
    }
    showPopup.value = false;
};

// Add user to the list
const addUser = async () => {
    if (!newUserId.value.trim()) {
        messageStore.showMessage("User ID cannot be empty.", "error");
        return;
    }

    const userId = newUserId.value.trim();

    // Check if user already added
    if (props.projectData.users.some(u => u.userId === userId)) {
        messageStore.showMessage("User already added to the project.", "error");
        return;
    }

    // Verify user exists in the system
    isChecking.value = true;
    try {
        const exists = await api.userExists(userId);
        if (!exists) {
            messageStore.showMessage(`User "${userId}" does not exist in the system.`, "error");
            userError.value = "User does not exist.";
            return;
        }

        // Add user with empty roles array
        props.projectData.users.push({
            userId,
            roles: []
        });

        newUserId.value = '';
        userError.value = '';

        // Open role selection popup immediately after adding
        await openRolePopup(userId);

        messageStore.showMessage(`User "${userId}" added successfully.`, "success");
    } catch (error) {
        console.error('Error checking user:', error);
        messageStore.showMessage("Failed to verify user. Please try again.", "error");
    } finally {
        isChecking.value = false;
    }
};

// Remove user from the list
const removeUser = (userId) => {
    // Prevent removing the current user (project creator)
    if (userId === session.userId) {
        messageStore.showMessage("You cannot remove yourself from the project.", "error");
        return;
    }

    props.projectData.users = props.projectData.users.filter(u => u.userId !== userId);
    messageStore.showMessage(`User "${userId}" removed.`, "info");
};

// Real-time user validation
let typingTimer;
watch(newUserId, (val) => {
    userError.value = '';
    clearTimeout(typingTimer);
    if (!val.trim()) return;

    typingTimer = setTimeout(async () => {
        try {
            const exists = await api.userExists(val.trim());
            if (!exists) {
                userError.value = "User does not exist.";
            }
        } catch (error) {
            console.error('Error validating user:', error);
        }
    }, 400);
});

// Add current user if not already in the list (on mount)
onMounted(() => {
    if (!props.projectData.users.some(u => u.userId === session.userId)) {
        props.projectData.users.push({
            userId: session.userId,
            roles: []
        });
    }
});
</script>

<template>
    <div class="h-[68vh] pt-[1vh]">
        <div class="mb-4">
            <h3 class="text-lg font-semibold text-cyan-400 mb-2">Add Project Users</h3>
        </div>

        <!-- Add User Input -->
        <div class="form-group mb-4">
            <div class="flex gap-3">
                <div class="flex-grow">
                    <input type="text" v-model="newUserId" placeholder="Enter user ID" @keyup.enter="addUser"
                        :disabled="isChecking"
                        class="w-full p-3 bg-gray-700 text-white rounded-lg border transition duration-200" :class="{
                            'border-red-500': userError,
                            'border-gray-600 focus:border-cyan-500': !userError
                        }" />
                    <p v-if="userError" class="text-red-400 text-sm mt-1 animate-pulse">
                        {{ userError }}
                    </p>
                </div>
                <button @click="addUser" :disabled="isChecking || !canAddUser"
                    class="px-6 py-3 rounded-lg font-semibold transition duration-200 whitespace-nowrap" :class="{
                        'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer': canAddUser && !isChecking,
                        'bg-gray-600 text-gray-400 cursor-not-allowed': !canAddUser || isChecking
                    }">
                    {{ isChecking ? 'Checking...' : 'Add User' }}
                </button>
            </div>
        </div>

        <!-- User List -->
        <div class="user-list max-h-[50vh] overflow-y-auto">
            <h4 class="text-md font-semibold text-cyan-400 mb-3">
                Project Users ({{ projectData.users.length }})
            </h4>

            <div v-if="projectData.users.length === 0" class="text-center text-gray-400 p-8">
                <svg class="w-16 h-16 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p>No users added yet</p>
                <p class="text-sm mt-2">Add users who will receive alerts from this project</p>
            </div>

            <div v-else class="space-y-2">
                <div v-for="(user, index) in projectData.users" :key="user.userId"
                    class="flex justify-between items-center p-3 rounded-lg border transition" :class="{
                        'bg-green-900/30 border-green-600': user.userId === session.userId,
                        'bg-gray-700 border-gray-600 hover:border-cyan-500': user.userId !== session.userId
                    }">
                    <div class="flex items-center flex-grow">
                        <span class="text-white font-mono bg-gray-800 px-2 py-1 rounded mr-3 text-sm">
                            {{ index + 1 }}
                        </span>
                        <div class="flex flex-col gap-1">
                            <div class="flex items-center gap-2">
                                <span class="text-white font-medium">{{ user.userId }}</span>
                                <span v-if="user.userId === session.userId"
                                    class="text-xs px-2 py-0.5 bg-green-600 text-white rounded-full">
                                    You
                                </span>
                            </div>
                            <!-- Display assigned roles -->
                            <div v-if="user.roles && user.roles.length > 0" class="flex gap-1 flex-wrap">
                                <span v-for="roleId in user.roles" :key="roleId"
                                    class="text-xs px-2 py-0.5 bg-cyan-900/50 text-cyan-300 rounded">
                                    {{ getRoleName(roleId) }}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div class="flex items-center gap-2">
                        <!-- Role assignment button -->
                        <button v-if="user.userId !== session.userId" @click="openRolePopup(user.userId)"
                            class="text-cyan-400 hover:text-cyan-300 p-2 rounded hover:bg-cyan-900/30 transition"
                            title="Assign roles">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                            </svg>
                        </button>

                        <!-- Remove button (not for current user) -->
                        <button v-if="user.userId !== session.userId" @click="removeUser(user.userId)"
                            class="text-red-400 hover:text-red-300 p-2 rounded hover:bg-red-900/30 transition"
                            title="Remove user">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        <span v-else class="text-green-400 text-sm ml-2">
                            (Owner)
                        </span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Role Selection Popup -->
        <RoleSelectionPopup v-if="showPopup" :userId="selectedUser" :roles="availableRoles"
            :preselected="selectedUserRoles" @save="saveRoles" @close="() => showPopup = false" />
    </div>
</template>

<style scoped>
.user-list::-webkit-scrollbar {
    width: 8px;
}

.user-list::-webkit-scrollbar-track {
    background: #374151;
    border-radius: 4px;
}

.user-list::-webkit-scrollbar-thumb {
    background: #4B5563;
    border-radius: 4px;
}

.user-list::-webkit-scrollbar-thumb:hover {
    background: #6B7280;
}
</style>