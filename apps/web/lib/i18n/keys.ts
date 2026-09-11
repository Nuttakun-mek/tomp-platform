import type { th } from "./th";

export type DictionaryShape<T> = {
  readonly [K in keyof T]: T[K] extends string ? string : DictionaryShape<T[K]>;
};

export type DeepKeys<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${DeepKeys<T[K]>}`;
}[keyof T & string];

export type I18nKey = DeepKeys<typeof th>;
