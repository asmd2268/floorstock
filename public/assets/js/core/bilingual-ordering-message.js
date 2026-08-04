const DAYS_AR = Object.freeze(['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت']);
const DAYS_EN = Object.freeze(['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']);

export function formatOrderingUnavailable(check = {}) {
  const next = check && check.next;
  if (!next) return null;
  let dayIndex = Number(next.dayIndex);
  if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex > 6) {
    dayIndex = DAYS_EN.indexOf(String(next.day || ''));
  }
  let time = String(next.time || '').trim();
  const numericHour = Number(next.hour);
  if (!time && Number.isInteger(numericHour) && numericHour >= 0 && numericHour < 24) {
    time = `${String(numericHour).padStart(2, '0')}:00`;
  }
  if (dayIndex < 0 || !time) return null;
  return {
    ar: `🚫 الطلب غير متاح الآن .. أقرب وقت متاح ${DAYS_AR[dayIndex]} ${time}`,
    en: `Ordering is currently unavailable. Next available time: ${DAYS_EN[dayIndex]} ${time}`,
  };
}
