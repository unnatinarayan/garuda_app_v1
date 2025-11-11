<!-- App.vue - Responsive Layout -->

<script setup>
import { ApiClient } from './api/ApiClient.js';
import { ref, watchEffect, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { UserSession } from './classes/UserSession.js';
import NotificationDropdown from '@/components/common/NotificationDropdown.vue';
import ProfileDropdown from '@/components/common/ProfileDropdown.vue';
import { useProjectStore } from './stores/ProjectStore.js';

const router = useRouter();
const route = useRoute();
const session = UserSession.getInstance();
const projectStore = useProjectStore();
const apiClient = ApiClient.getInstance();
const showNavbar = ref(false);
const eventSource = ref(null);

const startSSE = (userId) => {
    if (eventSource.value) {
        eventSource.value.close();
        eventSource.value = null;
    }

    console.log(`[SSE] Starting connection for user: ${userId}`);
    const source = new EventSource(`/api/alerts/events/${userId}`);

    source.onmessage = function (event) {
        try {
            const notif = JSON.parse(event.data);
            console.log('[SSE] New Alert Received:', notif.id);
            projectStore.addAlert(notif);
        } catch (err) {
            console.error('[SSE] Error parsing notification:', err);
        }
    };
    source.onerror = (e) => console.error('[SSE] Connection Error:', e);
    source.onopen = () => console.log('[SSE] Connection Opened');

    eventSource.value = source;
};

onMounted(() => {
    document.body.classList.add('light'); 
    
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.style.opacity = '0';
            setTimeout(() => {
                splash.style.display = 'none';
            }, 500);
        }
    }, 500);
});

watchEffect(() => {
    const userId = session.userId;
    showNavbar.value = route.name !== 'login';

    if (session.isLoggedIn && userId) {
        startSSE(userId);
    } else {
        if (eventSource.value) {
            eventSource.value.close();
            eventSource.value = null;
        }
        projectStore.activeAlerts = [];
    }
});

const goToHome = () => {
    if (session.isLoggedIn) {
        router.push('/');
    }
};



const profileInitials = computed(() => {
    const name = session.username || 'User';
    const words = name.split(' ');
    if (words.length > 1) {
        return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name[0]?.toUpperCase() || 'AD';
});
</script>

<template>
  <div id="app-wrapper" class="h-screen flex flex-col tw-base">
    
    <div id="splash-screen" class="fixed inset-0 flex flex-col justify-center items-center z-50 transition-opacity duration-500" style="background-color: var(--bg-color);">
        <div class="text-4xl font-extrabold tracking-widest flex items-center space-x-4" style="color: var(--text-color);">
            <div class="h-40 w-40 bg-cyan-100 rounded-full flex items-center justify-center text-white text-3xl">
              <img src="@/assets/garuda.png" alt="Garuda Logo" class="h-20 w-auto">
            </div> 
        </div>
        <p class="mt-4 text-sm tracking-wider" style="color: var(--accent-color);"><b>G</b>eospatial <b>Ar</b>ea Monitoring with <b>U</b>nified <b>D</b>ata <b>A</b>nalytics</p>
    </div>
    
    <div v-if="showNavbar" class="fixed top-0 left-0 right-0 px-4 py-1.5 flex justify-between items-center z-20 shadow-md" style="background-color: var(--container-bg); border-bottom: 1px solid var(--header-border); height: 50px;">        
        <div class="flex items-center space-x-2 cursor-pointer" @click="goToHome">
             <img src="@/assets/garuda.png" alt="Garuda Logo" class="h-8 w-auto">
        </div>
        
        <div class="flex items-center space-x-3">
            <div class="flex text-gray-400 items-center space-x-2 cursor-pointer" @click="goToHome">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                  <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>
            </div>
            <NotificationDropdown />

            <ProfileDropdown />
            
            <!-- <div @click="handleLogout" title="Logout" class="cursor-pointer w-8 h-8 bg-cyan-600 rounded-full flex items-center justify-center text-white font-semibold text-xs hover:bg-red-500 transition-colors duration-200">
                {{ profileInitials }}
            </div> -->
        </div>
    </div>

    <main class="app-content flex-grow overflow-y-auto" :class="{'pt-[50px]': showNavbar}"> 
      <RouterView />
    </main>

    <footer class="app-footer flex-shrink-0 bg-gray-700 h-8 flex items-center justify-center">
      <h1 class="text-center text-xs font-bold text-white">Copyright &copy; 2025 VEDAS SAC ISRO</h1>
    </footer>
  </div>
</template>

<style>
#app-wrapper {
  font-family: 'Inter', Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
  height: 100vh;
  overflow: hidden;
}

body {
    font-family: 'Inter', sans-serif;
    margin: 0;
    padding: 0;
}

.app-content {
    padding-left: 0.25rem;
    padding-right: 0.25rem;
}

.app-footer {
    padding: 0;
}

@media (max-width: 640px) {
    .app-content {
        padding-left: 0;
        padding-right: 0;
    }
}

.app-content > div {
    min-height: 100%;
}
</style>