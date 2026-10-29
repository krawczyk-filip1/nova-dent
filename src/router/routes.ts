import type { RouteRecordRaw } from 'vue-router'
import ClientLayout from '@/layouts/ClientLayout.vue'
import ServicesView from '@/views/client/ServicesView.vue'
import { requireCustomer, requireService, requireSlot } from './guards'

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: ClientLayout,
    children: [
      { path: '', name: 'services', component: ServicesView, meta: { title: 'Usługi' } },
      {
        path: 'rezerwacja/termin',
        name: 'booking-slot',
        component: () => import('@/views/client/BookingSlotView.vue'),
        beforeEnter: requireService,
        meta: { title: 'Wybierz termin' },
      },
      {
        path: 'rezerwacja/dane',
        name: 'booking-details',
        component: () => import('@/views/client/BookingDetailsView.vue'),
        beforeEnter: requireSlot,
        meta: { title: 'Twoje dane' },
      },
      {
        path: 'rezerwacja/podsumowanie',
        name: 'booking-summary',
        component: () => import('@/views/client/BookingSummaryView.vue'),
        beforeEnter: requireCustomer,
        meta: { title: 'Podsumowanie' },
      },
      {
        // Stałe ścieżki wyżej (termin, dane, podsumowanie) mają pierwszeństwo przed :code.
        path: 'rezerwacja/:code',
        name: 'booking-confirmation',
        component: () => import('@/views/client/BookingConfirmationView.vue'),
        props: true,
        meta: { title: 'Rezerwacja przyjęta' },
      },
      {
        path: 'moja-rezerwacja',
        name: 'my-booking',
        component: () => import('@/views/client/MyBookingView.vue'),
        meta: { title: 'Moja rezerwacja' },
      },
      {
        path: ':pathMatch(.*)*',
        name: 'not-found',
        component: () => import('@/views/NotFoundView.vue'),
        meta: { title: 'Nie znaleziono strony' },
      },
    ],
  },
  {
    path: '/admin/login',
    name: 'admin-login',
    component: () => import('@/views/admin/AdminLoginView.vue'),
    meta: { title: 'Logowanie' },
  },
  {
    path: '/admin',
    component: () => import('@/layouts/AdminLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', redirect: { name: 'admin-schedule' } },
      {
        path: 'grafik',
        name: 'admin-schedule',
        component: () => import('@/views/admin/AdminScheduleView.vue'),
        meta: { title: 'Grafik' },
      },
      {
        path: 'uslugi',
        name: 'admin-services',
        component: () => import('@/views/admin/AdminServicesView.vue'),
        meta: { title: 'Usługi' },
      },
      {
        path: 'pracownicy',
        name: 'admin-employees',
        component: () => import('@/views/admin/AdminEmployeesView.vue'),
        meta: { title: 'Pracownicy' },
      },
      {
        path: 'blokady',
        name: 'admin-blocks',
        component: () => import('@/views/admin/AdminBlocksView.vue'),
        meta: { title: 'Blokady' },
      },
      {
        path: 'statystyki',
        name: 'admin-stats',
        component: () => import('@/views/admin/AdminStatsView.vue'),
        meta: { title: 'Statystyki' },
      },
    ],
  },
]
