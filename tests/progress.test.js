import test from 'node:test';
import assert from 'node:assert/strict';
import { Progress, readProgress, saveProgress, SAVE_KEY } from '../src/progress.js';

test('the finale requires all three distinct souvenirs, not duplicate interactions', () => {
  const p = new Progress();
  assert.equal(p.finish(), false);
  assert.equal(p.complete('cat'), true);
  assert.equal(p.complete('cat'), false);
  assert.equal(p.complete('invented'), false);
  p.complete('washer');
  assert.equal(p.portalOpen, false);
  p.complete('phone');
  assert.equal(p.portalOpen, true);
  assert.equal(p.finish(), true);
  assert.equal(p.finished, true);
});

test('invalid or corrupted saves cannot unlock a finale or award extra stars', () => {
  const p = new Progress({ completed: ['cat', 'cat', 'bad'], collected: ['star-0', 'star-0', 'star-5', 2], finished: true });
  assert.equal(p.completed.size, 1);
  assert.equal(p.collected.size, 1);
  assert.equal(p.finished, false);
  assert.equal(readProgress({ getItem() { return '{bad json'; } }).completed.size, 0);
  assert.equal(readProgress({ getItem() { throw new Error('denied'); } }).name, 'Giuly');
});

test('a complete game and personal dedication survive save and reload', () => {
  const storage = { value: null, setItem(key, value) { assert.equal(key, SAVE_KEY); this.value = value; }, getItem() { return this.value; } };
  const p = new Progress();
  p.personalize('Giuly', 'Ogni universo, con te.');
  ['cat', 'washer', 'phone'].forEach(id => p.complete(id));
  for (let i = 0; i < 5; i++) assert.equal(p.collect(`star-${i}`), true);
  assert.equal(p.collect('star-0'), false);
  p.finish();
  assert.equal(saveProgress(storage, p), true);
  const restored = readProgress(storage);
  assert.equal(restored.finished, true);
  assert.equal(restored.collected.size, 5);
  assert.equal(restored.dedication, 'Ogni universo, con te.');
});

test('missing or disabled storage does not block playing', () => {
  const p = new Progress({ name: '', dedication: '', completed: null, collected: 'wrong' });
  assert.equal(p.name, 'Giuly');
  assert.equal(p.collected.size, 0);
  assert.equal(saveProgress({ setItem() { throw new Error('quota'); } }, p), false);
});
