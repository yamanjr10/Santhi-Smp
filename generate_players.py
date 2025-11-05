import json
import os
from datetime import datetime
import nbtlib  # pip install nbtlib

# === CONFIG ===
STATS_FOLDER = "stats"
PLAYERDATA_FOLDER = "playerdata"
OUTPUT_FILE = "players.json"


# === HELPERS ===
def get_custom(stats, key):
    """Safely get a value from minecraft:custom."""
    return stats.get("minecraft:custom", {}).get(key, 0)


def ticks_to_minutes(ticks):
    """Convert Minecraft ticks (20 ticks = 1 second) to minutes."""
    return round(ticks / 20 / 60)


def cm_to_blocks(cm):
    """Convert centimeters to blocks (1 block = 1 meter = 100 cm)."""
    return round(cm / 100)


def get_total(stats_section):
    """Sum all numeric values in a given stats section."""
    return sum(stats_section.values()) if stats_section else 0


def calculate_aternos_distance(stats):
    """Aternos-style movement calculation (excludes fly, minecart, and mounts)."""
    get = lambda key: get_custom(stats, key)
    distances_cm = {
        "Distance Sprinted": get("minecraft:sprint_one_cm"),
        "Distance Walked": get("minecraft:walk_one_cm"),
        "Distance by Boat": get("minecraft:boat_one_cm"),
        "Distance Fallen": get("minecraft:fall_one_cm"),
        "Distance Swum": get("minecraft:swim_one_cm"),
        "Distance Walked on Water": get("minecraft:walk_on_water_one_cm"),
        "Distance Walked under Water": get("minecraft:walk_under_water_one_cm"),
        "Distance Crouched": get("minecraft:crouch_one_cm"),
        "Distance Climbed": get("minecraft:climb_one_cm"),
    }
    distances_blocks = {k: cm_to_blocks(v) for k, v in distances_cm.items()}
    total_blocks = sum(distances_blocks.values())
    distances_blocks["Total (blocks)"] = total_blocks
    return distances_blocks


# === PLAYERDATA PARSER ===
def load_names_and_health_from_playerdata(folder):
    """Reads all player names and last-known health from playerdata/*.dat files."""
    info = {}
    if not os.path.exists(folder):
        print(f"[WARN] Playerdata folder not found: {folder}")
        return info

    for file in os.listdir(folder):
        if not file.endswith(".dat"):
            continue
        uuid = os.path.splitext(file)[0]
        path = os.path.join(folder, file)
        try:
            nbt = nbtlib.load(path)
            name = None
            health = 0.0

            # Try to read name
            if "bukkit" in nbt:
                bukkit = nbt["bukkit"]
                if "player" in bukkit and "Name" in bukkit["player"]:
                    name = bukkit["player"]["Name"]
                elif "lastKnownName" in bukkit:
                    name = bukkit["lastKnownName"]
            if not name and "Name" in nbt:
                name = nbt["Name"]
            if not name:
                name = "Unknown"

            # Try to read health (always saved even when offline)
            if "Health" in nbt:
                health = float(nbt["Health"])
            elif "health" in nbt:
                health = float(nbt["health"])

            info[uuid] = {"name": str(name), "health": round(health / 2, 1)}  # convert to hearts

        except Exception as e:
            print(f"[WARN] Error reading {file}: {e}")

    print(f"[OK] Loaded {len(info)} players (name + health) from playerdata/")
    return info


# === MAIN PLAYER PARSER ===
def parse_player_stats(uuid, name, health, path):
    """Parse a single player's stats JSON file."""
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    stats = data.get("stats", {})
    mined = stats.get("minecraft:mined", {})
    used = stats.get("minecraft:used", {})
    killed = stats.get("minecraft:killed", {})

    # Basic stats
    playtime = ticks_to_minutes(get_custom(stats, "minecraft:play_time"))
    blocks_mined = get_total(mined)
    items_used = get_total(used)
    player_kills = get_custom(stats, "minecraft:player_kills")
    mob_kills = get_custom(stats, "minecraft:mob_kills")
    deaths = get_custom(stats, "minecraft:deaths")
    entities_killed = get_total(killed)
    jumps = get_custom(stats, "minecraft:jump")

    # Derived
    kdr = round(player_kills / deaths, 2) if deaths > 0 else float(player_kills)
    movement = calculate_aternos_distance(stats)
    distance_total = movement["Total (blocks)"]

    return {
        "uuid": uuid,
        "name": name or "Unknown",
        "playtime": playtime,
        "hearts": health if health is not None else "N/A",
        "blocksMined": blocks_mined,
        "distanceTraveled": distance_total,
        "playerKills": player_kills,
        "mobKills": mob_kills,
        "kills": player_kills,
        "deaths": deaths,
        "KDR": kdr,
        "itemsUsed": items_used,
        "entitiesKilled": entities_killed,
        "jumps": jumps,
        "lastSeen": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "movement": movement,
        "totals": {
            "Playtime": f"{playtime} min",
            "Blocks Mined": f"{blocks_mined:,}",
            "Distance Travelled (in blocks)": f"{distance_total:,}",
            "Kills": player_kills,
            "Deaths": deaths,
            "KDR": kdr,
            "Items Used": f"{items_used:,}",
            "Health (hearts)": health,
        },
    }


# === MAIN ===
def main():
    if not os.path.exists(STATS_FOLDER):
        print(f"[ERROR] Stats folder not found: {STATS_FOLDER}")
        return

    # Load names + health
    player_meta = load_names_and_health_from_playerdata(PLAYERDATA_FOLDER)
    players = []

    # Parse stats
    for file in os.listdir(STATS_FOLDER):
        if not file.endswith(".json"):
            continue
        uuid = os.path.splitext(file)[0]
        path = os.path.join(STATS_FOLDER, file)
        meta = player_meta.get(uuid, {"name": "Unknown", "health": 0})
        name = meta["name"]
        health = meta["health"]

        try:
            player = parse_player_stats(uuid, name, health, path)
            players.append(player)
            print(f"[OK] {name} ({uuid}) — {player['distanceTraveled']:,} blocks — ❤️ {health} hearts")
        except Exception as e:
            print(f"[WARN] Failed to parse {uuid}: {e}")

    # Export
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(players, f, indent=2)

    print(f"\n🎉 Done! Exported {len(players)} players with names + health to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
