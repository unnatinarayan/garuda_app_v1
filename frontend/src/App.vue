<!-- App.vue -->

<script setup>

import { ApiClient } from './api/ApiClient.js'; // Import ApiClient to use its userId
import { ref, watchEffect, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { UserSession } from './classes/UserSession.js';
import NotificationDropdown from '@/components/common/NotificationDropdown.vue'; // <<< Updated extension
import { useProjectStore } from './stores/ProjectStore.js'; // Import store for alerts

const router = useRouter();
const route = useRoute();
const session = UserSession.getInstance();
const projectStore = useProjectStore(); // Use project store for alert count


const apiClient = ApiClient.getInstance(); // Get the client instance
const showNavbar = ref(false);
const isDarkMode = ref(false); // Default to false (Light Theme)
// const alertCount = computed(() => projectStore.userProjects.length > 0 ? 1 : 0); // Mocked alert count for demonstration

// Local variable to hold the SSE connection instance
const eventSource = ref(null);


// Theme Toggle Function
const toggleTheme = () => {
    isDarkMode.value = !isDarkMode.value;
    document.body.classList.toggle('dark', isDarkMode.value);
    document.body.classList.toggle('light', !isDarkMode.value);
};


// Function to establish and manage the SSE connection
const startSSE = (userId) => {
    // 1. Close existing connection if it exists
    if (eventSource.value) {
        eventSource.value.close();
        eventSource.value = null;
    }

    console.log(`[SSE] Starting connection for user: ${userId}`);
    // NOTE: The path is /api/alerts/events/:userId
    const source = new EventSource(`/api/alerts/events/${userId}`);

    source.onmessage = function (event) {
        try {
            const notif = JSON.parse(event.data);
            console.log('[SSE] New Alert Received:', notif.id);
            projectStore.addAlert(notif); // Use the new store action
        } catch (err) {
            console.error('[SSE] Error parsing notification:', err);
        }
    };
    source.onerror = (e) => console.error('[SSE] Connection Error:', e);
    source.onopen = () => console.log('[SSE] Connection Opened');

    eventSource.value = source;
};



onMounted(() => {
    // Set initial theme based on preference or system (default to light)
    document.body.classList.add('light'); 
    
    // Simulate splash screen fade out
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
    // Show navbar/layout elements only if the user is logged in AND not on the login page
    showNavbar.value = session.isLoggedIn && route.name !== 'login';
    // console.log(session.isLoggedIn);

    if (session.isLoggedIn && userId) {
        startSSE(userId);
    } else {
        // Close connection on logout
        if (eventSource.value) {
            eventSource.value.close();
            eventSource.value = null;
        }
        projectStore.activeAlerts = []; // Clear local alerts on logout
    }
});


// A simple navigation function for the top-level view
const goToHome = () => {
    if (session.isLoggedIn) {
        router.push('/');
    }
};


const handleLogout = () => {
    session.logout();
    router.push('/login');
};

// Compute initials for profile icon
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
  <div id="app-wrapper">
    
    <div id="splash-screen" class="fixed inset-0 flex flex-col justify-center items-center z-50 transition-opacity duration-500" style="background-color: var(--bg-color);">
        <div class="text-4xl font-extrabold tracking-widest flex items-center space-x-4" style="color: var(--text-color);">
            <div class="h-40 w-40 bg-cyan-100 rounded-full flex items-center justify-center text-white text-3xl">
              <img src="@/assets/garuda.png" alt="Garuda Logo" class="h-20 w-auto">

            </div> 
        </div>
        <p class="mt-4 text-sm tracking-wider" style="color: var(--accent-color);"><b>G</b>eospatial <b>Ar</b>ea Monitoring with <b>U</b>nified <b>D</b>ata <b>A</b>nalytics</p>
    </div>
    
<div v-if="showNavbar"  class="fixed top-0 left-0 right-0 px-8 py-3 flex justify-between items-center z-20 shadow-md transition-colors duration-300" style="background-color: var(--container-bg); border-bottom: 1px solid var(--header-border);">        
        <div class="flex items-center space-x-2 cursor-pointer" @click="goToHome">
             <img src="@/assets/garuda.png" alt="Garuda Logo" class="h-10 w-auto">
        </div>
        
        <div class="flex items-center space-x-4">
            
            <!-- <button @click="toggleTheme" class="p-2 transition-colors duration-200" :style="{color: isDarkMode ? 'var(--accent-color)' : 'var(--text-muted)'}">
                <svg v-if="isDarkMode" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>
                <svg v-else class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
            </button> -->


            <NotificationDropdown />
            
            <div @click="handleLogout" title="Logout" class="cursor-pointer w-9 h-9 bg-cyan-600 rounded-full flex items-center justify-center text-white font-semibold text-sm hover:bg-red-500 transition-colors duration-200">
                {{ profileInitials }}
            </div>
        </div>
    </div>
    <main class="app-content" :class="{'pt-20': showNavbar}"> 
      <RouterView />
    </main>
    <footer class="app-footer">
  <h1 class="text-center text-lg font-bold text-white">Copyright &copy; Garuda SAC</h1>
</footer>
 </div>
</template>




<style>
/* Global styles for the app container */
#app-wrapper {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
  min-height: 100vh;
}
body {
    font-family: 'Inter', sans-serif; /* Recommended font for modern UI */
}
.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 20px;
  background-color: #3f51b5;
  color: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
.app-title {
  font-size: 1.5em;
  margin: 0;
  cursor: pointer;
}
.user-controls {
  display: flex;
  align-items: center;
  gap: 15px;
}
.username {
  font-size: 0.9em;
}
.logout-button {
  padding: 6px 12px;
  background: white;
  color: #3f51b5;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}

.app-content {
  /* Retain padding on the sides, but let pt-20 handle the top spacing */
  padding-left: 10px;
  padding-right: 10px;
  padding-bottom: 70px;
  min-height: 100vh;
}
.app-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  background-color: #333; /* Add your desired background color */
  padding: 1rem;
  text-align: center;
}

@media (max-width: 768px) {
  .app-footer {
    padding: 0.5rem;
    height: 40px;
  }
}
@media (max-width: 640px) {
    .app-content {
        padding-left: 5px; 
        padding-right: 5px;
        padding-bottom: 55px;
    }
    /* Ensure the wrapper inside configure UI is full width on mobile */
    .configure-project-ui .w-full.max-w-6xl.mx-auto {
        max-width: 100%;
        margin-left: 0;
        margin-right: 0;
        padding: 5px;
    }

}
.app-content > div {
    min-height: 100%;
}
</style>