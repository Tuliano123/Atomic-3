import { world } from "@minecraft/server";

function normalizeParticipantName(name) {
	// Quita códigos de formato §x (por si algún displayName viene coloreado) y normaliza.
	return String(name ?? "")
		.replace(/§./g, "")
		.trim()
		.toLowerCase();
}

/**
 * @param {string} objectiveId
 * @param {string} participant
 * @param {number} missingValue
 * @param {{ enabled: boolean, log: (msg: string) => void, shouldLog: () => boolean } | null} debug
 */
export function getScoreBestEffort(objectiveId, participant, missingValue, debug = null) {
	try {
		if (!world || !world.scoreboard || typeof world.scoreboard.getObjective !== "function") return missingValue;
		const obj = world.scoreboard.getObjective(String(objectiveId));
		if (!obj) {
			if (debug && debug.enabled && debug.shouldLog()) debug.log(`objective '${String(objectiveId)}' no existe`);
			return missingValue;
		}

		let participantName = String(participant);
		let forceFake = false;
		// Escape hatch para evitar colisiones con jugadores online:
		// ${obj:!Anthe4743} fuerza "fake participant" (string) aunque exista un jugador llamado Anthe4743.
		if (participantName.startsWith("!")) {
			forceFake = true;
			participantName = participantName.slice(1).trim();
		}

		// 1) Jugadores reales (online): si el nombre coincide, preferimos identity.
		// Motivo: en Bedrock, /scoreboard players set <nombreJugadorOnline> suele crear/usar una entrada identity,
		// y obj.getScore(string) puede devolver 0 aunque el identity tenga un valor distinto.
		let matchedPlayer = null;
		try {
			if (!forceFake) {
			const want = participantName.toLowerCase();
			for (const p of world.getPlayers()) {
				if (!p || typeof p.name !== "string") continue;
				if (p.name === participantName || p.nameTag === participantName || p.name.toLowerCase() === want) {
					matchedPlayer = p;
					break;
				}
			}
			}
		} catch (e) {
			void e;
		}

		if (matchedPlayer) {
			try {
				const id = matchedPlayer.scoreboardIdentity;
				if (id) {
					const iv = obj.getScore(id);
					if (typeof iv === "number" && Number.isFinite(iv)) return iv;
					if (debug && debug.enabled && debug.shouldLog()) debug.log(`getScore(identity) '${objectiveId}' '${matchedPlayer.name}' => ${String(iv)}`);
				}
			} catch (e) {
				void e;
			}
			try {
				const pv = obj.getScore(matchedPlayer);
				if (typeof pv === "number" && Number.isFinite(pv)) return pv;
				if (debug && debug.enabled && debug.shouldLog()) debug.log(`getScore(player) '${objectiveId}' '${matchedPlayer.name}' => ${String(pv)}`);
			} catch (e) {
				void e;
			}
		}

		// 2) "Fake players" (string) - útil para participantes no-identity.
		const v = obj.getScore(participantName);
		if (typeof v === "number" && Number.isFinite(v)) {
			// Si se forzó fake, respetamos el 0.
			// Si NO se forzó, un 0 puede ser un "placeholder" del path string mientras el score real vive en identity.
			if (forceFake || v !== 0) return v;
		}
		if (debug && debug.enabled && debug.shouldLog()) {
			debug.log(`getScore(string) '${objectiveId}' '${participantName}' (forceFake=${String(forceFake)}) => ${String(v)}`);
		}

		// 3) Fallback recomendado: participantes del objective (ScoreboardIdentity)
		try {
			if (typeof obj.getParticipants === "function") {
				const want = normalizeParticipantName(participantName);
				const parts = obj.getParticipants();
				if (debug && debug.enabled && debug.shouldLog()) debug.log(`getParticipants() count=${parts.length} want='${want}'`);
				for (const part of parts) {
					if (!part) continue;
					let displayName = "";
					try {
						if (typeof part.displayName === "string") displayName = part.displayName;
						else if (typeof part.getDisplayName === "function") displayName = part.getDisplayName();
					} catch (e) {
						void e;
					}
					if (!displayName) continue;
					if (normalizeParticipantName(displayName) !== want) continue;
					const sv = obj.getScore(part);
					if (typeof sv === "number" && Number.isFinite(sv)) return sv;
					if (debug && debug.enabled && debug.shouldLog()) debug.log(`match participant '${displayName}' pero score inválido => ${String(sv)}`);
				}
			}
		} catch (e) {
			void e;
		}

		// 4) Fallback universal: escanear scores si la versión lo soporta
		try {
			if (typeof obj.getScores === "function") {
				const want = normalizeParticipantName(participantName);
				const scores = obj.getScores();
				if (debug && debug.enabled && debug.shouldLog()) debug.log(`getScores() count=${scores.length} want='${want}'`);
				for (const info of scores) {
					if (!info) continue;
					const score = info.score;
					if (typeof score !== "number" || !Number.isFinite(score)) continue;
					const identity = info.participant;
					let displayName = "";
					try {
						if (identity && typeof identity.displayName === "string") displayName = identity.displayName;
						else if (identity && typeof identity.getDisplayName === "function") displayName = identity.getDisplayName();
					} catch (e) {
						void e;
					}
					if (!displayName) continue;
					if (normalizeParticipantName(displayName) === want) return score;
				}
			}
		} catch (e) {
			void e;
		}

		return missingValue;
	} catch (e) {
		void e;
		if (debug && debug.enabled && debug.shouldLog()) debug.log(`excepción resolviendo score: ${String(e)}`);
		return missingValue;
	}
}
