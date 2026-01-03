// AntiCheat logger (arquitectura)
// Objetivo: tener un punto único de logging y un buffer en memoria.

function nowMs() {
	return Date.now();
}

/**
 * @param {{ config?: any }} options
 */
export function createAntiCheatLogger(options) {
	const config = options && options.config ? options.config : {};
	const logging = config && config.logging ? config.logging : {};
	const maxBuffer = Math.max(50, Number(logging.bufferSize != null ? logging.bufferSize : 250));
	const consoleEnabled = Boolean(logging.console != null ? logging.console : true);

	/** @type {any[]} */
	const buffer = [];

	function push(entry) {
		buffer.push(entry);
		if (buffer.length > maxBuffer) buffer.splice(0, buffer.length - maxBuffer);
	}

	function format(entry) {
		const checkId = entry.checkId != null ? entry.checkId : "?";
		const base = `[ac] ${entry.level.toUpperCase()} check=${checkId}`;
		const playerPart = entry.playerName ? ` player=${entry.playerName}` : "";
		const msg = entry.message ? ` msg=${entry.message}` : "";
		return `${base}${playerPart}${msg}`;
	}

	function log(level, payload) {
		const p = payload || {};
		const playerName = p.player && p.player.name ? p.player.name : p.playerName != null ? p.playerName : null;
		const entry = {
			ts: nowMs(),
			level,
			checkId: p.checkId != null ? p.checkId : null,
			playerName: playerName,
			message: p.message != null ? p.message : p.reason != null ? p.reason : null,
			data: p.data != null ? p.data : p.details != null ? p.details : null,
		};

		push(entry);
		if (consoleEnabled) {
			try {
				if (level === "error") console.error(format(entry));
				else if (level === "warn") console.warn(format(entry));
				else console.log(format(entry));
			} catch (e) {
				void e;
				// ignore
			}
		}
	}

	return {
		log,
		debug(payload) {
			log("debug", payload);
		},
		info(payload) {
			log("info", payload);
		},
		warn(payload) {
			log("warn", payload);
		},
		error(payload) {
			log("error", payload);
		},
		getBuffer() {
			return buffer.slice();
		},
	};
}
