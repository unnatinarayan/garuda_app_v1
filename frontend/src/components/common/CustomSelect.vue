<script setup>
import { ref, watch, computed } from 'vue';

const props = defineProps({
    modelValue: [Object, String, Number, null], // The currently selected value
    options: { type: Array, required: true },  // Array of AOI drafts
    labelKey: { type: String, default: 'name' }, // Key to display as the option label
    valueKey: { type: String, default: 'aoiId' }, // Key to use as the value
    placeholder: { type: String, default: 'Select an Item' }
});

const emit = defineEmits(['update:modelValue']);

const isOpen = ref(false);
const selectedItem = ref(props.modelValue);

// Use a computed property to display the label of the currently selected item
const displayLabel = computed(() => {
    if (!selectedItem.value) return props.placeholder;
    // Assuming options are AOI draft objects, use the provided labelKey
    const item = props.options.find(opt => opt === selectedItem.value);
    return item ? `${item.name} (${item.aoiId})` : props.placeholder;
});

// Sync local state with prop changes (e.g., when AOIs are loaded)
watch(() => props.modelValue, (newVal) => {
    selectedItem.value = newVal;
});

const selectOption = (option) => {
    selectedItem.value = option;
    emit('update:modelValue', option);
    isOpen.value = false;
};
</script>

<template>
    <div class="relative w-full">
        <button 
            type="button" 
            @click="isOpen = !isOpen"
            class="w-full p-2 bg-gray-700 text-white rounded border border-gray-600 flex justify-between items-center transition-colors duration-150"
            :class="{'ring-2 ring-cyan-500 border-cyan-500': isOpen}"
        >
            <span class="truncate pr-2" :class="{'text-gray-400': !selectedItem}">
                {{ displayLabel }}
            </span>
            <svg class="w-4 h-4 transition-transform duration-200" 
                 :class="{'rotate-180': isOpen}" 
                 fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
            </svg>
        </button>

        <div v-if="isOpen" 
             class="absolute mt-1 w-full rounded-lg bg-gray-700 shadow-xl border border-gray-600 z-50 max-h-40 overflow-y-auto"
             tabindex="-1"
        >
            <div 
                v-for="option in options" 
                :key="option[valueKey]" 
                @click="selectOption(option)"
                class="p-2 cursor-pointer hover:bg-gray-600 transition-colors duration-100 truncate"
                :class="{'bg-gray-600 font-semibold': option === selectedItem}"
            >
                {{ option.name }} ({{ option.aoiId }})
            </div>
             <div v-if="options.length === 0" class="p-2 text-gray-400 italic">No options available</div>
        </div>
    </div>
</template>