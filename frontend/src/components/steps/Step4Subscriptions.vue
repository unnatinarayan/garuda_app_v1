<!-- frontend/src/components/steps/Step4Subscriptions.vue -->

<script setup>
import { ref, computed, onMounted } from 'vue';
import { ApiClient } from '@/api/ApiClient.js';
import { useMessageStore } from '@/stores/MessageStore.js';
import { useProjectStore } from '@/stores/ProjectStore.js';
import CustomSelect from '@/components/common/CustomSelect.vue';

const props = defineProps({
    projectData: Object,
});

const filterAoi = ref("all");
const filterChannel = ref("all");
const filterUser = ref("all");

const api = ApiClient.getInstance();
const messageStore = useMessageStore();
const projectStore = useProjectStore();

const alertChannels = ref([]);
const selectedAOI = ref(null);
const selectedChannel = ref(null);
const selectedUsers = ref([]);
const loadingChannels = ref(false);
const error = ref(null);
const showSubscriptionsPopup = ref(false);

// FIXED: Extract only userIds from the users array
const availableUsers = computed(() =>
    props.projectData.users.map(user =>
        typeof user === 'object' ? user.userId : user
    )
);

// Get existing subscriptions for selected AOI (Active or Inactive)
const allAoiSubscriptions = computed(() => {
    if (!selectedAOI.value) return [];
    return props.projectData.getSubscriptionsForAoi(selectedAOI.value.clientAoiId, true);
});

// Get AOI name from clientAoiId
const getAoiName = (clientAoiId) => {
    const aoi = props.projectData.aoiDrafts.find(a => a.clientAoiId === clientAoiId);
    return aoi ? aoi.name : `AOI ${clientAoiId}`;
};

const allProjectSubscriptions = computed(() => {
    return props.projectData.subscriptions.filter(sub => sub.status !== 2);
});

// Filter for currently active subscriptions (status = 1)
const activeSubscriptions = computed(() => {
    return allAoiSubscriptions.value.filter(sub => sub.status === 1);
});

// Filter for channels that are currently active (status = 1)
const subscribedChannelIds = computed(() => {
    return new Set(activeSubscriptions.value.map(sub => sub.channelId));
});

// Filter out currently active channels
const availableChannels = computed(() => {
    return alertChannels.value.filter(ch => !subscribedChannelIds.value.has(ch.id));
});

// Group available channels by category
const groupedAvailableChannels = computed(() => {
    const groups = {};
    availableChannels.value.forEach(channel => {
        if (!groups[channel.category]) {
            groups[channel.category] = [];
        }
        groups[channel.category].push(channel);
    });
    return groups;
});

