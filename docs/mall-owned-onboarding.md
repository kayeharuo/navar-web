# One-time onboarding belongs to the mall

Applied database changes 56–58 on November 23, 2026.

- `mall_onboarding.mall_id` identifies the mall's one-time onboarding record.
- `mall_onboarding.onboarding_fee_cent` stores its one-time fee independently of subscriptions; quote-backed onboarding reads the same amount from `onboarding_quote`.
- `contract_payment_request` retains onboarding payment requests, references, dates and amounts with `mall_id` populated and `contract_id = NULL`.
- Historical `payment` receipts now also have `mall_id`; onboarding receipts have no contract link. Existing wallet links and payment amounts are preserved.
- `contract` contains subscription terms only. The first paid subscription creates a contract with subscription dates; onboarding payment never starts or modifies a subscription.
- A unique index prevents multiple settled onboarding requests for the same mall.

For compatibility, the deprecated `mall_onboarding.contract_id` column remains but must always be NULL. The deprecated `contract.contract_onboarding_fee` remains but must always be zero. Callers should find a subscription using `contract.mall_id` and `contract_is_current`, never through onboarding. Existing started contract IDs/versions, term dates, annual fees and payment history were preserved.

Removed onboarding-only contracts 4 (Ayala Malls Central Bloc), 5 (SM J Mall), 13 (Gaisano Grand Mall Minglanilla) and 14 (Gaisano Fiesta Mall). Original contract snapshots, including former onboarding-fee values, are retained privately in `app_private.onboarding_contract_archive`. No AR status was changed.

The current and legacy provisioning, onboarding retrieval, consent, checkout and settlement adapters were updated. Legacy tier preference changes do not change the one-time onboarding amount or create contracts. Subscription publication no longer writes a contract back into onboarding. Real subscription creation/renewal continues through the existing payment and publication checks.

Changes 56 and 57 were applied atomically as `mall_owned_onboarding_and_adapters`; apply both together when deploying elsewhere. Change 58 preserves direct mall ownership in legacy payment notification monitoring. Change 59 keeps legacy manual settlement restricted to trusted backend access; browser clients use the current authenticated payment endpoints.

Validation includes cleanup/payment ownership and duplicate-payment tests, the full onboarding → approval → annual payment → Live subscription flow with zero contracts after onboarding, and rolled-back live checks of existing Mall Admin onboarding retrieval. Both previously Live AR developments (17 and 20) remain Live.
