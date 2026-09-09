/* GENERATED FROM functions/upkeep-policy.json — DO NOT EDIT.

   Change a number in that file and run `npm run verify`, which regenerates this
   and fails if the two have drifted. The policy decides what gets deleted, and
   two copies of it disagreeing would show up as missing rows months later
   rather than as an error. */

export const UPKEEP_POLICY = Object.freeze({
    "rotations": [
      {
        "key": "user_activity_daily_v1",
        "dateFields": [
          "date"
        ],
        "maxAgeDays": 400,
        "maxBytes": 409600,
        "label": "Staff activity / نشاط الموظفين",
        "why": "Older than 400 days, and no report reads that far back."
      },
      {
        "key": "department_request_notifications_v1",
        "dateFields": [
          "createdAt"
        ],
        "maxAgeDays": 180,
        "maxBytes": 307200,
        "label": "Department notifications / إشعارات الأقسام",
        "why": "Delivered notices older than 180 days; the deletion audit keeps the record itself."
      }
    ],
    "mergeHistories": [
      {
        "key": "inventory_name_merge_history",
        "maxBytes": 307200
      },
      {
        "key": "manual_medicine_merge_history_v1",
        "maxBytes": 307200
      }
    ],
    "crashReportLiveMonths": 6
  });

export const ROTATION_POLICIES = UPKEEP_POLICY.rotations;
export const MERGE_HISTORY_POLICIES = UPKEEP_POLICY.mergeHistories;
export const CRASH_REPORT_LIVE_MONTHS = UPKEEP_POLICY.crashReportLiveMonths;

Object.assign(globalThis, { UPKEEP_POLICY });
