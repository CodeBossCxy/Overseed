# Overseed Pricing Plan v3 — Full Report

Date: 2026-09-03
Status: **Numbers final, implementation ON HOLD**
Assumptions: FX 7.2 CNY/USD · influencers.club (IC) credit = $0.60 · blended AI cost ¥0.04/Overseed-credit

---

## 1. Tier structure

| | **Free** | **Campaign Plus** | **Outreach Plus** | **Pro** |
|---|---|---|---|---|
| 价格 | ¥0 | ¥69/月 | **¥109/月** | ¥199/月 |
| 适合谁 | 轻度体验 | 主要等达人报名 | 主要主动找达人 | 两种方式都高频使用 |
| Service Fee | 8% | 5% | 5% | 5% |
| Team Seats | 1 | 1 | 1 | 1 |
| **CAMPAIGNS** | | | | |
| 每日活动数 | 1 不累积 | 5 可累积 上限30 | 5 可累积 上限30 | 10 可累积 上限50 |
| Active Campaigns | 1 | 50 | 10 | 80 |
| Creator Applications | 不限 | 不限 | 不限 | 不限 |
| 每日新对话数 | 10 | 50 | 20 | 50 |
| 与报名/合作中达人沟通 | 不限 | 不限 | 不限 | 不限 |
| **DISCOVERY & OUTREACH** | | | | |
| Creator Discovery（搜索次数，10 results/次） | 5/月 | 50/月 | 80/月 | 150/月 |
| Creator Profile View | 12 credits/次（从AI Credits扣） | 同左 | 同左 | 同左 |
| Advanced Analytics | — | 1/月 | 3/月 | 6/月 |
| Managed Outreach（全自动化） | — | 5/月 | 15/月 | 30/月 |
| Saved Creators / 重复访问已查看达人 | 不限 | 不限 | 不限 | 不限 |
| **AI CREDITS** | | | | |
| AI Credits | 20/月 | 100/月 | 100/月 | 250/月 |
| Translation | 免费不限 | 免费不限 | 免费不限 | 免费不限 |
| 额外购买Credits | ✓ | ✓ | ✓ | ✓ |

Note: discovery quotas assume IC base rate (0.01 cr/creator). If keyword search bills at premium rate (0.03), revert quotas to 20/30/60.

统一额度原则：所有 AI 功能与达人数据（搜索超额 6 / 主页查看 12 / 深度分析 45）共用同一 Credits 余额；月度配额内免费，超出后按价目表扣除（无独立 CNY add-on SKU）。

---

## 2. Credit deduction table (1 credit ≈ ¥0.10 face value)

| Action | Credits | Real cost | Margin |
|---|---|---|---|
| AI Chat — Standard (Kimi / DeepSeek) | 1 | ¥0.014 | ~86% |
| AI Chat — Advanced (GPT-5.6 / Claude Sonnet 5) | 3 | ¥0.18 | ~40% |
| AI Image — Standard (gpt-image-2, 1024, medium) | 4 | ¥0.29 | ~28% |
| Discovery Search 超出月度配额后（每次返回10位达人） | 6 | ¥0.43 | ~28% |
| Creator Profile View — 按达人计 (IC enrich, incl. validated email) | 12 | ¥0.86 | ~28% |
| Creator Analytics — 按达人计（超出月度配额，含lookalikes） | 45 | ¥3.46 | ~23% |
| Translation | 免费 | ~¥0 | — |
| Doc export (Word / Excel / PDF) | 免费 | ¥0 | — |
| *Future:* Campaign Brief 生成 | 5 | — | — |
| *Future:* 文案生成/重写 | 3 | — | — |
| *Future:* Image Edit / High-Quality Image | 6 / 20 | — | — |

---

## 3. Purchasable credit add-on packs

