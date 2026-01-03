import { Container } from '@minecraft/server';
import { ActionFormData } from '@minecraft/server-ui';
import { inventory_enabled, CHEST_UI_SIZES } from './constants.js';
import { typeIdToDataId, typeIdToID } from './typeIds.js';

// Nota:
// El flujo de iconos por ID numérico ha sido inconsistente entre versiones/clients.
// La opción más estable es pasar rutas `textures/...` como icono (como en netherite_axe).

const iconCache = new Map();

// Marcador oculto para indicar "encantado" al RP sin romper el layout.
// Se inserta DESPUÉS de `stack#..dur#..` (14 chars) para que el RP lo pueda strippear.
const ENCHANTED_MARKER = 'ench#01';

function normalizeIconInput(value) {
	return typeof value === 'string' ? value.replace(/\\/g, '/') : value;
}

function isKnownTypeId(typeId) {
	// Valida contra el dataset de Bedrock (typeIds.js). Evita generar rutas para IDs inválidos.
	return typeIdToID.has(typeId) || typeIdToDataId.has(typeId);
}

function toItemTexturePath(typeId) {
	const normalized = normalizeIconInput(typeId);
	if (typeof normalized !== 'string') return undefined;
	const colonIndex = normalized.indexOf(':');
	if (colonIndex === -1 || colonIndex + 1 >= normalized.length) return undefined;
	const shortName = normalized.slice(colonIndex + 1);
	return `textures/items/${shortName}`;
}

function buildPrefix(stackSize, durability, enchanted) {
	const stackValue = String(Math.min(Math.max(stackSize, 1), 99)).padStart(2, '0');
	const durValue = String(Math.min(Math.max(durability, 0), 99)).padStart(2, '0');
	return `stack#${stackValue}dur#${durValue}${enchanted ? ENCHANTED_MARKER : ''}§r`;
}

function resolveIconTexture(iconInput) {
	const normalized = normalizeIconInput(iconInput);
	if (typeof normalized !== 'string' || normalized.length === 0) return undefined;

	// Permite cachear también "misses" (undefined) sin recalcular.
	if (iconCache.has(normalized)) return iconCache.get(normalized);

	let resolved;
	if (normalized.startsWith('textures/')) {
		resolved = normalized;
	} else if (normalized.includes(':') && isKnownTypeId(normalized)) {
		// Regla: minecraft:typeId válido -> textures/items/<shortName>
		// Nota: no se aplican fallbacks a `textures/blocks/...`. Si necesitas una cara de bloque
		// (side/front/top) o un sprite falso (p.ej. textures/ui/tnt_iso), pásalo explícitamente.
		resolved = toItemTexturePath(normalized);
	} else {
		resolved = undefined;
	}

	// Cachea incluso misses para evitar trabajo repetido.
	iconCache.set(normalized, resolved);
	return resolved;
}

function buildMissingItemRawtext(originalPath) {
	const normalized = typeof originalPath === 'string' ? normalizeIconInput(originalPath) : String(originalPath);
	return {
		rawtext: [
			{
				text: `stack#01dur#00§r`
			},
			{ text: `§l§cItem no disponible§r` },
			{ text: `\n§cEl item en la ruta ${normalized} no fue encontrado§r` }
		]
	};
}

