<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { ApiClient } from '@/api/ApiClient.js';
import { useMessageStore } from '@/stores/MessageStore.js';
import { useProjectStore } from '@/stores/ProjectStore.js';
import CustomSelect from '@/components/common/CustomSelect.vue'; // Retained for AOI selection, but removed from modal as per UX change

const props = defineProps({
    projectData: Object,
});

// --- State for Filters (Used on Main Active Subscriptions List) ---
const filterAoi = ref("all");
const filterChannel = ref("all");
const filterUser = ref("all");

// --- State for Modal (New Subscription Inputs) ---
const showAddSubscriptionModal = ref(false); // Controls the new "Add Subscription" modal
const selectedAOIForAdd = ref(null);
const selectedChannelForAdd = ref(null);
const selectedUsersForAdd = ref([]);

const api = ApiClient.getInstance();
const messageStore = useMessageStore();
const projectStore = useProjectStore();

const alertChannels = ref([]);
const loadingChannels = ref(false);
const error = ref(null);

// Automatically set the filter AOI to the currently selected AOI for adding, if any
watch(selectedAOIForAdd, (newAoi) => {
    if (newAoi) {
        filterAoi.value = newAoi.clientAoiId;
    }
});


const availableUsers = computed(() =>
    props.projectData.users.map(user =>
        typeof user === 'object' ? user.userId : user
    )
);

// Get AOI name from clientAoiId
const getAoiName = (clientAoiId) => {
    const aoi = props.projectData.aoiDrafts.find(a => a.clientAoiId === clientAoiId);
    return aoi ? aoi.name : `AOI ${clientAoiId}`;
};

const allProjectSubscriptions = computed(() => {
    // Subscriptions with status 0 (soft-deleted/inactive) and 1 (active)
    return props.projectData.subscriptions.filter(sub => sub.status !== 2);
});

// Get existing subscriptions for selected AOI in modal (Active or Inactive)
const allAoiSubscriptionsForAdd = computed(() => {
    if (!selectedAOIForAdd.value) return [];
    return props.projectData.getSubscriptionsForAoi(selectedAOIForAdd.value.clientAoiId, true);
});


// Filter for channels that are currently active (status = 1) for the *selected AOI in the modal*
const subscribedChannelIdsForAdd = computed(() => {
    return new Set(allAoiSubscriptionsForAdd.value.filter(sub => sub.status === 1).map(sub => sub.channelId));
});

// Filter out currently active channels for the *selected AOI in the modal*
const availableChannelsForAdd = computed(() => {
    return alertChannels.value.filter(ch => !subscribedChannelIdsForAdd.value.has(ch.id));
});

// Group available channels by category for the modal dropdown
const groupedAvailableChannelsForAdd = computed(() => {
    const groups = {};
    availableChannelsForAdd.value.forEach(channel => {
        if (!groups[channel.category]) {
            groups[channel.category] = [];
        }
        groups[channel.category].push(channel);
    });
    return groups;
});


// --- Logic for Main Component List (Active Subscriptions) ---

const filteredAndGroupedSubscriptions = computed(() => {
    let subs = props.projectData.subscriptions.filter(s => s.status !== 2); // Status 0 or 1

    // Apply AOI Filter
    if (filterAoi.value !== 'all') {
        subs = subs.filter(s => s.clientAoiId === filterAoi.value);
    }

    // Apply Channel Filter
    if (filterChannel.value !== 'all') {
        subs = subs.filter(s => s.channelId === parseInt(filterChannel.value));
    }

    // Apply User Filter
    if (filterUser.value !== 'all') {
        subs = subs.filter(s => s.userIds.includes(filterUser.value));
    }

    // Group by AOI
    const groups = {};

    subs.forEach(sub => {
        const name = getAoiName(sub.clientAoiId);
        if (!groups[name]) groups[name] = [];
        groups[name].push(sub);
    });

    return groups;
});

onMounted(async () => {
    loadingChannels.value = true;
    try {
        const channels = await api.getAlertChannelCatalogue();
        alertChannels.value = channels;

        // Auto-select first AOI for the ADD MODAL if available
        if (props.projectData.aoiDrafts.length > 0) {
            const firstAoi = props.projectData.aoiDrafts.filter(a => a.status !== 2)[0];
            selectedAOIForAdd.value = firstAoi;
            filterAoi.value = firstAoi.clientAoiId; // Also set the default filter
        }
    } catch (e) {
        error.value = "Failed to load alert channels.";
        console.error("Load Channels Error:", e);
    } finally {
        loadingChannels.value = false;
    }
});

