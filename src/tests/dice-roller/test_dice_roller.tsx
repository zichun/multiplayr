import { describe, it } from 'mocha';
import { strict as assert } from 'assert';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { Die } from '../../client/lib/dice-roller/Die';
import { DicePool } from '../../client/lib/dice-roller/DicePool';
import { DiceFaceset } from '../../client/lib/dice-roller/types';

const faces: DiceFaceset = {
  a: { id: 'a', label: '1', color: '#e0703a' },
  b: { id: 'b', label: '2', color: '#2b90b3', glyphColor: '#fff' }
};

describe('dice-roller smoke', () => {
  it('renders a Die (flat + iso) without throwing', () => {
    const flat = renderToString(React.createElement(Die, { faceId: 'a', faceset: faces, animation: { enabled: false } }));
    const iso = renderToString(React.createElement(Die, { faceId: 'b', faceset: faces, theme: { style: 'iso', size: 60 }, animation: { enabled: false } }));
    assert.ok(flat.includes('dr-die'));
    assert.ok(iso.includes('dr-style-iso'));
  });
  it('renders a DicePool (in-place) without throwing', () => {
    const html = renderToString(React.createElement(DicePool, {
      dice: [{ id: 'd1', faceId: 'a' }, { id: 'd2', faceId: 'b' }],
      faceset: faces, animation: { enabled: false }, rollNonce: 1
    }));
    assert.ok(html.includes('dr-pool'));
  });
});
