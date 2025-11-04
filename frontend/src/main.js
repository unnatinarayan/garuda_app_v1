import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router/index.js'; // Updated extension
import './style.css'; // Global styles
import "tailwindcss";

// Create the root Vue application instance
const app = createApp(App);

// Install Pinia for state management (used by your ProjectStore)
app.use(createPinia());

// Install the Vue Router
app.use(router);

// Mount the application to the DOM (assuming index.html has <div id="app"></div>)
app.mount('#app');
