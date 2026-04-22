export const foodItems = {
  apple: { stamina: 10 },
  coffee: { stamina: 15 },
  pizza: { stamina: 30 },
  monster: { stamina: 40, crash: true },
  water: { regen: true },
  goldenApple: { regen: true },
  totem: { preventDeath: true },
} as const;