const filteredAndGroupedSubscriptions = computed(() => {
    let subs = props.projectData.subscriptions.filter(s => s.status !== 2);

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

const flattenedAvailableChannels = computed(() => {
    const flatList = [];
    const grouped = groupedAvailableChannels.value;
    const categories = Object.keys(grouped).sort();

    categories.forEach(category => {
        flatList.push({
            isHeader: true,
            categoryName: category,
            id: `header-${category}`,
            channel_name: category,
        });

        grouped[category].forEach(channel => {
            flatList.push(channel);
        });
    });

    return flatList;
});

onMounted(async () => {
    loadingChannels.value = true;
    try {
        const channels = await api.getAlertChannelCatalogue();
        alertChannels.value = channels;

        // Auto-select first AOI if available
        if (props.projectData.aoiDrafts.length > 0) {
            selectedAOI.value = props.projectData.aoiDrafts.filter(a => a.status !== 2)[0];
        }
    } catch (e) {
        error.value = "Failed to load alert channels.";
        console.error("Load Channels Error:", e);
    } finally {
        loadingChannels.value = false;
    }
});

const addSubscription = () => {
    if (!selectedAOI.value || !selectedChannel.value || selectedUsers.value.length === 0) {
        messageStore.showMessage("Please select AOI, channel, and at least one user.", "error");
        return;
    }

    if (selectedChannel.value.isHeader) {
        messageStore.showMessage("Please select a specific channel, not a category header.", "error");
        selectedChannel.value = null;
        return;
    }

    const existingSoftDeleted = allAoiSubscriptions.value.find(
        sub => sub.channelId === selectedChannel.value.id && sub.status === 0
    );

    if (existingSoftDeleted) {
        props.projectData.addOrUpdateSubscription(
            selectedAOI.value.clientAoiId,
            selectedChannel.value.id,
            [...selectedUsers.value],
            existingSoftDeleted.subscriptionId
        );
        messageStore.showMessage(
            `Subscription **reactivated** for ${selectedChannel.value.channel_name}.`,
            "success"
        );
    } else {
        props.projectData.addOrUpdateSubscription(
            selectedAOI.value.clientAoiId,
            selectedChannel.value.id,
            [...selectedUsers.value]
        );
        messageStore.showMessage(
            `Subscription added: ${selectedChannel.value.channel_name} for ${selectedUsers.value.length} user(s).`,
            "success"
        );
    }

    selectedChannel.value = null;
    selectedUsers.value = [];
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

// Handle AOI change - reset channel and users, close popup
const handleAoiChange = () => {
    selectedChannel.value = null;
    selectedUsers.value = [];
    showSubscriptionsPopup.value = false;
};
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
            <div class="bg-gray-800 p-3 rounded-lg mb-3 flex-shrink-0">
                <label class="text-gray-300 text-sm font-semibold mb-2 block">Select AOI:</label>
                <CustomSelect v-model="selectedAOI" :options="availableAOIs" value-key="clientAoiId" label-key="name"
                    placeholder="Choose an Area of Interest" @update:model-value="handleAoiChange" />
                <p v-if="selectedAOI" class="text-xs text-gray-400 mt-1">
                    {{ activeSubscriptions.length }} active subscription(s) configured
                </p>
            </div>

            <div v-if="selectedAOI" class="flex-grow flex flex-col min-h-0 gap-3">
                <div class="bg-gray-800 border border-gray-700 rounded-lg p-3 flex-shrink-0">
                    <div class="flex justify-between items-center mb-3">
                        <h4 class="text-cyan-400 font-semibold text-lg">Add New Subscription</h4>

                        <button @click="showSubscriptionsPopup = !showSubscriptionsPopup"
                            class="flex items-center px-2 py-1.5 bg-blue-900 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition duration-150 shadow-md"
                            title="Open Active Subscriptions">
                            <svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            View Cart
                        </button>
                    </div>

                    <div class="grid grid-cols-1 gap-3">
                        <div>
                            <label class="text-gray-300 text-xs font-semibold mb-1.5 block">
                                Alert Channel: <span class="text-red-400">*</span>
                            </label>

                            <select v-model="selectedChannel"
                                class="w-full px-3 py-2 bg-gray-700 text-white text-sm rounded-lg border border-gray-600 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition">
                                <option :value="null" disabled>Select a channel</option>
                                <optgroup v-for="(channels, category) in groupedAvailableChannels" :key="category"
                                    :label="category">
                                    <option v-for="channel in channels" :key="channel.id" :value="channel">
                                        {{ channel.channel_name }}
                                    </option>
                                </optgroup>
                            </select>
                            <p v-if="availableChannels.length === 0" class="text-yellow-400 text-xs mt-1">
                                All channels are already subscribed for this AOI
                            </p>
                        </div>

                        <div>
                            <label class="text-gray-300 text-xs font-semibold mb-1.5 block">
                                Select Users: <span class="text-red-400">*</span>
                            </label>
                            <div
                                class="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-gray-700 rounded-lg border border-gray-600">
                                <label v-for="userId in availableUsers" :key="userId"
                                    class="flex items-center px-2.5 py-1 rounded-md cursor-pointer text-xs transition-all"
                                    :class="selectedUsers.includes(userId)
                                        ? 'bg-cyan-600 text-white font-semibold'
                                        : 'bg-gray-600 text-gray-200 hover:bg-gray-500'">
                                    <input type="checkbox" :value="userId" v-model="selectedUsers" class="hidden" />
                                    <span>{{ userId }}</span>
                                </label>
                            </div>
                            <p class="text-xs text-gray-400 mt-1">
                                {{ selectedUsers.length }} user(s) selected
                            </p>
                        </div>
                    </div>

                    <button @click="addSubscription" :disabled="!selectedChannel || selectedUsers.length === 0"
                        class="w-full mt-3 px-4 py-2 rounded-lg font-semibold text-sm transition-all" :class="selectedChannel && selectedUsers.length > 0
                            ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                            : 'bg-gray-700 text-gray-500 cursor-not-allowed'">
                        Add Subscription
                    </button>
                </div>

                <div v-if="showSubscriptionsPopup" v-click-outside="() => showSubscriptionsPopup = false"
                    class="absolute top-20 right-0 mt-2 w-full max-w-sm bg-gray-900 rounded-lg border border-gray-700 shadow-2xl z-20 max-h-[80%] overflow-hidden">
                    <div class="p-4 flex flex-col h-full">
                        <div class="flex justify-between items-center border-b border-gray-700 pb-2 flex-shrink-0">
                            <div class="flex flex-col w-full">
                                <h5 class="text-xl font-bold text-cyan-400 mb-2">
                                    Active Subscriptions
                                </h5>

                                <!-- Filters -->
                                <div class="grid grid-cols-3 gap-2">
                                    <select v-model="filterAoi"
                                        class="bg-gray-800 text-gray-200 p-1 rounded border border-gray-600 text-xs">
                                        <option value="all">All AOIs</option>
                                        <option v-for="aoi in availableAOIs" :key="aoi.clientAoiId"
                                            :value="aoi.clientAoiId">
                                            {{ aoi.name }}
                                        </option>
                                    </select>

                                    <select v-model="filterChannel"
                                        class="bg-gray-800 text-gray-200 p-1 rounded border border-gray-600 text-xs">
                                        <option value="all">All Channels</option>
                                        <option v-for="ch in alertChannels" :key="ch.id" :value="ch.id">
                                            {{ ch.channel_name }}
                                        </option>
                                    </select>

                                    <select v-model="filterUser"
                                        class="bg-gray-800 text-gray-200 p-1 rounded border border-gray-600 text-xs">
                                        <option value="all">All Users</option>
                                        <option v-for="u in availableUsers" :key="u" :value="u">
                                            {{ u }}
                                            <!-- <span>{{ userId }}</span> -->
                                        </option>
                                    </select>
                                </div>
                            </div>

                            <button @click="showSubscriptionsPopup = false"
                                class="p-1 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white transition"
                                title="Close">
                                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                        d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>
                        </div>

                        <div v-if="allProjectSubscriptions.length === 0"
                            class="text-center text-gray-400 py-6 flex-grow">
                            <svg class="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor"
                                viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                            <p class="text-base">No subscriptions configured</p>
                            <p class="text-sm mt-1">Add a new one below</p>
                        </div>

                        <div v-else class="max-h-80 overflow-y-auto space-y-4 flex-grow p-1">
                            <div v-if="Object.keys(filteredAndGroupedSubscriptions).length === 0"
                                class="text-center text-gray-400 py-6">
                                <p class="text-base">No subscriptions match the filter</p>
                            </div>

                            <div v-for="(subs, aoiName) in filteredAndGroupedSubscriptions" :key="aoiName"
                                class="bg-gray-800 border border-gray-700 rounded-lg p-3">

                                <h3 class="text-cyan-300 font-semibold mb-2 text-sm">
                                    📍 {{ aoiName }} ({{ subs.length }})
                                </h3>

                                <div class="space-y-2">
                                    <div v-for="sub in subs"
                                        :key="`${sub.clientAoiId}-${sub.channelId}-${sub.subscriptionId || 'new'}`"
                                        class="p-3 rounded-lg border transition duration-150" :class="{
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
                                                    ? 'bg-red-600 text-white border-red-500'
                                                    : 'bg-green-600 text-white border-green-500'">
                                                {{ sub.status === 1 ? 'Remove' : 'Reactivate' }}
                                            </button>
                                        </div>

                                        <div class="border-t border-gray-600 mt-2 pt-2">
                                            <p class="text-xs text-gray-400">Users:</p>
                                            <div class="flex flex-wrap gap-1 mt-1">
                                                <span v-for="u in sub.userIds"
                                                    :key="typeof u === 'object' ? u.userId : u"
                                                    class="px-2 py-0.5 rounded text-xs border" :class="sub.status === 1
                                                        ? 'bg-cyan-900/50 text-cyan-200 border-cyan-700'
                                                        : 'bg-yellow-900/50 text-yellow-200 border-yellow-700'">
                                                    {{ typeof u === 'object' ? u.userId : u }}
                                                </span>

                                                <!-- <span v-for="u in sub.userIds" :key="u"
                                                    class="px-2 py-0.5 rounded text-xs border" :class="sub.status === 1
                                                        ? 'bg-cyan-900/50 text-cyan-200 border-cyan-700'
                                                        : 'bg-yellow-900/50 text-yellow-200 border-yellow-700'">
                                                    {{ u }}
                                                </span> -->

                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
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