<!-- frontend/src/components/steps/Step4AddUsers.vue -->
<script setup>
import { ProjectFormData } from '@/classes/ProjectFormData.js';
import { ref, computed, watch } from 'vue';
import { ApiClient } from '@/api/ApiClient.js';
const api = ApiClient.getInstance();

const props = defineProps({
    projectData: ProjectFormData,
});

const newUser = ref('');
const newRole = ref('viewer');
const availableRoles = ['analyst', 'viewer'];
const userError = ref('');

const showRoleOptions = ref(false);

const canAddUser = computed(() => {
    return newUser.value.trim() !== '' &&
        userError.value === '' &&
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

const selectRole = (role) => {
    newRole.value = role;
    showRoleOptions.value = false; // Close the dropdown after selection
};

const removeUser = (userId) => {
    // Prevent removing the initial creator (simulated)
    if (userId === 'current_user_id') {
        alert("The creator cannot be removed.");
        return;
    }
    props.projectData.users = props.projectData.users.filter(u => u.userId !== userId);
};

let typingTimer;
watch(newUser, (val) => {
    userError.value = '';
    clearTimeout(typingTimer);
    if (!val.trim()) return;

    typingTimer = setTimeout(async () => {
        const exists = await api.userExists(val.trim());
        if (!exists) {
            userError.value = "User does not exist.";
        }
    }, 400);
});
</script>

<template>
    <div class="p-4 bg-gray-900 h-[70vh] rounded-xl text-white shadow-2xl">


        <div
            class="user-entry flex flex-col lg:flex-row gap-4 mb-8 p-5 bg-gray-800 rounded-xl shadow-lg border border-gray-700">

            <div class="flex-grow">
                <input type="text" v-model="newUser" placeholder="Enter User ID"
                    class="w-full p-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 placeholder:text-gray-400 transition duration-200" />
                <p v-if="userError" class="text-red-400 text-sm font-medium mt-2 animate-pulse">{{ userError }}</p>
            </div>



            <div class="relative z-10 flex gap-4 w-full lg:w-2/5">

                <div class="relative w-1/2 lg:w-auto flex-shrink-0">
                    <button @click="showRoleOptions = !showRoleOptions"
                        class="w-full p-3 bg-gray-700 text-white rounded-lg border border-gray-600 hover:bg-gray-600 font-semibold transition duration-150 flex items-center justify-between"
                        style="min-width: 120px;" aria-haspopup="true" :aria-expanded="showRoleOptions">
                        {{ newRole.charAt(0).toUpperCase() + newRole.slice(1) }}
                        <span class="ml-2 font-bold">{{ showRoleOptions ? '^' : 'v' }}</span>
                    </button>

                    <div v-if="showRoleOptions"
                        class="absolute left-0 mt-1 w-full rounded-lg shadow-2xl bg-gray-800 border border-indigo-500 z-20 overflow-hidden">
                        <button v-for="role in availableRoles" :key="role" @click="selectRole(role)"
                            class="w-full text-left p-2 text-white hover:bg-indigo-600 transition duration-100 font-medium">
                            {{ role.charAt(0).toUpperCase() + role.slice(1) }}
                        </button>
                    </div>
                </div>
                <button @click="addUser" :disabled="!canAddUser"
                    class="w-1/2 lg:w-auto px-4 py-3 text-white rounded-lg font-bold transition duration-200 flex-grow"
                    :style="{ 'background-color': canAddUser ? '#10B981 !important' : '#4B5563 !important' }"
                    :class="{ 'hover:bg-emerald-600': canAddUser, 'disabled:cursor-not-allowed': !canAddUser }">
                    Add User
                </button>
            </div>
        </div>

        <h4 class="text-xl font-bold text-green-400 mb-4 border-b border-gray-700 pb-2">Current Collaborators ({{
            projectData.users.length }})</h4>
        <div class="user-list space-y-3 max-h-40 lg:max-h-56 overflow-y-auto pr-3">
            <div v-for="user in projectData.users" :key="user.userId"
                class="user-item flex justify-between items-center p-4 bg-gray-800 rounded-lg shadow-xl border-l-4 transition duration-200 hover:bg-gray-700"
                :class="{
                    'border-green-500': user.role === 'owner',
                    'border-yellow-500': user.role === 'analyst',
                    'border-cyan-500': user.role === 'viewer'
                }">
                <span class="font-medium text-white flex flex-col sm:flex-row sm:items-center">
                    <span class="truncate max-w-[150px] sm:max-w-none text-lg">{{ user.username }}</span>
                    <span class="text-xs px-3 py-1 mt-1 sm:mt-0 sm:ml-4 rounded-full font-semibold" :class="{
                        'bg-green-800 text-green-300': user.role === 'owner',
                        'bg-yellow-800 text-yellow-300': user.role === 'analyst',
                        'bg-cyan-800 text-cyan-300': user.role === 'viewer'
                    }">
                        {{ user.role.charAt(0).toUpperCase() + user.role.slice(1) }}
                    </span>
                </span>
                <button v-if="user.userId !== 'current_user_id' && user.role != 'owner'"
                    @click="removeUser(user.userId)"
                    class="remove-btn bg-red-600 hover:bg-red-700 text-white px-2 flex items-center justify-center rounded-full transition duration-150 flex-shrink-0 shadow-md"
                    title="Remove User" style="background-color: red !important;">
                    Remove
                </button>
            </div>
        </div>
    </div>
</template>
<style scoped>
.user-list::-webkit-scrollbar {
    width: 8px;
}

.user-list::-webkit-scrollbar-thumb {
    background-color: #6B7280;
    /* Gray-500 */
    border-radius: 4px;
}

.user-list::-webkit-scrollbar-track {
    background-color: #374151;
    /* Gray-700 */
}
</style>