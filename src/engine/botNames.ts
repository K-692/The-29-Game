/**
 * Realistic Indian human names for CPU players.
 * Never includes "CPU", "Bot", or "Computer".
 */
export const REALISTIC_BOT_NAMES = [
  'Aarav',
  'Mira',
  'Kabir',
  'Anaya',
  'Rohan',
  'Tara',
  'Ishaan',
  'Aditi',
  'Vihaan',
  'Meera',
  'Arjun',
  'Nisha',
  'Dev',
  'Kavya',
  'Rahul',
  'Isha',
  'Neil',
  'Sana',
  'Karan',
  'Priya',
  'Aditya',
  'Leela',
  'Arnav',
  'Zoya',
  'Rishi',
  'Diya',
  'Vikram',
  'Pooja',
  'Rudra',
  'Tanvi',
  'Varun',
  'Neha',
  'Sameer',
  'Shreya',
  'Dhruv',
  'Avani',
];

export const AUTHENTIC_BOT_NAMES = REALISTIC_BOT_NAMES;

/**
 * Returns a list of random unique names from the realistic names pool,
 * ensuring no conflict with any already existing player names.
 */
export const getRandomBotNames = (count: number, existingNames: string[] | string = []): string[] => {
  const existingArr = Array.isArray(existingNames) ? existingNames : [existingNames];
  const existingSet = new Set(existingArr.map((n) => n.trim().toLowerCase()));
  const available = REALISTIC_BOT_NAMES.filter((name) => !existingSet.has(name.toLowerCase()));

  // Fisher-Yates shuffle
  const pool = [...available];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  // If pool smaller than count (rare), fallback to indexed names from original list
  const results: string[] = [];
  for (let i = 0; i < count; i++) {
    if (i < pool.length) {
      results.push(pool[i]);
    } else {
      results.push(REALISTIC_BOT_NAMES[i % REALISTIC_BOT_NAMES.length]);
    }
  }

  return results;
};