| Pack | 价格 | Credits | ¥/credit | 定位 |
|---|---|---|---|---|
| **Mini**（新增） | ¥9.9 | 60 | ¥0.165 | 冲动购买 / Free用户转化 |
| **Starter** | ¥29 | 240 | ¥0.121 | 轻度补充 |
| **Standard** | ¥99 | 880 | ¥0.113 | 主力包 |
| **Pro** | ¥199 | **1,800**（原2,000，下调保margin） | ¥0.111 | 重度用户 |

### Value anchors（购买页展示用）

| Pack | 标准对话 | 高级对话 | AI图片 | 达人主页查看 | 深度分析 |
|---|---|---|---|---|---|
| Mini 60 | 60 | 20 | 15 | 5 | 1 |
| Starter 240 | 240 | 80 | 60 | 20 | 5 |
| Standard 880 | 880 | ~293 | 220 | ~73 | ~19 |
| Pro 1,800 | 1,800 | 600 | 450 | 150 | 40 |

### Pack margins（全额消耗）

| Pack | Blended mix | Worst case（全部用于查看/分析） |
|---|---|---|
| Mini | 76% | 53% |
| Starter | 67% | 36% |
| Standard | 65% | 32% |
| Pro | 64% | 31% |

### Pack rules
1. 扣减顺序：先扣月度赠送credits，再扣购买credits
2. 购买credits不随月清零（12个月有效期）；月度赠送credits不结转
3. 折扣曲线平缓（¥0.165→¥0.111），避免大包冲击订阅价值
4. Mini包在用户撞到credit墙时即时弹出（转化杠杆）
5. 购买UI用成果锚定（"≈X位达人查看 / X张图"）而非裸credit数

---

## 4. Unit cost basis

| Unit | IC credits | Cost |
|---|---|---|
| 搜索1次（返回10位创作者，base rate 0.01/位） | 0.1 | ¥0.43 |
| Profile enrichment（含验证邮箱） | 0.2 | ¥0.86 |
| Analytics（含lookalikes） | 0.8 | ¥3.46 |
| Analytics（不含lookalikes，备选） | 0.2 | ¥0.86 |
| AI credit（blended: 50%标准对话/30%高级/20%图片） | — | ¥0.04 |
| 支付手续费（~3% + ¥2） | — | ¥4.1 / ¥5.3 / ¥8.0 |

IC计费规则：仅成功返回数据时扣费；重复搜索会重复计费（**必须本地缓存搜索结果**）；premium filter搜索按0.03/位计费（替代而非叠加）。

---

## 5. Tier economics @ 100% quota utilization（floor，实际利用率40–70%时margin更高）

| | Free ¥0 | Campaign+ ¥69 | Outreach+ ¥109 | Pro ¥199 |
|---|---|---|---|---|
| Discovery（quota × ¥0.43） | ¥2.2 | ¥21.6 | ¥34.6 | ¥64.8 |
| Advanced Analytics（× ¥3.46） | — | ¥3.5 | ¥10.4 | ¥20.8 |
| Outreach email enrich（× ¥0.86） | — | ¥4.3 | ¥12.9 | ¥25.8 |
| AI credits blended（× ¥0.04） | ¥0.8 | ¥4.0 | ¥4.0 | ¥10.0 |
| 支付手续费 | — | ¥4.1 | ¥5.3 | ¥8.0 |
| **Total cost** | **¥3.0** | **¥37.5** | **¥67.2** | **¥129.4** |
| **Floor margin** | **−¥3.0** | **¥31.5（46%）** | **¥41.8（38%）** | **¥69.6（35%）** |

### 最坏情况（AI credits 全部用于最贵用途：达人查看/分析 ¥0.077/cr）

| | Free | Campaign+ | Outreach+ | Pro |
|---|---|---|---|---|
| **最坏总成本** | **¥3.7** | **¥41.2** | **¥70.9** | **¥138.7** |
| **最坏利润** | **−¥3.7** | **¥27.8（40%）** | **¥38.1（35%）** | **¥60.3（30%）** |

