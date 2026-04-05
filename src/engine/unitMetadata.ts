import { getLoadedUnitById, LoadedUnit } from "../data/loadUnits";
import {
  UnitClass,
  UnitPassive,
  UnitSubtype,
  UnitCombatStyle
} from "../data/unitArchetypes";

export function getUnitMetadata(cardId: string): LoadedUnit {
  return getLoadedUnitById(cardId);
}

export function getUnitClass(cardId: string): UnitClass {
  return getLoadedUnitById(cardId).profile.cardClass;
}

export function getUnitPassive(cardId: string): UnitPassive {
  return getLoadedUnitById(cardId).profile.passive;
}

export function getUnitSubtype(cardId: string): UnitSubtype {
  return getLoadedUnitById(cardId).profile.subtype;
}

export function getUnitCombatStyle(cardId: string): UnitCombatStyle {
  return getLoadedUnitById(cardId).profile.combatStyle;
}

export function getUnitTags(cardId: string): string[] {
  return getLoadedUnitById(cardId).tags;
}

export function unitHasTag(cardId: string, tag: string): boolean {
  return getLoadedUnitById(cardId).tags.includes(tag);
}

export function unitHasPassive(cardId: string, passive: UnitPassive): boolean {
  return getLoadedUnitById(cardId).profile.passive === passive;
}

export function unitIsClass(cardId: string, unitClass: UnitClass): boolean {
  return getLoadedUnitById(cardId).profile.cardClass === unitClass;
}

export function unitIsSubtype(cardId: string, subtype: UnitSubtype): boolean {
  return getLoadedUnitById(cardId).profile.subtype === subtype;
}

export function unitIsCombatStyle(cardId: string, combatStyle: UnitCombatStyle): boolean {
  return getLoadedUnitById(cardId).profile.combatStyle === combatStyle;
}

export function isStoneUnit(cardId: string): boolean {
  return unitIsSubtype(cardId, "STONE");
}

export function isBronzeUnit(cardId: string): boolean {
  return unitIsSubtype(cardId, "BRONZE");
}

export function isTankUnit(cardId: string): boolean {
  return unitIsClass(cardId, "TANK");
}

export function isRushUnit(cardId: string): boolean {
  return unitHasPassive(cardId, "RUSH");
}

export function isTauntUnit(cardId: string): boolean {
  return unitHasPassive(cardId, "TAUNT");
}

export function isDeathBlastUnit(cardId: string): boolean {
  return unitHasPassive(cardId, "DEATH_BLAST");
}

export function isBattlecryHeroHitUnit(cardId: string): boolean {
  return unitHasPassive(cardId, "BATTLECRY_HERO_HIT");
}