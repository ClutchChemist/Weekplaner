import type { Player } from "@/types";
import { primaryTna } from "@/state/playerMeta";

/**
 * Returns true if `player` matches the given search query.
 * Searches across name, teams, and TA number.
 */
export function matchesPlayerSearch(player: Player, query: string): boolean {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const text = [
        player.name,
        player.firstName,
        player.lastName,
        player.primaryYouthTeam,
        player.primarySeniorTeam,
        ...(player.defaultTeams ?? []),
        primaryTna(player),
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
    return text.includes(q);
}
