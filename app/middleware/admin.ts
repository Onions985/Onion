export default defineNuxtRouteMiddleware(async () => {
  const request = useRequestFetch()
  try {
    const result = await request<{ user: unknown }>('/api/auth/me')
    if (!result.user) return navigateTo('/admin/login')
  } catch {
    return navigateTo('/admin/login')
  }
})
