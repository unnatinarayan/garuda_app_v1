<!-- Step4AddUsers.vue -->
<script setup>
import { ProjectFormData } from '@/classes/ProjectFormData.js';
import { ref, computed } from 'vue';

const props = defineProps({
  projectData: ProjectFormData,
});

const newUser = ref('');
const newRole = ref('viewer');
const availableRoles = [ 'analyst', 'viewer'];

const showRoleOptions = ref(false);

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
</script>

<template>
  <div class="p-4 bg-gray-800 rounded-lg text-white">

    <div class="user-entry flex flex-col sm:flex-row gap-3 mb-6 p-4 bg-gray-700 rounded-lg shadow-inner">
        
        <input 
            type="text" 
            v-model="newUser" 
            placeholder="User ID / Email" 
            class="w-full sm:flex-grow p-3 bg-gray-600 text-white rounded border border-gray-500 focus:border-cyan-400"
        />

        <div class="relative z-10 flex gap-3 w-full sm:w-auto">
            
            <div class="relative">
                <button 
                    @click="showRoleOptions = !showRoleOptions" 
                    class="p-3 bg-gray-600 text-white rounded border border-gray-500 hover:bg-gray-500 font-semibold transition duration-150 flex items-center justify-center"
                    style="min-width: 100px;" 
                    aria-haspopup="true"
                    :aria-expanded="showRoleOptions"
                >
                    {{ newRole.charAt(0).toUpperCase() + newRole.slice(1) }}
                </button>

                <div 
                    v-if="showRoleOptions" 
                    class="absolute left-0 mt-1 w-full rounded shadow-lg bg-gray-700 border border-gray-600 z-20 overflow-hidden"
                >
                    <button 
                        v-for="role in availableRoles" 
                        :key="role"
                        @click="selectRole(role)"
                        class="w-full text-left p-2 text-white hover:bg-gray-600 transition duration-100"
                    >
                        {{ role.charAt(0).toUpperCase() + role.slice(1) }}
                    </button>
                </div>
            </div>
            <button 
                @click="addUser" 
                :disabled="!canAddUser"
                class="w-2/3 sm:w-auto px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition duration-150 disabled:bg-gray-500 disabled:cursor-not-allowed flex-grow"
            >
                Add User
            </button>
        </div>
    </div>
    
    <h4 class="text-lg font-semibold text-cyan-400 mb-3">Current Collaborators ({{ projectData.users.length }})</h4>
    <div class="user-list space-y-2 max-h-48 overflow-y-auto pr-2">
        <div 
            v-for="user in projectData.users" 
            :key="user.userId" 
            class="user-item flex justify-between items-center p-3 bg-gray-700 rounded shadow-md border-l-4"
            :class="{'border-green-500': user.role === 'owner', 'border-yellow-500': user.role === 'analyst', 'border-blue-500': user.role === 'viewer'}"
        >
            <span class="font-medium text-white flex flex-col sm:flex-row sm:items-center">
                <span class="truncate max-w-[150px] sm:max-w-none">{{ user.username }}</span> 
                <span class="text-xs px-2 py-0.5 mt-1 sm:mt-0 sm:ml-2 rounded-full"
                      :class="{'bg-green-700 text-green-200': user.role === 'owner', 'bg-yellow-700 text-yellow-200': user.role === 'analyst', 'bg-blue-700 text-blue-200': user.role === 'viewer'}"
                >
                    {{ user.role.charAt(0).toUpperCase() + user.role.slice(1) }}
                </span>
            </span>
            <button v-if="user.userId !== 'current_user_id'" @click="removeUser(user.userId)" 
                    class="remove-btn bg-red-600 hover:bg-red-700 text-white w-6 h-6 flex items-center justify-center rounded-full transition duration-150 flex-shrink-0"
                    title="Remove User"
            >
                &times;
            </button>
        </div>
    </div>
    </div>
</template>
<style scoped>
/* No specific scoped changes needed as Tailwind handles responsiveness */
/* Keeping the scrollbar styles for reference/optional use */
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