即使最坏情况，全部付费档位仍保 30%+ margin；实际利用率 40–70% 时真实成本约为满负荷的一半。

- Free tier: 每用户每月最多亏¥3.0（最坏¥3.7）；¥37 GMV（8%费率）即回本
- Managed Outreach人力成本上限：¥6.3 / ¥2.8 / ¥2.3 per outreach → **必须全自动化**（自动enrich邮箱 → Resend模板发送）
- 高级对话16K token极端回复为负margin（<1%请求）；建议max_tokens 16384→8192

---

## 5b. Annual plans（买10个月送2个月，~17% off）

| | Campaign Plus | Outreach Plus | Pro |
|---|---|---|---|
| 月付 | ¥69/月 | ¥109/月 | ¥199/月 |
| **年付** | **¥690/年** | **¥1,090/年** | **¥1,990/年** |
| 折合月价 | ¥57.5/月 | ¥90.8/月 | ¥165.8/月 |
| 优惠 | 省¥138 | 省¥218 | 省¥398 |
| Floor margin（blended 满负荷） | ¥21.5（37%） | ¥25.1（28%） | ¥39.3（24%） |
| Floor margin（最坏情况） | ¥17.8（31%） | ¥21.4（24%） | ¥30.0（18%） |

规则：
1. Credits与各项配额仍按月发放（不一次性发全年，防burst成本与滥用退款）
2. 提前取消按月价折算已用月份退款
3. 现有¥699.99年费PRO用户 → 平移至Campaign+年付¥690
4. 展示话术用"年付立省2个月"，不用百分比
5. 折扣不要深于送2个月（Pro最坏情况margin已至18%）

---

## 6. Migration & positioning notes

- 现有PRO用户（¥69.99/月）→ 平移至Campaign Plus（¥69），避免流失；重度用户自然升级
- Outreach Plus定¥109（由¥99上调）：floor margin 32%→38%
- 年费方案待定（现有Pro年费¥699.99需重新映射，建议各档≈10×月费）

---

## 7. Open items — verify before locking

- [ ] IC关键词搜索按base（0.01）还是premium（0.03）计费？— 最大成本变量，3倍差异
- [ ] 与IC谈判低于$0.60/credit的量价
- [ ] Lookalikes是否值4倍价（analytics 0.8 vs 0.2）
- [x] 年费定价 → 已定：¥690 / ¥1,090 / ¥1,990（见§5b）
- [ ] Outreach+每日新对话20 < Campaign+ 50，是否有意为之
- [ ] FX风险：CNY/USD超过8.0时复审

---

## 8. Implementation scope（待启动）

1. **Schema**: `SubscriptionTier` enum → FREE | CAMPAIGN_PLUS | OUTREACH_PLUS | PRO + migration；新增 `CreditBalance` + `CreditTransaction`（grant/purchase/deduction审计流水）
2. **PLAN_LIMITS** (`app/api/plan/usage/route.ts`)：重构为4档；新增discovery/analytics/outreach计数（现无任何计量）
3. **Credit扣减**：ai-chat（流结束后按模型档位扣1/3）、ai-image（调用前扣4，失败退还）、profile-view（扣12）、analytics-on-demand（扣45）；替换现有150K token检查
4. **AI端点解禁**：Free tier获得credits → 从`tier === 'PRO'`门禁改为credit余额检查
5. **月度发放**：按档位grant（20/100/100/250），不结转；购买credits单独记账12个月有效
6. **Stripe**: 3个订阅product + 4个credit pack product；webhook映射新enum
7. **UI**: 重建 `app/pricing/brand/page.tsx` 4列表格；credit购买页value anchors；i18n
8. **搜索缓存**：IC搜索结果本地缓存，避免重复计费

关键文件：`app/api/plan/usage/route.ts` · `app/pricing/brand/page.tsx` · `prisma/schema.prisma:95` · `app/api/ai-chat/route.ts` · `app/api/ai-image/route.ts` · `app/api/discovery/*`
