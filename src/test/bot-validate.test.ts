import { describe, it, expect } from "vitest";
import { validateBot, failedChecks } from "@/lib/bot-validate";

const good = `
BOT_TOKEN = os.environ["BOT_TOKEN"]
ADMIN_ID = int(os.environ["ADMIN_ID"])
def menu(): return ReplyKeyboardMarkup([[rk_btn("🛍 দোকান","main.shop")]])
async def text(u,c):
    t = u.message.text
    if "দোকান" in t: pass
    if u.effective_user.id == ADMIN_ID: pass
app.add_handler(CommandHandler("start", start))
`;

describe("validateBot", () => {
  it("passes a correct bot", () => {
    expect(failedChecks(validateBot(good, "python-telegram-bot>=22.7"))).toEqual([]);
  });
  it("fails old python-telegram-bot", () => {
    expect(failedChecks(validateBot(good, "python-telegram-bot>=20.0")).map((c) => c.id)).toEqual(["ptb"]);
  });
  it("fails hardcoded token", () => {
    const bad = good + '\nX = "123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsawABCD"';
    expect(failedChecks(validateBot(bad, "python-telegram-bot>=22.7")).map((c) => c.id)).toContain("secrets");
  });
  it("fails unrouted menu label", () => {
    const bad = good.replace('rk_btn("🛍 দোকান","main.shop")', 'rk_btn("🛍 দোকান","main.shop"), rk_btn("📦 অর্ডার","main.orders")');
    expect(failedChecks(validateBot(bad, "python-telegram-bot>=22.7")).map((c) => c.id)).toEqual(["menu"]);
  });
});
