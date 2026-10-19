import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { encodeSaveCode, decodeSaveCode, crc32 } from '../src/game/savecode.js';
import { emptyProgress, mergeProgress, computeStars, taskXp } from '../src/game/progress.js';

const index = JSON.parse(readFileSync('public/content/index.json', 'utf8'));
const slots = index.slots;

function sample() {
  const p = emptyProgress();
  p.tasks['C0-01-sum'] = { solved: true, stars: 3, hints: 0, attempts: 0, firstTry: true };
  p.tasks['C0-02-five-ops'] = { solved: true, stars: 1, hints: 5, attempts: 4, firstTry: false };
  p.tasks['C1-03-leap'] = { solved: false, stars: 0, hints: 2, attempts: 7, firstTry: false };
  p.lessons.C0 = { status: 2, best: 100, read: [] };
  p.lessons.C1 = { status: 3, best: 0, read: [] };
  p.lessons.C2 = { status: 1, best: 0, read: [] };
  p.pw.C3 = true;
  return p;
}

describe('код сохранения', () => {
  it('восстанавливает прогресс без потерь', async () => {
    const p = sample();
    const code = await encodeSaveCode(p, slots);
    expect(code.startsWith('PQ1-')).toBe(true);
    const back = await decodeSaveCode(code, slots);
    expect(back.tasks).toEqual(p.tasks);
    expect(back.lessons.C0.status).toBe(2);
    expect(back.lessons.C1.status).toBe(3);
    expect(back.lessons.C2.status).toBe(1);
    expect(back.pw).toEqual({ C3: true });
  });

  it('короткий в начале игры и в пределах 600 символов при полном прохождении', async () => {
    const empty = await encodeSaveCode(emptyProgress(), slots);
    expect(empty.length).toBeLessThan(120);
    const full = emptyProgress();
    slots.tasks.forEach((id, i) => { full.tasks[id] = { solved: true, stars: 1 + (i % 3), hints: i % 6, attempts: (i * 7) % 13, firstTry: i % 2 === 0 }; });
    slots.levels.forEach((c) => { full.lessons[c] = { status: 2, best: 100, read: [] }; });
    const code = await encodeSaveCode(full, slots);
    expect(code.length).toBeLessThanOrEqual(600);
    expect((await decodeSaveCode(code, slots)).tasks).toEqual(full.tasks);
  });

  it('отклоняет испорченный код', async () => {
    const code = await encodeSaveCode(sample(), slots);
    const i = 10;
    const broken = code.slice(0, i) + (code[i] === 'A' ? 'B' : 'A') + code.slice(i + 1);
    await expect(decodeSaveCode(broken, slots)).rejects.toThrow('checksum');
    await expect(decodeSaveCode(code.slice(0, -6), slots)).rejects.toThrow();
    await expect(decodeSaveCode('SQL1-abc', slots)).rejects.toThrow('prefix');
    await expect(decodeSaveCode('PQ9-' + code.slice(4), slots)).rejects.toThrow('version');
  });

  it('терпит пробелы и переносы при вставке', async () => {
    const code = await encodeSaveCode(sample(), slots);
    const spaced = '  ' + code.slice(0, 20) + '\n' + code.slice(20) + ' ';
    expect((await decodeSaveCode(spaced, slots)).tasks['C0-01-sum'].stars).toBe(3);
  });

  it('CRC32 совпадает с эталонным значением', () => {
    expect(crc32('123456789')).toBe(0xcbf43926);
  });
});

describe('прогресс', () => {
  it('объединение берёт лучший результат', () => {
    const a = emptyProgress(), b = emptyProgress();
    a.tasks.x = { solved: true, stars: 1, hints: 5, attempts: 3 };
    b.tasks.x = { solved: true, stars: 3, hints: 0, attempts: 0 };
    a.tasks.y = { solved: false, stars: 0, hints: 1, attempts: 2 };
    a.lessons.C0 = { status: 2, best: 80, read: ['why'] };
    b.lessons.C0 = { status: 1, best: 100, read: ['types'] };
    b.pw.C2 = true;
    const m = mergeProgress(a, b);
    expect(m.tasks.x.stars).toBe(3);
    expect(m.tasks.y.hints).toBe(1);
    expect(m.lessons.C0).toEqual({ status: 2, best: 100, read: ['why', 'types'] });
    expect(m.pw.C2).toBe(true);
  });

  it('звёзды считаются по правилам ТЗ', () => {
    expect(computeStars({ hints: 0, attempts: 0 }, true, ['first_try'])).toBe(3);
    expect(computeStars({ hints: 0, attempts: 2 }, true, ['first_try'])).toBe(2);
    expect(computeStars({ hints: 0, attempts: 0 }, false, ['max_lines:2'])).toBe(2);
    expect(computeStars({ hints: 2, attempts: 0 }, true, [])).toBe(2);
    expect(computeStars({ hints: 3, attempts: 0 }, true, [])).toBe(1);
    expect(computeStars({ hints: 5, attempts: 0 }, true, [])).toBe(1);
  });

  it('XP учитывает тип задачи и подсказки', () => {
    const xp = index.xp;
    expect(taskXp({ difficulty: 1 }, { solved: true, hints: 0 }, xp)).toBe(20);
    expect(taskXp({ difficulty: 3 }, { solved: true, hints: 1 }, xp)).toBe(36);
    expect(taskXp({ boss: true }, { solved: true, hints: 4 }, xp)).toBe(50);
    expect(taskXp({ boss: true }, { solved: true, hints: 5 }, xp)).toBe(25);
    expect(taskXp({ difficulty: 1 }, { solved: false, hints: 0 }, xp)).toBe(0);
  });
});
