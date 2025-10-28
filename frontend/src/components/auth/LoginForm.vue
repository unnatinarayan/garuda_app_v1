<!-- auth/LoginForm.vue: -->


<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { UserSession } from '@/classes/UserSession'; 

const router = useRouter();
const session = UserSession.getInstance();

const username = ref('testuser');
const password = ref('pass');
const errorMessage = ref('');
const isSigningUp = ref(false); // New state for toggling between login/signup

const submitAuth = async () => {
    errorMessage.value = '';

    if (isSigningUp.value) {
        // --- SIGNUP LOGIC ---
        const success = await session.attemptSignup(username.value, password.value);
        if (success) {
            errorMessage.value = 'Signup successful! Please log in with your new account.';
            isSigningUp.value = false; // Switch to login view
        } else {
            errorMessage.value = 'Signup failed. User may already exist or invalid input.';
        }

    } else {
        // --- LOGIN LOGIC ---
        const success = await session.attemptLogin(username.value, password.value);

        if (success) {
            router.push('/');
        } else {
            errorMessage.value = 'Login failed. Check username and password.';
        }
    }
};
</script>

<template>
  <div class="login-container max-w-sm mx-auto p-8 mt-20 bg-gray-800 rounded-xl shadow-2xl text-white">
    <h2 class="text-3xl font-bold mb-6 text-center text-cyan-400">{{ isSigningUp ? 'Sign Up' : 'Login' }} to Garuda V1</h2>
    <form @submit.prevent="submitAuth">
      
      <p v-if="errorMessage" class="error-message bg-red-600 p-3 rounded mb-4 text-sm text-center">
        {{ errorMessage }}
      </p>

      <div class="input-group mb-4">
        <label for="username" class="block text-gray-400 mb-1">Username (User ID):</label>
        <input 
            id="username" 
            type="text" 
            v-model="username" 
            required 
            class="w-full p-3 bg-gray-700 text-white rounded border border-gray-600 focus:ring-cyan-500 focus:border-cyan-500"
        />
      </div>
      
      <div class="input-group mb-6">
        <label for="password" class="block text-gray-400 mb-1">Password:</label>
        <input 
            id="password" 
            type="password" 
            v-model="password" 
            required 
            class="w-full p-3 bg-gray-700 text-white rounded border border-gray-600 focus:ring-cyan-500 focus:border-cyan-500"
        />
      </div>
      
      <button 
        type="submit"
        class="w-full py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-lg transition duration-200 shadow-md"
      >
        {{ isSigningUp ? 'Create Account' : 'Login' }}
      </button>

    </form>
    
    <div class="mt-6 text-center">
        <button 
            @click="isSigningUp = !isSigningUp; errorMessage = ''" 
            class="text-sm font-medium text-gray-400 hover:text-cyan-400 transition duration-150"
        >
            {{ isSigningUp ? 'Already have an account? Log In' : "Don't have an account? Sign Up" }}
        </button>
    </div>
  </div>
</template>

<style scoped>
/* Basic styling for visibility in the dark theme */
.login-container {
    background-color: #1f2937; /* Dark background */
    color: white;
}
.error-message {
    background-color: #dc2626; /* Red 600 */
}
</style>