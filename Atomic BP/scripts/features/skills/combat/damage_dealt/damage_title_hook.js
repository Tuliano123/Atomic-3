// Hook de integracion: permite que `combat/damage_title` se suscriba
// al evento de dano real sin acoplar dependencias circulares.

/** @type {(payload: any) => void | null} */
let handler = null;

export function setDamageTitleEmitter(fn) {
	handler = typeof fn === "function" ? fn : null;
}

export function emitDamageTitle(payload) {
	try {
		if (handler) handler(payload);
	} catch (e) {
		void e;
	}
}
