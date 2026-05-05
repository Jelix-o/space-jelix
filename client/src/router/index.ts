import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: () => import('@/views/HomeView.vue'), meta: { title: '应用' } },
    { path: '/app/:id', name: 'app-detail', component: () => import('@/views/AppDetailView.vue'), meta: { title: '应用详情' } },
    { path: '/chat', name: 'chat', component: () => import('@/views/ChatView.vue'), meta: { title: '对话' } },
    {
      path: '/chat/new',
      name: 'chat-new',
      component: () => import('@/views/ChatSessionView.vue'),
      meta: { title: '新对话', hideAppNav: true },
    },
    {
      path: '/chat/:id',
      name: 'chat-session',
      component: () => import('@/views/ChatSessionView.vue'),
      meta: { title: '对话', hideAppNav: true },
    },
    { path: '/generate', name: 'generate', component: () => import('@/views/GenerateView.vue'), meta: { title: '生图' } },
    { path: '/connections', name: 'connections', component: () => import('@/views/ConnectionsView.vue'), meta: { title: '连接' } },
    { path: '/terminal/:id', name: 'terminal', component: () => import('@/views/TerminalView.vue'), meta: { title: '终端', hideAppNav: true } },
    { path: '/providers', redirect: '/settings?panel=providers' },
    { path: '/settings', name: 'settings', component: () => import('@/views/SettingsView.vue'), meta: { title: '设置' } },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.afterEach((to) => {
  document.title = `${to.meta.title ?? 'Space Jelix'} · Space Jelix`
})

export default router
