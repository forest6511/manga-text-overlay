/**
 * API使用量ガード
 * 月間の画像生成回数を制限して予算超過を防止
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USAGE_FILE = path.join(__dirname, "..", ".usage_count.json");

// 月間上限（¥1,000 ÷ ¥20/枚 = 50枚）
const MONTHLY_LIMIT = 50;

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function loadUsage() {
  try {
    const data = JSON.parse(fs.readFileSync(USAGE_FILE, "utf-8"));
    return data;
  } catch {
    return { month: getCurrentMonth(), count: 0 };
  }
}

function saveUsage(usage) {
  fs.writeFileSync(USAGE_FILE, JSON.stringify(usage, null, 2));
}

export function checkUsage() {
  const usage = loadUsage();
  const currentMonth = getCurrentMonth();

  // 月が変わったらリセット
  if (usage.month !== currentMonth) {
    usage.month = currentMonth;
    usage.count = 0;
  }

  if (usage.count >= MONTHLY_LIMIT) {
    console.error(`\n🚫 月間上限に達しました (${usage.count}/${MONTHLY_LIMIT}枚)`);
    console.error(`   予算: ¥1,000 / 月`);
    console.error(`   リセット: 来月1日`);
    process.exit(1);
  }

  console.log(`📊 今月の使用量: ${usage.count}/${MONTHLY_LIMIT}枚 (残り${MONTHLY_LIMIT - usage.count}枚)`);
}

export function recordUsage() {
  const usage = loadUsage();
  const currentMonth = getCurrentMonth();

  if (usage.month !== currentMonth) {
    usage.month = currentMonth;
    usage.count = 0;
  }

  usage.count++;
  saveUsage(usage);
  console.log(`📊 使用量更新: ${usage.count}/${MONTHLY_LIMIT}枚`);
}