// The core logic for saving the subscription, now triggered by the modal's save button
const saveSubscriptionFromModal = () => {
    if (!selectedAOIForAdd.value || !selectedChannelForAdd.value || selectedUsersForAdd.value.length === 0) {
        messageStore.showMessage("Please select AOI, channel, and at least one user.", "error");
        return;
    }

    if (selectedChannelForAdd.value.isHeader) {
        messageStore.showMessage("Please select a specific channel, not a category header.", "error");
        selectedChannelForAdd.value = null;
        return;
    }

    const existingSoftDeleted = allAoiSubscriptionsForAdd.value.find(
        sub => sub.channelId === selectedChannelForAdd.value.id && sub.status === 0
    );

    if (existingSoftDeleted) {
        props.projectData.addOrUpdateSubscription(
            selectedAOIForAdd.value.clientAoiId,
            selectedChannelForAdd.value.id,
            [...selectedUsersForAdd.value],
            existingSoftDeleted.subscriptionId
        );
        messageStore.showMessage(
            `Subscription **reactivated** for ${selectedChannelForAdd.value.channel_name}.`,
            "success"
        );
    } else {
        props.projectData.addOrUpdateSubscription(
            selectedAOIForAdd.value.clientAoiId,
            selectedChannelForAdd.value.id,
            [...selectedUsersForAdd.value]
        );
        messageStore.showMessage(
            `Subscription added: ${selectedChannelForAdd.value.channel_name} for ${selectedUsersForAdd.value.length} user(s).`,
            "success"
        );
    }

    // Reset modal state and close modal
    // Note: selectedAOIForAdd is NOT reset to maintain context if user wants to add another
    selectedChannelForAdd.value = null;
    selectedUsersForAdd.value = [];
    showAddSubscriptionModal.value = false;
};

const toggleSubscriptionStatus = (subscription) => {
    if (subscription.status === 1) {
        props.projectData.softDeleteSubscription(subscription);
        messageStore.showMessage("Subscription marked as **Inactive** (soft delete).", "info");
    } else if (subscription.status === 0) {
        props.projectData.addOrUpdateSubscription(
            subscription.clientAoiId,
            subscription.channelId,
            subscription.userIds,
            subscription.subscriptionId
        );
        messageStore.showMessage("Subscription **reactivated**.", "success");
    }
};

// Available AOIs (non-deleted)
const availableAOIs = computed(() =>
    props.projectData.aoiDrafts.filter(aoi => aoi.status !== 2)
);

// Get channel name by ID
const getChannelName = (channelId) => {
    const channel = alertChannels.value.find(c => c.id === channelId);
    return channel ? channel.channel_name : `Channel ${channelId}`;
};

// Get channel category by ID
const getChannelCategory = (channelId) => {
    const channel = alertChannels.value.find(c => c.id === channelId);
    return channel ? channel.category : 'Unknown';
};

// Get category icon/emoji
const getCategoryIcon = (category) => {
    const icons = {
        'Email': '📧',
        'SMS': '📱',
        'WhatsApp': '💬',
        'Webhook': '🔗',
        'Push Notification': '🔔',
        'Slack': '💼'
    };
    return icons[category] || '📢';
};

// Reset selected channel and users when AOI changes in the modal
const handleAoiChangeInModal = () => {
    selectedChannelForAdd.value = null;
    selectedUsersForAdd.value = [];
};

// Filter options for the main component's channel filter
const channelFilterOptions = computed(() => {
    return [{ id: 'all', channel_name: 'All Channels' }, ...alertChannels.value];
});

// Filter options for the main component's AOI filter
const aoiFilterOptions = computed(() => {
    return [{ clientAoiId: 'all', name: 'All AOIs' }, ...availableAOIs.value];
});

// Filter options for the main component's user filter
const userFilterOptions = computed(() => {
    return ['all', ...availableUsers.value];
});

</script>

