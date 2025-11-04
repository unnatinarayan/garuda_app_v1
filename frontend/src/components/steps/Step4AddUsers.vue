<script setup>
// REMOVED: import { ProjectFormData } from '@/classes/ProjectFormData.js';
import { ProjectFormData } from '@/classes/ProjectFormData.js';
import { ref, computed } from 'vue';

const props = defineProps({
  projectData: ProjectFormData,
});

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

const removeUser = (userId) => { // REMOVED: : string
    // Prevent removing the initial creator (simulated)
    if (userId === 'current_user_id') {
        alert("The creator cannot be removed.");
        return;
    }
    props.projectData.users = props.projectData.users.filter(u => u.userId !== userId);
};
</script>

<template>
  <div class="p-4 bg-gray-800 rounded-lg text-white">
    <h3 class="text-xl font-bold mb-4 text-white">Step 4: Add Users and Roles</h3>

    <div class="user-entry flex gap-3 mb-6 p-4 bg-gray-700 rounded-lg shadow-inner">
        <input 
            type="text" 
            v-model="newUser" 
            placeholder="User ID / Email" 
            class="flex-grow p-2 bg-gray-600 text-white rounded border border-gray-500 focus:border-cyan-400"
        />
        <select 
            v-model="newRole" 
            class="p-2 bg-gray-600 text-white rounded border border-gray-500"
        >
            <option v-for="role in availableRoles" :key="role" :value="role">{{ role.charAt(0).toUpperCase() + role.slice(1) }}</option>
        </select>
        <button 
            @click="addUser" 
            :disabled="!canAddUser"
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition duration-150 disabled:bg-gray-500 disabled:cursor-not-allowed"
        >
            Add User
        </button>
    </div>
    
    <h4 class="text-lg font-semibold text-cyan-400 mb-3">Current Collaborators ({{ projectData.users.length }})</h4>
    <div class="user-list space-y-2 max-h-48 overflow-y-auto pr-2">
        <div v-for="user in projectData.users" :key="user.userId" class="user-item flex justify-between items-center p-3 bg-gray-700 rounded shadow-md border-l-4"
             :class="{'border-green-500': user.role === 'owner', 'border-yellow-500': user.role === 'analyst', 'border-blue-500': user.role === 'viewer'}"
        >
            <span class="font-medium text-white">{{ user.username }} 
                <span class="text-sm px-2 py-0.5 rounded-full"
                      :class="{'bg-green-700 text-green-200': user.role === 'owner', 'bg-yellow-700 text-yellow-200': user.role === 'analyst', 'bg-blue-700 text-blue-200': user.role === 'viewer'}"
                >
                    {{ user.role.charAt(0).toUpperCase() + user.role.slice(1) }}
                </span>
            </span>
            <button v-if="user.userId !== 'current_user_id'" @click="removeUser(user.userId)" 
                    class="remove-btn bg-red-600 hover:bg-red-700 text-white w-6 h-6 flex items-center justify-center rounded-full transition duration-150"
                    title="Remove User"
            >
                &times;
            </button>
            <span v-else class="owner-tag font-semibold text-green-400">Project Creator</span>
        </div>
    </div>
  </div>
</template>

<style scoped>
/* Scoped styles have been updated to complement Tailwind classes */

.user-list::-webkit-scrollbar {
  width: 8px;
}
.user-list::-webkit-scrollbar-thumb {
  background-color: #4b5563; /* Gray-600 */
  border-radius: 4px;
}
.user-list::-webkit-scrollbar-track {
  background-color: #374151; /* Gray-700 */
}
</style>
