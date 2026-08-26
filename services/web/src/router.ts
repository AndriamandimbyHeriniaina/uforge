import { createRouter, createWebHistory } from 'vue-router';
import { getToken } from './api';
import AuthView from './views/AuthView.vue';
import HomeView from './views/HomeView.vue';
import BuilderView from './views/BuilderView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/auth', name: 'auth', component: AuthView },
    { path: '/', name: 'home', component: HomeView, meta: { auth: true } },
    {
      path: '/app/:id',
      name: 'builder',
      component: BuilderView,
      meta: { auth: true },
    },
  ],
});

router.beforeEach((to) => {
  const token = getToken();
  if (to.meta.auth && !token) {
    return { name: 'auth' };
  }
  if (to.name === 'auth' && token) {
    return { name: 'home' };
  }
  return true;
});