class ChestFormData {
	constructor(size = 'small') {
		const sizingMaybe = CHEST_UI_SIZES.get(size);
		const sizing = sizingMaybe !== undefined && sizingMaybe !== null ? sizingMaybe : ['§c§h§e§s§t§2§7§r', 27];
		/** @internal */
		this._titleText = { rawtext: [{ text: `${sizing[0]}` }] };
		/** @internal */
		this._buttonArray = Array(sizing[1]).fill(['', undefined]);
		this.slotCount = sizing[1];
	}
	title(text) {
		if (typeof text === 'string') {
			this._titleText.rawtext.push({ text: text });
		}
		else if (typeof text === 'object') {
			if (text.rawtext) {
				for (const rt of text.rawtext) this._titleText.rawtext.push(rt);
			}
			else {
				this._titleText.rawtext.push(text);
			}
		}
		return this;
	}
	button(slot, itemName, itemDesc, texture, stackSize = 1, durability = 0, enchanted = false) {
		let iconValue = resolveIconTexture(texture);
		const missingIcon = iconValue === undefined;
		let buttonRawtext = {
			rawtext: [
				{
					text: buildPrefix(stackSize, durability, enchanted)
				}
			]
		};
		if (missingIcon) {
			buttonRawtext = buildMissingItemRawtext(texture);
			iconValue = 'textures/blocks/barrier';
			this._buttonArray.splice(Math.max(0, Math.min(slot, this.slotCount - 1)), 1, [buttonRawtext, iconValue]);
			return this;
		}
		if (typeof itemName === 'string') {
			buttonRawtext.rawtext.push({ text: itemName ? `${itemName}§r` : '§r' });
		}
		else if (typeof itemName === 'object' && itemName.rawtext) {
			for (const rt of itemName.rawtext) buttonRawtext.rawtext.push(rt);
			buttonRawtext.rawtext.push({ text: '§r' });
		}
		else return;
		if (Array.isArray(itemDesc) && itemDesc.length > 0) {
			for (const obj of itemDesc) {
				if (typeof obj === 'string') {
					buttonRawtext.rawtext.push({ text: `\n${obj}` });
				}
				else if (typeof obj === 'object' && obj.rawtext) {
					buttonRawtext.rawtext.push({ text: `\n` });
					for (const rt of obj.rawtext) buttonRawtext.rawtext.push(rt);
				}
			}
		}
		this._buttonArray.splice(Math.max(0, Math.min(slot, this.slotCount - 1)), 1, [buttonRawtext, iconValue]);
		return this;
	}
	pattern(pattern, key) {
		for (let i = 0; i < pattern.length; i++) {
			const row = pattern[i];
			for (let j = 0; j < row.length; j++) {
				const letter = row.charAt(j);
				const data = key[letter];
				if (!data) continue;
				const slot = j + i * 9;
				const { stackAmount = 1, durability = 0, itemName, itemDesc, enchanted = false } = data;
				let iconValue = resolveIconTexture(data.texture);
				let buttonRawtext = { rawtext: [{ text: buildPrefix(stackAmount, durability, enchanted) }] };
				const missingIcon = iconValue === undefined;
				if (missingIcon) {
					buttonRawtext = buildMissingItemRawtext(data.texture);
					iconValue = 'textures/blocks/barrier';
					this._buttonArray.splice(Math.max(0, Math.min(slot, this.slotCount - 1)), 1, [buttonRawtext, iconValue]);
					continue;
				}
				if (typeof itemName === 'string') {
					buttonRawtext.rawtext.push({ text: `${itemName}§r` });
				}
				else if (itemName && itemName.rawtext) {
					for (const rt of itemName.rawtext) buttonRawtext.rawtext.push(rt);
					buttonRawtext.rawtext.push({ text: '§r' });
				}
				else continue;
				if (Array.isArray(itemDesc) && itemDesc.length > 0) {
					for (const obj of itemDesc) {
						if (typeof obj === 'string') {
							buttonRawtext.rawtext.push({ text: `\n${obj}` });
						} else if (obj && obj.rawtext) {
							buttonRawtext.rawtext.push({ text: `\n` });
							for (const rt of obj.rawtext) buttonRawtext.rawtext.push(rt);
						}
					}
				}
				this._buttonArray.splice(Math.max(0, Math.min(slot, this.slotCount - 1)), 1, [buttonRawtext, iconValue]);
			}
		}
		return this;
	}
	show(player) {
		const form = new ActionFormData().title(this._titleText);
		this._buttonArray.forEach(button => {
			form.button(button[0], button[1] ? button[1].toString() : undefined);
		});
		if (!inventory_enabled) return form.show(player);
		/** @type {Container} */
		const container = player.getComponent('inventory').container;
		for (let i = 0; i < container.size; i++) {
			const item = container.getItem(i);
			if (!item) continue;
			const typeId = item.typeId;
			const iconValue = resolveIconTexture(typeId);
			const durability = item.getComponent('durability');
			const durDamage = durability ? Math.round((durability.maxDurability - durability.damage) / durability.maxDurability * 99) : 0;
			const amount = item.amount;
			const formattedItemName = typeId.replace(/^.*:/, '').replace(/_/g, ' ').replace(/(^\w|\s\w)/g, (m) => m.toUpperCase());
			let buttonRawtext = {
				rawtext: [
					{
						text: `stack#${String(amount).padStart(2, '0')}dur#${String(durDamage).padStart(2, '0')}§r${formattedItemName}`
					}
				]
			};
			const loreText = item.getLore().join('\n');
			if (loreText) buttonRawtext.rawtext.push({ text: loreText });
			form.button(buttonRawtext, iconValue);
		}
		return form.show(player);
	}
}

export { ChestFormData };