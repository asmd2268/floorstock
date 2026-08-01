export function isPendingDepartmentRequest(request) {
  return Boolean(
    request
      && String(request.status || '') === 'pending'
      && !request.fulfilledAt
      && request.fulfilled !== true,
  );
}

export function findPendingDepartmentRequest(requests, departmentId) {
  const target = String(departmentId || '');
  if (!target) return null;
  return (Array.isArray(requests) ? requests : [])
    .filter((request) => (
      String(request && request.deptId || '') === target
      && isPendingDepartmentRequest(request)
    ))
    .sort((left, right) => {
      const leftTime = Date.parse(left && (left.created || left.createdAt) || 0) || 0;
      const rightTime = Date.parse(right && (right.created || right.createdAt) || 0) || 0;
      return rightTime - leftTime;
    })[0] || null;
}

function bilingualReason(reason, fallbackArabic, fallbackEnglish) {
  const lines = String(reason || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const arabic = lines.find((line) => /[\u0600-\u06ff]/.test(line)) || fallbackArabic;
  const english = lines.find((line) => /[A-Za-z]/.test(line)) || fallbackEnglish;
  return { reasonAr: arabic, reasonEn: english };
}

export function deriveNewRequestGateState({
  isDepartment = true,
  departmentId = '',
  requests = [],
  schedule = { allowed: true },
  rollingLimit = { blocked: false },
  monthlyLimit = null,
  monthlyUsed = 0,
} = {}) {
  if (!isDepartment) {
    return {
      blocked: true,
      kind: 'role',
      reasonAr: 'هذه الصفحة مخصصة لحسابات الأقسام فقط.',
      reasonEn: 'This page is available to department accounts only.',
    };
  }

  if (!String(departmentId || '')) {
    return {
      blocked: true,
      kind: 'department',
      reasonAr: 'الحساب غير مرتبط بقسم.',
      reasonEn: 'This account is not linked to a department.',
    };
  }

  const pendingRequest = findPendingDepartmentRequest(requests, departmentId);
  if (pendingRequest) {
    const scheduleOpen = !schedule || schedule.allowed !== false;
    return {
      blocked: true,
      kind: 'pending',
      pendingRequest,
      canEditPending: scheduleOpen,
      reasonAr: scheduleOpen
        ? 'يوجد لديك طلب معلّق. لا يمكنك إنشاء طلب جديد حتى تنفّذه الصيدلية. يمكنك تعديل الطلب المعلّق الآن قبل نهاية وقت الطلب المسموح.'
        : 'يوجد لديك طلب معلّق. لا يمكنك إنشاء طلب جديد حتى تنفّذه الصيدلية. يمكنك تعديل الطلب المعلّق عند فتح نافذة الطلب وقبل نهاية الوقت المسموح.',
      reasonEn: scheduleOpen
        ? 'You have a pending request. You cannot create a new request until it is fulfilled by the pharmacy. You may edit the pending request now before the allowed ordering window closes.'
        : 'You have a pending request. You cannot create a new request until it is fulfilled by the pharmacy. You may edit the pending request when the ordering window opens and before it closes.',
    };
  }

  if (schedule && schedule.allowed === false) {
    return {
      blocked: true,
      kind: 'schedule',
      schedule,
      reasonAr: 'الطلب غير متاح خارج الأيام والساعات المسموحة.',
      reasonEn: 'Ordering is unavailable outside the allowed days and hours.',
    };
  }

  if (rollingLimit && rollingLimit.blocked) {
    return {
      blocked: true,
      kind: rollingLimit.period || 'count',
      ...bilingualReason(
        rollingLimit.reason,
        'وصلت إلى الحد الأعلى المسموح لعدد الطلبات.',
        'You have reached the maximum allowed number of requests.',
      ),
    };
  }

  const hasMonthlyLimit = monthlyLimit !== null && monthlyLimit !== undefined && monthlyLimit !== '';
  const numericMonthlyLimit = Number(monthlyLimit);
  const numericMonthlyUsed = Number(monthlyUsed) || 0;
  if (hasMonthlyLimit && Number.isFinite(numericMonthlyLimit) && numericMonthlyLimit >= 0 && numericMonthlyUsed >= numericMonthlyLimit) {
    return {
      blocked: true,
      kind: 'monthly',
      used: numericMonthlyUsed,
      limit: numericMonthlyLimit,
      reasonAr: 'وصلت إلى الحد الأعلى المسموح للطلبات خلال هذا الشهر. إذا كنت قد رفعت طلبًا سابقًا، يمكنك تعديله قبل إغلاق نافذة الطلب.',
      reasonEn: 'You have reached the maximum number of requests allowed this month. If you previously submitted a request, you can edit it before the request window closes.',
    };
  }

  return { blocked: false, kind: 'allowed' };
}
