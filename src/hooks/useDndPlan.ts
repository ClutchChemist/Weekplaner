import type { DragEndEvent } from "@dnd-kit/core";
import type { Dispatch, SetStateAction } from "react";
import { addMinutesToHHMM, splitTimeRange, weekdayShortDE } from "../utils/date";
import type { CalendarEvent as Session, Player, WeekPlan } from "../state/types";

export function useDndPlan(params: {
	weekPlan: WeekPlan;
	setWeekPlan: Dispatch<SetStateAction<WeekPlan>>;
	players: Player[];
	setPlayers: Dispatch<SetStateAction<Player[]>>;
	setLastDropError: (msg: string | null) => void;
	sortParticipants: (a: string, b: string) => number;
	removePlayerFromSession: (sessionId: string, playerId: string) => void;
	sessionsOverlap: (a: Session, b: Session) => boolean;
	isGameSession: (s: Session) => boolean;
	t: (key: string) => string;
	tf: (key: string, vars?: Record<string, string | number>) => string;
	confirm: (title: string, message: string) => Promise<boolean>;
}) {
	const {
		weekPlan,
		setWeekPlan,
		players,
		setPlayers,
		setLastDropError,
		sortParticipants,
		removePlayerFromSession,
		sessionsOverlap,
		isGameSession,
		t,
		tf,
		confirm,
	} = params;

	function requiresTaForTeams(teams: string[]): boolean {
		return teams.some((team) => team === "U18" || team === "HOL" || team === "1RLH");
	}

	function isGameInfo(info: string | null | undefined): boolean {
		const value = String(info ?? "").trim().toLowerCase();
		return value.startsWith("vs") || value.startsWith("@") || value.includes(" vs ") || value.includes(" @ ");
	}

	function addPlayerToSession(sessionId: string, playerId: string) {
		setWeekPlan((prev) => ({
			...prev,
			sessions: prev.sessions.map((session) => {
				if (session.id !== sessionId) return session;
				const current = session.participants ?? [];
				if (current.includes(playerId)) return session;
				const next = [...current, playerId].sort(sortParticipants);
				return { ...session, participants: next };
			}),
		}));
	}

	function onDragStart(_event: unknown) {
		// reserved for future hover/preview behavior; kept for parity hook contract
	}

	function onDragOver(_event: unknown) {
		// reserved for future hover/preview behavior; kept for parity hook contract
	}

	async function onDragEnd(event: DragEndEvent) {
		const over = event.over;
		if (!over) return;

		const activeType = event.active.data.current?.type;
		const overType = over.data.current?.type;

		if (activeType === "player" && overType === "session") {
			const playerId = String(event.active.data.current?.playerId || "");
			const sessionId = String(over.data.current?.sessionId || "");
			if (!playerId || !sessionId) return;

			const target = weekPlan.sessions.find((session) => session.id === sessionId);
			if (!target) return;

			const overlaps = weekPlan.sessions.filter((session) => {
				if (session.id === target.id) return false;
				if (!(session.participants ?? []).includes(playerId)) return false;
				return sessionsOverlap(session, target);
			});

			if (overlaps.length) {
				const labelA = `${target.day} ${target.date} ${target.time}`;
				const labelB = overlaps.map((x) => `${x.day} ${x.date} ${x.time}`).join(" | ");
				setLastDropError(`Konflikt: Spieler ist bereits in überschneidenden Events (${labelB}). Ziel: ${labelA}`);
				return;
			}

			const targetIsGame = isGameSession(target);
			if (targetIsGame && requiresTaForTeams(target.teams)) {
				const player = players.find((p) => p.id === playerId);
				if (player && !player.taNumber) {
					const input = window.prompt(
						tf("promptTaNumber", { playerName: player.name, teams: target.teams.join("·") })
					);
					if (input === null) return;
					if (input.trim() === "") {
						const remove = await confirm("Spieler entfernen?", t("confirmRemovePlayerFromGame"));
						if (!remove) return;
						removePlayerFromSession(sessionId, playerId);
						return;
					}

					setPlayers((prev) =>
						prev.map((p) => (p.id === playerId ? { ...p, taNumber: input.trim() } : p))
					);
				}
			}

			setLastDropError(null);
			addPlayerToSession(sessionId, playerId);
			return;
		}

		if (activeType === "calendarEvent" && overType === "calendarSlot") {
			const sessionId = String(event.active.data.current?.sessionId || "");
			const date = String(over.data.current?.date || "");
			const startMin = Number(over.data.current?.startMin ?? NaN);
			if (!sessionId || !date || !Number.isFinite(startMin)) return;

			const session = weekPlan.sessions.find((s) => s.id === sessionId);
			if (!session) return;

			const info = (session.info ?? "").trim();
			const game = isGameInfo(info);
			const tr = splitTimeRange(session.time ?? "");
			let duration = 90;
			if (game) {
				duration = 120;
			} else if (tr) {
				const [st, en] = tr;
				const sM = parseInt(st.slice(0, 2), 10) * 60 + parseInt(st.slice(3, 5), 10);
				const eM = parseInt(en.slice(0, 2), 10) * 60 + parseInt(en.slice(3, 5), 10);
				duration = Math.max(0, eM - sM) || 90;
			}

			const hh = String(Math.floor(startMin / 60)).padStart(2, "0");
			const mm = String(startMin % 60).padStart(2, "0");
			const newStart = `${hh}:${mm}`;
			const newEnd = addMinutesToHHMM(newStart, duration);
			const newTime = `${newStart}–${newEnd}`;

			setWeekPlan((prev) => {
				const nextSessions = prev.sessions.map((s) => {
					if (s.id !== sessionId) return s;
					return {
						...s,
						date,
						day: weekdayShortDE(date),
						time: newTime,
					};
				});
				nextSessions.sort((a, b) => {
					const ad = a.date.localeCompare(b.date);
					if (ad !== 0) return ad;
					return a.time.localeCompare(b.time);
				});
				return { ...prev, sessions: nextSessions };
			});
			return;
		}

		if (activeType === "calendarResize" && overType === "calendarSlot") {
			const sessionId = String(event.active.data.current?.sessionId || "");
			const date = String(over.data.current?.date || "");
			const endMin = Number(over.data.current?.startMin ?? NaN);
			if (!sessionId || !date || !Number.isFinite(endMin)) return;

			const session = weekPlan.sessions.find((s) => s.id === sessionId);
			if (!session) return;
			if (session.date !== date) return;

			const info = (session.info ?? "").trim();
			if (isGameInfo(info)) return;

			const tr = splitTimeRange(session.time ?? "");
			if (!tr) return;
			const [st] = tr;
			const startMin = parseInt(st.slice(0, 2), 10) * 60 + parseInt(st.slice(3, 5), 10);

			const newEndMin = Math.max(startMin + 30, endMin);
			const hh = String(Math.floor(startMin / 60)).padStart(2, "0");
			const mm = String(startMin % 60).padStart(2, "0");
			const newStart = `${hh}:${mm}`;
			const newEnd = addMinutesToHHMM(newStart, newEndMin - startMin);
			const newTime = `${newStart}–${newEnd}`;

			setWeekPlan((prev) => {
				const nextSessions = prev.sessions.map((s) => (s.id === sessionId ? { ...s, time: newTime } : s));
				nextSessions.sort((a, b) => {
					const ad = a.date.localeCompare(b.date);
					if (ad !== 0) return ad;
					return a.time.localeCompare(b.time);
				});
				return { ...prev, sessions: nextSessions };
			});
			return;
		}

		if (activeType === "calendarPreBlock" && overType === "calendarSlot") {
			const sessionId = String(event.active.data.current?.sessionId || "");
			const kind = String(event.active.data.current?.kind || "");
			const date = String(over.data.current?.date || "");
			const startMin = Number(over.data.current?.startMin ?? NaN);
			if (!sessionId || !kind || !date || !Number.isFinite(startMin)) return;

			const session = weekPlan.sessions.find((s) => s.id === sessionId);
			if (!session) return;
			if (session.date !== date) return;

			const tr = splitTimeRange(session.time ?? "");
			if (!tr) return;
			const [st] = tr;
			const sessStartMin = parseInt(st.slice(0, 2), 10) * 60 + parseInt(st.slice(3, 5), 10);

			let minutes = 0;
			if (kind === "TRAVEL") {
				const warm = Math.max(0, Math.floor(Number(session.warmupMin ?? 0)));
				const travelEnd = sessStartMin - warm;
				minutes = Math.max(0, travelEnd - startMin);
			} else {
				minutes = Math.max(0, sessStartMin - startMin);
			}
			minutes = Math.min(240, minutes);
			minutes = Math.round(minutes / 5) * 5;

			setWeekPlan((prev) => {
				const nextSessions = prev.sessions.map((s) => {
					if (s.id !== sessionId) return s;
					if (kind === "TRAVEL") return { ...s, travelMin: minutes };
					if (kind === "WARMUP") return { ...s, warmupMin: minutes };
					return s;
				});
				return { ...prev, sessions: nextSessions };
			});
		}
	}

	return { onDragStart, onDragOver, onDragEnd };
}
