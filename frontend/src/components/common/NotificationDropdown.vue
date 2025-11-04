<script setup>
import { ref, computed } from 'vue';
import { useProjectStore } from '@/stores/ProjectStore.js';
import { useRouter } from 'vue-router';

const projectStore = useProjectStore();
const router = useRouter();

// UI State
const isDropdownOpen = ref(false);

// Computed: Alerts list from the store (newest first by default due to lPush/unshift)
const alerts = computed(() => projectStore.activeAlerts);
const totalAlerts = computed(() => projectStore.totalAlerts);

// Toggle the dropdown visibility
const toggleDropdown = () => {
    isDropdownOpen.value = !isDropdownOpen.value;
};

/**
 * Handles marking an alert as read and removing it from Redis and the local store.
 * @param {Object} alert The alert object to mark as read.
 */
const markAsRead = async (alert) => {
    try {
        // Optimistic update: remove locally right away for speed
        projectStore.activeAlerts = projectStore.activeAlerts.filter(a => a.id !== alert.id);
        
        // Call the store action to inform the backend/Redis
        await projectStore.markAlertAsRead(alert.id);

    } catch (error) {
        console.error("Failed to mark alert as read:", error);
        // NOTE: A more robust application would re-add the alert to the local store if this fails.
    }
};

/**
 * Handles the full click action on an alert (mark read and potentially navigate).
 * @param {Object} alert
 */
const handleAlertClick = (alert) => {
    // 1. Mark as read immediately
    markAsRead(alert);

    // 2. Optional: Navigate the user to the relevant project page
    // Assuming alert.projectId is the key to monitor view
    if (alert.projectId) {
        router.push({ name: 'monitor-map', params: { id: alert.projectId } });
        isDropdownOpen.value = false; // Close dropdown after navigation
    }
};

</script>

<template>
    <div class="notification-container relative inline-block">
        
        <button 
            @click="toggleDropdown" 
            class="relative p-2 transition-colors duration-200" 
            :class="{'text-white': totalAlerts > 0, 'text-gray-400': totalAlerts === 0}"
            title="View Notifications"
            style="color: var(--text-muted);"
        >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
            
            <span v-if="totalAlerts > 0" 
                  class="absolute top-1 right-1 bg-red-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-pulse"
            >
                {{ totalAlerts > 99 ? '99+' : totalAlerts }}
            </span>
        </button>

        <div v-if="isDropdownOpen" 
             class="absolute right-0 mt-3 w-80 bg-gray-700 rounded-lg shadow-xl z-30 ring-1 ring-black ring-opacity-5"
        >
            <div class="p-3 border-b border-gray-600">
                <h3 class="text-lg font-semibold text-white">Alerts ({{ totalAlerts }})</h3>
            </div>
            
            <div class="max-h-80 overflow-y-auto">
                <div v-if="totalAlerts === 0" class="p-4 text-gray-400 text-center">
                    No new alerts.
                </div>
                
                <div v-for="alert in alerts" :key="alert.id"
                     @click="handleAlertClick(alert)"
                     class="p-3 border-b border-gray-600 cursor-pointer hover:bg-gray-600 transition duration-150"
                >
                    <div class="flex items-center justify-between">
                        <div class="truncate pr-4">
                            <p class="text-sm font-semibold text-cyan-400 truncate">{{ alert.title }}</p>
                            <p class="text-xs text-white">{{ alert.message.detail || alert.message }}</p>
                            <p class="text-xs text-gray-400 mt-1">
                                Project: {{ alert.projectId }} | {{ new Date(alert.timestamp).toLocaleTimeString() }}
                            </p>
                        </div>
                        
                        <button @click.stop="markAsRead(alert)" 
                                class="text-red-400 hover:text-red-300 ml-2 p-1 rounded-full"
                                title="Dismiss Alert"
                        >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    </div>
                </div>
            </div>
            
            <div class="p-2 text-center text-xs text-gray-400 border-t border-gray-600">
                <a @click="isDropdownOpen = false" class="cursor-pointer hover:text-white">Close</a>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* Scoped styles can be added here if Tailwind utility classes are insufficient */
.notification-container {
    /* Ensure proper context for absolute positioning */
}
</style>
