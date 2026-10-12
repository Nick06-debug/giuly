export const QUEST_IDS = ['cat', 'washer', 'phone'];
export const SAVE_KEY = 'giuly-dream-v1';
export const DEFAULT_DEDICATION = 'Sei il mio posto preferito, anche quando il mondo impazzisce.';

// Only game progress and a dedication are stored, on this device.
export class Progress {
  constructor(saved = {}) {
    this.completed = new Set((Array.isArray(saved.completed) ? saved.completed : []).filter(id => QUEST_IDS.includes(id)));
    this.collected = new Set((Array.isArray(saved.collected) ? saved.collected : []).filter(id => typeof id === 'string' && /^star-[0-4]$/.test(id)));
    this.name = cleanText(saved.name, 'Giuly', 32);
    this.dedication = cleanText(saved.dedication, DEFAULT_DEDICATION, 500);
    this.finished = saved.finished === true && this.portalOpen;
  }

  get portalOpen() { return this.completed.size === QUEST_IDS.length; }
  complete(id) {
    if (!QUEST_IDS.includes(id) || this.completed.has(id)) return false;
    this.completed.add(id);
    return true;
  }
  collect(id) {
    if (!/^star-[0-4]$/.test(id) || this.collected.has(id)) return false;
    this.collected.add(id);
    return true;
  }
  finish() {
    if (!this.portalOpen) return false;
    this.finished = true;
    return true;
  }
  personalize(name, dedication) {
    this.name = cleanText(name, 'Giuly', 32);
    this.dedication = cleanText(dedication, DEFAULT_DEDICATION, 500);
  }
  toJSON() {
    return { completed: [...this.completed], collected: [...this.collected], name: this.name, dedication: this.dedication, finished: this.finished };
  }
}

function cleanText(value, fallback, maxLength) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, maxLength) : fallback;
}

export function readProgress(storage) {
  try { return new Progress(JSON.parse(storage.getItem(SAVE_KEY) || '{}')); }
  catch { return new Progress(); }
}

export function saveProgress(storage, progress) {
  try { storage.setItem(SAVE_KEY, JSON.stringify(progress)); return true; }
  catch { return false; }
}