<template>
    <div class="h-[70vh] flex flex-col relative">
        <div v-if="availableAOIs.length === 0"
            class="bg-red-900/50 border border-red-600 p-3 rounded-lg text-white mb-3 flex-shrink-0">
            <p class="font-semibold">⚠️ No AOIs Available</p>
            <p class="text-sm mt-1">You must define at least one AOI in Step 3 before configuring subscriptions.</p>
        </div>

        <div v-else-if="availableUsers.length === 0"
            class="bg-red-900/50 border border-red-600 p-3 rounded-lg text-white mb-3 flex-shrink-0">
            <p class="font-semibold">⚠️ No Users Available</p>
            <p class="text-sm mt-1">You must add at least one user in Step 2 before configuring subscriptions.</p>
        </div>

        <div v-else class="flex flex-col h-full min-h-0">

            <div class="bg-gray-800 p-3 rounded-lg mb-3 flex flex-col h-[11vh] justify-between items-center">
                <h2 class="text-[2vh] font-bold text-cyan-400">Project Subscriptions</h2>
                <button @click="showAddSubscriptionModal = true"
                    class="flex items-center h-[4.4vh] px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[4vh] font-semibold transition duration-150 shadow-md disabled:bg-gray-600 disabled:cursor-not-allowed"
                    :disabled="availableAOIs.length === 0 || availableUsers.length === 0"
                    title="Add a new subscription">
                    <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M12 4v16m8-8H4" />
                    </svg>
                    Add New Subscription
                </button>
            </div>

            <div class="flex-grow flex flex-col min-h-0 gap-3">

                <div class="px-2">
                    <!-- <h4 class="text-gray-300 font-semibold  text-base">Filter Subscriptions:</h4> -->
                    <div class="grid grid-cols-3 gap-3">
                        <select v-model="filterAoi"
                            class="bg-gray-700 text-gray-200 p-1 rounded-lg border border-gray-600 text-sm">
                            <option value="all">All AOIs ({{ availableAOIs.length }})</option>
                            <option v-for="aoi in availableAOIs" :key="aoi.clientAoiId"
                                :value="aoi.clientAoiId">
                                {{ aoi.name }}
                            </option>
                        </select>

                        <select v-model="filterChannel"
                            class="bg-gray-700 text-gray-200 p-2 rounded-lg border border-gray-600 text-sm">
                            <option value="all">All Channels ({{ alertChannels.length }})</option>
                            <option v-for="ch in alertChannels" :key="ch.id" :value="ch.id">
                                {{ ch.channel_name }}
                            </option>
                        </select>

                        <select v-model="filterUser"
                            class="bg-gray-700 text-gray-200 p-2 rounded-lg border border-gray-600 text-sm">
                            <option value="all">All Users ({{ availableUsers.length }})</option>
                            <option v-for="u in availableUsers" :key="u" :value="u">
                                {{ u }}
                            </option>
                        </select>
                    </div>
                </div>

                <div class="flex-grow min-h-0 overflow-y-auto space-y-4 p-1">
                    <div v-if="allProjectSubscriptions.length === 0" class="text-center text-gray-400 py-6">
                        <p class="text-base">No subscriptions configured yet.</p>
                        <p class="text-sm mt-1">Click Add Subscription to begin.</p>
                    </div>

                    <div v-else-if="Object.keys(filteredAndGroupedSubscriptions).length === 0"
                        class="text-center text-gray-400 py-6">
                        <p class="text-base">No subscriptions match the current filter criteria.</p>
                    </div>

                    <div v-for="(subs, aoiName) in filteredAndGroupedSubscriptions" :key="aoiName"
                        class="bg-gray-800 border border-gray-700 rounded-lg pt-1 h-[47vh] overflow-y-auto p-3">

                        <h3 class="text-cyan-300 font-semibold mb-2 text-sm">
                            📍 {{ aoiName }} ({{ subs.length }})
                        </h3>

                        <div class="space-y-2">
                            <div v-for="sub in subs"
                                :key="`${sub.clientAoiId}-${sub.channelId}-${sub.subscriptionId || 'new'}`"
                                class="p-2 rounded-lg border transition duration-150" :class="{
                                    'bg-gray-700 border-green-600': sub.status === 1,
                                    'bg-yellow-900/30 border-yellow-600': sub.status === 0
                                }">

                                <div class="flex justify-between items-start">
                                    <div>
                                        <div class="flex items-center gap-2">
                                            <span>{{ getCategoryIcon(getChannelCategory(sub.channelId))
                                                }}</span>
                                            <span class="text-white font-semibold text-sm">
                                                {{ getChannelName(sub.channelId) }}
                                            </span>
                                        </div>

                                        <p class="text-xs mt-1"
                                            :class="sub.status === 1 ? 'text-green-400' : 'text-yellow-400'">
                                            {{ sub.status === 1 ? 'Active' : 'Inactive (Soft)' }}
                                        </p>
                                    </div>

                                    <button @click="toggleSubscriptionStatus(sub)"
                                        class="px-2 py-1 text-xs rounded border font-medium" :class="sub.status === 1
                                            ? 'bg-red-600 hover:bg-red-700 text-white border-red-500'
                                            : 'bg-green-600 hover:bg-green-700 text-white border-green-500'">
                                        {{ sub.status === 1 ? 'Remove' : 'Reactivate' }}
                                    </button>
                                </div>

                                <div class="border-t border-gray-600 mt-1 pt-2">
                                    <p class="text-xs text-gray-400">Users ({{ sub.userIds.length }}):</p>
                                    <div class="flex flex-wrap gap-1 mt-1 max-h-12 overflow-y-auto">
                                        <span v-for="u in sub.userIds" :key="typeof u === 'object' ? u.userId : u"
                                            class="px-2 py-0.5 rounded text-xs border" :class="sub.status === 1
                                                ? 'bg-cyan-900/50 text-cyan-200 border-cyan-700'
                                                : 'bg-yellow-900/50 text-yellow-200 border-yellow-700'">
                                            {{ typeof u === 'object' ? u.userId : u }}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div v-if="showAddSubscriptionModal"
            class="fixed inset-0 bg-black bg-opacity-70 z-30 flex items-center justify-center">
            <div @click.stop
                class="bg-gray-900 rounded-lg border border-gray-700 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
                <div class="p-5 flex justify-between items-center border-b border-gray-700 flex-shrink-0">
                    <h3 class="text-2xl font-bold text-blue-400">New Subscription</h3>
                    <button @click="showAddSubscriptionModal = false"
                        class="p-1 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white transition"
                        title="Close">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>

                <div class="p-5 overflow-y-auto space-y-4 flex-grow">
                    <div>
                        <label class="text-gray-300 text-sm font-semibold mb-2 block">
                            Area of Interest (AOI): <span class="text-red-400">*</span>
                        </label>
                        <CustomSelect v-model="selectedAOIForAdd" :options="availableAOIs" value-key="clientAoiId"
                            label-key="name" placeholder="Choose an Area of Interest"
                            @update:model-value="handleAoiChangeInModal" />
                    </div>

                    <div v-if="selectedAOIForAdd">
                        <div>
                            <label class="text-gray-300 text-sm font-semibold mb-2 block">
                                Alert Channel: <span class="text-red-400">*</span>
                            </label>
                            <select v-model="selectedChannelForAdd"
                                class="w-full px-3 py-2 bg-gray-700 text-white text-sm rounded-lg border border-gray-600 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition disabled:opacity-50"
                                :disabled="loadingChannels">
                                <option :value="null" disabled>Select a channel</option>
                                <optgroup v-for="(channels, category) in groupedAvailableChannelsForAdd" :key="category"
                                    :label="category">
                                    <option v-for="channel in channels" :key="channel.id" :value="channel">
                                        {{ channel.channel_name }}
                                    </option>
                                </optgroup>
                            </select>
                            <p v-if="loadingChannels" class="text-gray-400 text-xs mt-1">Loading channels...</p>
                            <p v-else-if="availableChannelsForAdd.length === 0" class="text-yellow-400 text-xs mt-1">
                                All available channels are already subscribed for this AOI.
                            </p>
                        </div>

                        <div>
                            <label class="text-gray-300 text-sm font-semibold mb-2 block">
                                Select Users: <span class="text-red-400">*</span>
                            </label>
                            <div
                                class="flex flex-wrap gap-1.5 p-2 bg-gray-700 rounded-lg border border-gray-600 max-h-32 overflow-y-auto">
                                <label v-for="userId in availableUsers" :key="userId"
                                    class="flex items-center px-3 py-1 rounded-md cursor-pointer text-sm transition-all whitespace-nowrap"
                                    :class="selectedUsersForAdd.includes(userId)
                                        ? 'bg-cyan-600 text-white font-semibold'
                                        : 'bg-gray-600 text-gray-200 hover:bg-gray-500'">
                                    <input type="checkbox" :value="userId" v-model="selectedUsersForAdd"
                                        class="hidden" />
                                    <span>{{ userId }}</span>
                                </label>
                            </div>
                            <p class="text-xs text-gray-400 mt-1">
                                {{ selectedUsersForAdd.length }} user(s) selected
                            </p>
                        </div>
                    </div>
                </div>

                <div class="p-5 border-t border-gray-700 flex-shrink-0">
                    <button @click="saveSubscriptionFromModal"
                        :disabled="!selectedAOIForAdd || !selectedChannelForAdd || selectedUsersForAdd.length === 0"
                        class="w-full px-4 py-2 rounded-lg font-semibold text-lg transition-all" :class="selectedAOIForAdd && selectedChannelForAdd && selectedUsersForAdd.length > 0
                            ? 'bg-green-600 hover:bg-green-700 text-white cursor-pointer'
                            : 'bg-gray-700 text-gray-500 cursor-not-allowed'">
                        Save Subscription
                    </button>
                </div>
            </div>
        </div>

    </div>
</template>

<style scoped>
/* Scoped styles remain mostly the same */
.h-\[70vh\] {
    height: 70vh;
}

.overflow-y-auto::-webkit-scrollbar {
    width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
    background: #374151;
    border-radius: 3px;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
    background: #4B5563;
    border-radius: 3px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
    background: #6B7280;
}

.transition-all {
    transition: all 0.2s ease-in-out;
}

select {
    /* Retaining custom select appearance */
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.5rem center;
    background-size: 1.5em 1.5em;
    padding-right: 2.5rem;
}

select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

optgroup {
    font-weight: bold;
    color: #06b6d4;
}

option {
    font-weight: normal;
    color: white;
    background-color: #374151;
}
</style>