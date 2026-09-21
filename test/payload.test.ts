import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parsePayload, serialisePayload, validatePayload } from '../src/data/payload.ts';
import { ValidationError } from '../src/lib/errors.ts';

const EXERCISE_ID = '4b6d4f4e-6a4e-4a1e-9f4b-2c0d1e2f3a4b';
const ROUTINE_ID = '7c1e2d3f-8a9b-4c1d-8e2f-3a4b5c6d7e8f';

describe('payload validation', function payloadSuite() {
  it('accepts an empty payload for the generic types', function generic() {
    assert.deepEqual(validatePayload('note', null), {});
    assert.deepEqual(validatePayload('todo', undefined), {});
    assert.deepEqual(parsePayload('contact', '{}'), {});
  });

  it('rejects payload fields on a type that has none', function genericWithFields() {
    assert.throws(() => validatePayload('note', { servings: 4 }), ValidationError);
  });

  it('rejects malformed JSON rather than guessing', function malformed() {
    assert.throws(() => parsePayload('recipe', '{ not json'), ValidationError);
  });

  it('round-trips a recipe payload', function recipe() {
    const payload = {
      servings: 4,
      ingredients: [{ qty: 500, unit: 'g', name: 'feijão' }],
      steps: ['Cozinhe o feijão.'],
    };
    assert.deepEqual(parsePayload('recipe', serialisePayload('recipe', payload)), payload);
  });

  it('keeps user content verbatim, accents and all', function verbatim() {
    const parsed = parsePayload(
      'recipe',
      serialisePayload('recipe', {
        servings: 2,
        ingredients: [{ qty: 1, unit: 'colher', name: 'açúcar mascavo' }],
        steps: ['Misture.'],
      }),
    );
    assert.equal(parsed.ingredients[0]?.name, 'açúcar mascavo');
  });

  it('rejects a recipe whose steps are not strings', function badSteps() {
    assert.throws(
      () => validatePayload('recipe', { servings: 1, ingredients: [], steps: [42] }),
      ValidationError,
    );
  });

  it('rejects a routine whose exercise_id is not a reference', function danglingReference() {
    assert.throws(
      () =>
        validatePayload('routine', {
          exercises: [{ exercise_id: 'bench press', sets: 4, reps: 8, load_kg: 60 }],
        }),
      ValidationError,
      'SPECS §4.1: references inside payload JSON are checked here or nowhere',
    );
  });

  it('accepts a well-formed workout log', function workoutLog() {
    const payload = {
      routine_id: ROUTINE_ID,
      performed: [{ exercise_id: EXERCISE_ID, sets: [{ reps: 8, load_kg: 60 }] }],
    };
    assert.deepEqual(validatePayload('workout_log', payload), payload);
  });

  it('treats a missing optional coordinate as absent, not as zero', function place() {
    assert.deepEqual(validatePayload('place', { lat: -12.34 }), { lat: -12.34 });
  });

  it('rejects a coordinate that is not a finite number', function badCoordinate() {
    assert.throws(() => validatePayload('place', { lat: 'south' }), ValidationError);
  });
});
