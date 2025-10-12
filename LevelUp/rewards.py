from dataclasses import dataclass

@dataclass
class RewardOutcome:
    xp: int
    coins: int
    unlocks: list

def compute_rewards(meta: dict) -> RewardOutcome:
    """
    meta proviene del juego: hits/misses/moves/time/combo/found/etc.
    """
    base_xp = 40
    correct = int(meta.get("hits", meta.get("found", 0)) or 0)
    combo = int(meta.get("combo", 0) or 0)
    speed_bonus = max(0, 10 - int(meta.get("time", 0)) // 30) * 2
    xp = base_xp + correct * 8 + combo * 3 + speed_bonus
    coins = 5 + correct // 2 + combo // 3
    unlocks = []
    # ejemplo de desbloqueos
    if combo >= 3:
        unlocks.append("gafas_azules")
    if correct >= 5:
        unlocks.append("mochila_lvl1")
    return RewardOutcome(xp=xp, coins=coins, unlocks=unlocks)

def apply_rewards(estudiante, outcome: RewardOutcome):
    pre_lvl = estudiante.nivel()
    estudiante.add_xp(outcome.xp)
    estudiante.add_coins(outcome.coins)
    for k in outcome.unlocks:
        if k not in estudiante.accesorios_desbloqueados:
            estudiante.accesorios_desbloqueados.append(k)
    estudiante.equip_default_if_empty()
    estudiante.save()
    return {"level_up": estudiante.nivel() > pre_lvl}
