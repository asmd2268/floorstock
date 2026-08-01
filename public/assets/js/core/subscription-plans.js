export const SUBSCRIPTION_PLANS = Object.freeze({
  starter: Object.freeze({
    id: 'starter',
    nameAr: 'الأساسية',
    nameEn: 'Starter',
    features: Object.freeze(['inventory', 'requests', 'expiry', 'printing']),
    maxUsers: 25,
    maxDepartments: 10,
  }),
  professional: Object.freeze({
    id: 'professional',
    nameAr: 'الاحترافية',
    nameEn: 'Professional',
    features: Object.freeze(['inventory', 'requests', 'expiry', 'printing', 'analytics', 'crash_cart', 'controlled', 'labels']),
    maxUsers: 100,
    maxDepartments: 50,
  }),
  enterprise: Object.freeze({
    id: 'enterprise',
    nameAr: 'الشاملة',
    nameEn: 'Enterprise',
    features: Object.freeze(['inventory', 'requests', 'expiry', 'printing', 'analytics', 'crash_cart', 'controlled', 'labels', 'warehouse', 'branding']),
    maxUsers: null,
    maxDepartments: null,
  }),
});

export function planFor(value) {
  return SUBSCRIPTION_PLANS[String(value || '').toLowerCase()] || SUBSCRIPTION_PLANS.starter;
}

export function subscriptionIsWritable(subscription, now = Date.now()) {
  if (!subscription) return false;
  if (!['active', 'trialing'].includes(String(subscription.status || ''))) return false;
  const end = subscription.currentPeriodEnd || subscription.trialEndsAt;
  if (!end) return true;
  const time = end && typeof end.toMillis === 'function' ? end.toMillis() : new Date(end).getTime();
  return Number.isFinite(time) && time > now;
}
