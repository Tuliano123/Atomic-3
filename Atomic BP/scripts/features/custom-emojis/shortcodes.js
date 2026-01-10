// Shortcodes (prefixes) -> símbolo real.
//
// Regla:
// - Aquí solo van nombres “humanos” (ej: :skull:).
// - El reemplazo final siempre se hace por el mapping símbolo -> PUA (E3/E4),
//   así que si re-empacamos y cambia el PUA, el shortcode sigue funcionando.
//
// Nota:
// - También existe el modo directo por PUA: :e302: / :e4A0: (o :e4_A0:) (ver index.js).

export const customEmojiShortcodes = new Map([
	// === ejemplos solicitados ===
	[":skull:", "☠"],
	[":star:", "★"],
	[":peace:", "☮"],
	[":heart:", "❤"],
	[":defense:", "❈"],
	[":sun:", "☀"],
	[":music:", "♪"],
	[":cloud:", "☁"],
	[":umbrella:", "☂"],
	[":snowman:", "☃"],
	[":smiley:", "☺"],
	[":note:", "♫"],

	// === agrega más aquí ===
	// [":heart:", "❤"],
]);
