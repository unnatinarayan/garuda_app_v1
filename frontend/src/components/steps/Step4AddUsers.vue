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

<style scoped>
.user-entry { display: flex; gap: 10px; margin-bottom: 20px; }
.user-entry input { flex-grow: 2; padding: 8px; }
.user-entry select { flex-grow: 1; padding: 8px; }
.user-item { display: flex; justify-content: space-between; padding: 8px; border-bottom: 1px dotted #eee; align-items: center; }
.owner-tag { font-weight: bold; color: green; }
</style>