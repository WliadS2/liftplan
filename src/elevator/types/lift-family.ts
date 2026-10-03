export const LIFT_FAMILIES = {
  passenger: 'passenger',
  goods: 'goods',
  car: 'car',
  smallGoods: 'small-goods',
  hospitalBed: 'hospital-bed',
  home: 'home',
  platform: 'platform',
  heavyDuty: 'heavy-duty',
  special: 'special',
} as const

export type LiftFamily = (typeof LIFT_FAMILIES)[keyof typeof LIFT_FAMILIES]
