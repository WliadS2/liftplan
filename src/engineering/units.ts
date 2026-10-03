declare const unitBrand: unique symbol

type Unit<Name extends string> = number & {
  readonly [unitBrand]: Name
}

export type Millimetres = Unit<'millimetres'>
export type Metres = Unit<'metres'>
export type Kilograms = Unit<'kilograms'>
export type Seconds = Unit<'seconds'>
export type MetresPerSecond = Unit<'metres-per-second'>

export const millimetres = (value: number): Millimetres => value as Millimetres

export const metres = (value: number): Metres => value as Metres

export const kilograms = (value: number): Kilograms => value as Kilograms

export const seconds = (value: number): Seconds => value as Seconds

export const metresPerSecond = (value: number): MetresPerSecond =>
  value as MetresPerSecond

export const millimetresToMetres = (value: Millimetres): Metres =>
  metres(value / 1_000)

export const metresToMillimetres = (value: Metres): Millimetres =>
  millimetres(value * 1_000)
