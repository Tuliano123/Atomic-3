// AntiCheat registry (solo arquitectura)

export class AntiCheatRegistry {
	constructor() {
		/** @type {Map<string, any>} */
		this._checksById = new Map();
	}

	/**
	 * @param {{ id: string }} check
	 */
	register(check) {
		if (!check || !check.id) throw new Error("AntiCheat check missing id");
		if (this._checksById.has(check.id)) throw new Error(`Duplicate AntiCheat check id: ${check.id}`);
		this._checksById.set(check.id, check);
	}

	/**
	 * Llama init/start de cada check, sin imponer implementación.
	 * @param {any} ctx
	 */
	startAll(ctx) {
		for (const check of this._checksById.values()) {
			try {
				if (check && typeof check.init === "function") check.init(ctx);
				if (check && typeof check.start === "function") check.start(ctx);
			} catch (e) {
				// Por ahora, solo estructura: no hacemos enforcement ni logging complejo.
				// Se implementará un logger central más adelante.
			}
		}
	}

	getAll() {
		return Array.from(this._checksById.values());
	}
}
