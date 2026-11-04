import type { Messages } from "../types";

/**
 * 繁體中文 catalogue - authored, not translated (docs/ux/feedback-microcopy.md#localization-integrity).
 *
 * 語氣:第二人稱「你」,平實、溫暖、不煽情,不用驚嘆號。醫療轉介句是唯一例外,改用「您」,因為那是臨床語氣
 * 而不是教練語氣 - 這個例外寫在 docs/ux/feedback-microcopy.md,不是失誤。
 */
export const zhHant: Messages = {
  comment: {
    "acknowledge.completed": "今天記錄了 {km} 公里。",
    "acknowledge.partial": "今天記為部分完成 —— 這是一個答案,不是零。",
    "acknowledge.alternate": "你選了替代方案,這份訓練算數。",
    "acknowledge.rest": "休息日按計畫完成。",
    "acknowledge.skipped": "{kind}課表今天跳過了。",
    "interpret.effort-gap": "自覺努力比計畫高 {gap} 分。",
    "interpret.legs-heavy": "腿部回饋 {legs}/{scale},所以明天調輕。",
    "interpret.sleep-short": "睡眠不足是明天調輕的原因之一。",
    "interpret.extra-subtracts": "額外的活動會算在下一個強度日之前,不會變成加分。",
    "interpret.pain-reported": "疼痛位置在 {site},{intensity}/{scale} —— 明天的調整就是回應它。",
    "redirect.tomorrow-kept": "明天照原訂計畫。",
    "redirect.tomorrow-downgraded": "明天比原訂輕鬆,卡片上會寫改了什麼。",
    "redirect.tomorrow-swapped": "強度課移到{weekday}。",
    "redirect.safety-instruction": "{instruction}",
    "redirect.review-offered": "這個週期的結構值得重新檢視,我可以把選項列給你看。",
    "redirect.nudge-unlogged": "今天還沒有紀錄 —— 填自覺努力和腿部感受就夠了。",
  },
  reason: {
    "missed-quality-moved": "強度課移到最近可行的時段({weekday})",
    "extra-activity-guard": "額外活動離強度日太近",
    "readiness-downgrade": "今天的回饋偏重",
    "illness-hold": "你回報了身體不適",
    "pain-hold": "疼痛在升溫",
  },
  cost: {
    "easy-day-becomes-quality": "輕鬆跑那天變成強度日",
    "quality-becomes-easy": "這週的強度課改成輕鬆跑",
    "no-intensity-this-week": "接下來一週不跑強度",
  },
  stop: {
    "chest-urgent": "請停止訓練,胸部症狀需要立即就醫評估。",
    "illness-hold": "今天請先不要訓練。症狀消失且不用藥後再等 48 小時,再由輕鬆跑開始。",
    "bone-referral": "請停止跑步,在下一次訓練前讓臨床醫生評估這個疼痛。",
    "pain-hold": "今天請不要帶著這個疼痛跑;下一次訓練前需要醫生的意見。",
  },
  explain: {
    "explain.summary": "{weeks} 週共 {sessions} 次訓練,合計 {km} 公里。",
    "explain.week-one": "{weekday}起的一週:{km} 公里,強度日 {hard} 次。",
    "explain.week-many": "{weekday}起的一週:{km} 公里,強度日 {hard} 次。",
    "explain.partial": "第一週是不完整的一週:{days} 天共 {km} 公里,換算成整週是 {rate} 公里。",
    "explain.peak": "最高量的一週 {km} 公里,最長一次 {long} 公里。",
  },
  weekday: { Mon: "週一", Tue: "週二", Wed: "週三", Thu: "週四", Fri: "週五", Sat: "週六", Sun: "週日" },
  kind: {
    rest: "休息",
    recovery: "恢復跑",
    easy: "輕鬆跑",
    strides: "加速跑",
    long: "長跑",
    hills: "坡跑",
    tempo: "節奏跑",
    vo2max: "VO2max ",
    mp: "馬拉松配速",
    "cross-training": "交叉訓練",
    strength: "肌力",
    test: "測試",
    race: "比賽",
  },
  label: {
    changedBecause: "改了,因為",
    gaveUp: "代價:",
    nudge: "記錄今天",
  },
};
