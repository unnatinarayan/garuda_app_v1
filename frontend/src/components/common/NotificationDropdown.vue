<!-- NotificationDropdown.vue -->
<script setup>
import { ref, computed } from 'vue';
import { useProjectStore } from '@/stores/ProjectStore.js';
import { useRouter } from 'vue-router';

const projectStore = useProjectStore();
const router = useRouter();

// UI State
const isDropdownOpen = ref(false);
const expandedAlertIds = ref([]);

// Computed: Alerts list from the store (newest first by default due to lPush/unshift)
const alerts = computed(() => projectStore.activeAlerts);
const totalAlerts = computed(() => projectStore.totalAlerts);

// Toggle the dropdown visibility
const toggleDropdown = () => {
    isDropdownOpen.value = !isDropdownOpen.value;
};

const toggleExpand = (alertId) => {
    const index = expandedAlertIds.value.indexOf(alertId);
    if (index === -1) {
        expandedAlertIds.value.push(alertId);
    } else {
        expandedAlertIds.value.splice(index, 1);
    }
};

/**
 * Handles marking an alert as read and removing it from Redis and the local store.
 * @param {Object} alert The alert object to mark as read.
 */



// NotificationDropdown.vue

const markAsRead = async (alert) => {
    // 1. Store a temporary reference of the alert we are removing
    const alertToRevert = alert;

    // 2. Optimistic Update (Remove locally)
    projectStore.activeAlerts = projectStore.activeAlerts.filter(a => a.id !== alert.id);

    try {
        // 3. Call the store action, which handles the API call and Redis deletion
        await projectStore.markAlertAsRead(alert.id);
        // Success: Alert is permanently gone from this user's Redis cache.

    } catch (error) {
        console.error("Failed to mark alert as read on server:", error);


        // If the store action fails, it's safer to re-fetch/reload the list, but for a simple fix:
        if (!projectStore.activeAlerts.some(a => a.id === alertToRevert.id)) {
            // Re-add only if it's not somehow back in the list
            projectStore.activeAlerts.unshift(alertToRevert);
            // Note: This relies on the alert structure being available locally.
        }
    }
};


/**
 * Handles navigation when the main text area is clicked.
 * @param {Object} alert
 */
const handleNavigationClick = (alert) => {
    if (alert.projectId) {
        router.push({ name: 'monitor-map', params: { id: alert.projectId } });
        isDropdownOpen.value = false; // Close dropdown after navigation
    }
};

/**
 * Handles the full click action on an alert (mark read and potentially navigate).
 * @param {Object} alert
 */
const handleAlertClick = (alert) => {
    markAsRead(alert);

    if (alert.projectId) {
        router.push({ name: 'monitor-map', params: { id: alert.projectId } });
        isDropdownOpen.value = false; // Close dropdown after navigation
    }
};
const normalizeMessage = (msg) => {
  if (!msg) return {};

  // If already parsed JSON object
  if (typeof msg === 'object') return msg;

  // If it's a JSON string, try parsing:
  try {
    return JSON.parse(msg);
  } catch {
    return { message: msg }; // fallback to show raw string
  }
};

const formatMessage = (msg) => {
  const data = normalizeMessage(msg);

  return Object.entries(data).map(([key, value]) => ({
    key,
    value: typeof value === 'object' ? JSON.stringify(value, null, 2) : value
  }));
};

</script>

<template class="z-[20000] !important">
    <div class="notification-container z-[200] relative inline-block">

        <button @click="toggleDropdown" class="relative transition-colors duration-200 px-2 py-1 z-[2000] rounded-full"
            :class="{ 'text-white': totalAlerts > 0, 'text-gray-400': totalAlerts === 0 }" title="View Notifications"
            style="color: var(--text-muted); background-color: #0f172a;">
            <svg class="w-[4vh] h-[4vh]" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9">
                </path>
            </svg>

            <span v-if="totalAlerts > 0"
                class="absolute top-1 right-1 bg-red-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
                {{ totalAlerts > 99 ? '99+' : totalAlerts }}
            </span>
        </button>

        <div v-if="isDropdownOpen" class="absolute mt-3 bg-gray-700 rounded-lg shadow-xl z-[3000] ring-1 ring-black ring-opacity-5 
                    w-72 sm:w-80 right-0 max-w-[calc(100vw-20px)]">
            <div class="p-3 border-b border-gray-600">
                <h3 class="text-lg font-semibold text-white">Alerts</h3>
            </div>

            <div class="max-h-80 overflow-y-auto">
                <div v-if="totalAlerts === 0" class="p-4 text-gray-400 text-center">
                    No new alerts.
                </div>

                <div v-for="alert in alerts" :key="alert.id"
                    class="flex flex-col border-b border-gray-600 transition duration-150">
                    <div class="flex items-start justify-between p-3">

                        <div @click="handleNavigationClick(alert)" class="flex-grow pr-3 cursor-pointer">
                            <p class="text-sm font-bold text-cyan-100 break-words">
                                {{ alert.project_name || alert.projectId }}: {{ alert.aoi_name || alert.aoiId }} has an
                                Alert for {{ alert.algoId }}
                            </p>
                            <p class="text-xs text-start text-gray-500 mt-1 ">
                                {{ new Date(alert.timestamp).toLocaleTimeString() }} {{ new
                                    Date(alert.timestamp).toLocaleDateString() }}
                            </p>
                        </div>


                        <div class="flex flex-col space-y-2 items-center flex-shrink-0">
                            <button @click.stop="markAsRead(alert)"
                                class="text-red-400 hover:text-red-300 p-1 rounded-full w-6 h-6 flex items-center justify-center"
                                title="Dismiss Alert">
                                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                    xmlns="http://www.w3.org/2000/svg">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                        d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>

                            <button @click.stop="toggleExpand(alert.id)"
                                class="text-gray-400 hover:text-white p-1 rounded-full w-6 h-6 flex items-center justify-center transition duration-200"
                                :title="expandedAlertIds.includes(alert.id) ? 'Collapse Details' : 'Expand Details'">
                                <svg class="w-4 h-4 transition-transform duration-200"
                                    :class="{ 'rotate-180': expandedAlertIds.includes(alert.id) }" fill="none"
                                    stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                        d="M19 9l-7 7-7-7"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div v-if="expandedAlertIds.includes(alert.id)"
    class="p-3 pt-0 bg-gray-600/50 text-white border-t border-gray-600">

  <p class="text-xs font-semibold mb-1 text-cyan-200">Alert Details:</p>

  <div class="max-h-40 overflow-y-auto space-y-1 p-2 bg-gray-700 rounded">
    <div
  v-for="{ key, value } in formatMessage(alert.message)"
  :key="key"
  class="text-xs leading-tight"
>
  <span class="font-semibold text-cyan-300">{{ key }}:</span>
  <span class="text-gray-200 break-words ml-1">{{ value }}</span>
</div>
  </div>
</div>



                    
                </div>
            </div>

            <div class="p-2 text-center text-xs text-gray-400 border-t border-gray-600">
                <a @click="isDropdownOpen = false" class="cursor-pointer hover:text-white">Close</a>
            </div>
        </div>
    </div>
</template>
