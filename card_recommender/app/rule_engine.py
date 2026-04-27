from typing import Any, Iterable


def calculate_reward(amount: float, rule: Any) -> float:
    if amount < rule.min_spend:
        return 0.0

    reward = amount * rule.reward_rate

    if rule.max_reward is not None:
        reward = min(reward, rule.max_reward)

    return round(reward, 2)


def recommend_best_card(
    amount: float,
    platform: str,
    category: str,
    user_card_ids: Iterable[int],
    rules: Iterable[Any],
):
    results = []

    user_card_ids = set(user_card_ids)

    for rule in rules:
        if rule.card_id not in user_card_ids:
            continue

        platform_match = rule.platform in [platform, "general"]
        category_match = rule.category in [category, "general"]

        if not platform_match or not category_match:
            continue

        reward = calculate_reward(amount, rule)

        results.append(
            {
                "card_id": rule.card_id,
                "bank_name": rule.card.bank_name,
                "card_name": rule.card.card_name,
                "reward": reward,
                "final_cost": round(amount - reward, 2),
                "description": rule.description,
            }
        )

    results.sort(key=lambda x: x["reward"], reverse=True)

    return results
