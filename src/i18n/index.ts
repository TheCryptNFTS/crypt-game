/**
 * i18n public surface (A6 scaffold). Import from here:
 *   import { t } from "../i18n";
 */
export { t, getActiveLocale, setActiveLocale, registerLocale, availableLocales } from "./registry";
export type { LocaleCode, LocaleTable } from "./registry";
export type { MessageKey } from "./en";
