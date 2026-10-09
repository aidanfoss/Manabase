import { describe, it, expect } from 'vitest';
import { parseImportInput, normalizeProxy } from '../../frontend/src/utils/csvImporter.js';

describe('CSV & Decklist Importer Utility', () => {
  it('should correctly parse decklist lines with commas in card names (e.g. Eiganjo, Seat of the Empire)', () => {
    const input = `1 Eiganjo, Seat of the Empire
1 Emeria, the Sky Ruin
2 Minamo, School at Water's Edge`;

    const result = parseImportInput(input);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      card_name: 'Eiganjo, Seat of the Empire',
      quantity: 1,
      set_code: '',
      collector_number: '',
      is_foil: false,
      is_proxy: false,
      card_condition: 'NM',
      card_language: 'EN'
    });
    expect(result[1]).toEqual({
      card_name: 'Emeria, the Sky Ruin',
      quantity: 1,
      set_code: '',
      collector_number: '',
      is_foil: false,
      is_proxy: false,
      card_condition: 'NM',
      card_language: 'EN'
    });
    expect(result[2]).toEqual({
      card_name: "Minamo, School at Water's Edge",
      quantity: 2,
      set_code: '',
      collector_number: '',
      is_foil: false,
      is_proxy: false,
      card_condition: 'NM',
      card_language: 'EN'
    });
  });

  it('should parse decklist lines without quantity prefix containing commas', () => {
    const input = `Eiganjo, Seat of the Empire
Emeria, the Sky Ruin`;

    const result = parseImportInput(input);
    expect(result).toHaveLength(2);
    expect(result[0].card_name).toBe('Eiganjo, Seat of the Empire');
    expect(result[0].quantity).toBe(1);
    expect(result[0].is_proxy).toBe(false);
    expect(result[1].card_name).toBe('Emeria, the Sky Ruin');
    expect(result[1].quantity).toBe(1);
    expect(result[1].is_proxy).toBe(false);
  });

  it('should parse unheadered CSV format lines with numbers correctly', () => {
    const input = `Sol Ring, 4, LEA
"Eiganjo, Seat of the Empire", 1, NEO, 268`;

    const result = parseImportInput(input);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      card_name: 'Sol Ring',
      quantity: 4,
      set_code: 'LEA',
      is_proxy: false
    });
    expect(result[1]).toMatchObject({
      card_name: 'Eiganjo, Seat of the Empire',
      quantity: 1,
      set_code: 'NEO',
      collector_number: '268',
      is_proxy: false
    });
  });

  it('should parse decklist lines with set code and collector number', () => {
    const input = `1 Watery Grave (GRN) 259 *F*
4 Brainstorm (EMA) 42`;

    const result = parseImportInput(input);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      card_name: 'Watery Grave',
      quantity: 1,
      set_code: 'GRN',
      collector_number: '259',
      is_foil: true,
      is_proxy: false,
      card_condition: 'NM',
      card_language: 'EN'
    });
    expect(result[1]).toEqual({
      card_name: 'Brainstorm',
      quantity: 4,
      set_code: 'EMA',
      collector_number: '42',
      is_foil: false,
      is_proxy: false,
      card_condition: 'NM',
      card_language: 'EN'
    });
  });

  it('should parse ManaBox CSV export containing Proxy column', () => {
    const input = `Binder Name,Binder Type,Name,Set code,Set name,Collector number,Foil,Rarity,Quantity,ManaBox ID,Scryfall ID,Purchase price,Misprint,Altered,Signed,Condition,Language,Proxy,Purchase price currency,Added
Lorwyn Binder,binder,Liminal Hold,ECL,Lorwyn Eclipsed,24,normal,common,2,110583,a5a40c16-7a5c-4ad1-be53-6b1b1be2affe,0.05,false,false,false,near_mint,en,false,USD,2026-03-25T07:35:16.082Z
Proxy Binder,binder,Mox Diamond,STH,Stronghold,138,normal,rare,1,1001,4a8f7768-88f4-40c9-ac2d-319fca785dc9,500.00,false,false,false,near_mint,en,true,USD,2026-03-25T07:35:16.082Z`;

    const result = parseImportInput(input);
    expect(result).toHaveLength(2);

    expect(result[0]).toEqual({
      card_name: 'Liminal Hold',
      quantity: 2,
      set_code: 'ECL',
      collector_number: '24',
      is_foil: false,
      is_proxy: false,
      card_condition: 'NM',
      card_language: 'EN',
      binder_type: 'binder'
    });

    expect(result[1]).toEqual({
      card_name: 'Mox Diamond',
      quantity: 1,
      set_code: 'STH',
      collector_number: '138',
      is_foil: false,
      is_proxy: true,
      card_condition: 'NM',
      card_language: 'EN',
      binder_type: 'binder'
    });
  });

  it('should correctly normalize proxy values with normalizeProxy', () => {
    expect(normalizeProxy(true)).toBe(true);
    expect(normalizeProxy(false)).toBe(false);
    expect(normalizeProxy('true')).toBe(true);
    expect(normalizeProxy('TRUE')).toBe(true);
    expect(normalizeProxy('yes')).toBe(true);
    expect(normalizeProxy('1')).toBe(true);
    expect(normalizeProxy('proxy')).toBe(true);
    expect(normalizeProxy('false')).toBe(false);
    expect(normalizeProxy('no')).toBe(false);
    expect(normalizeProxy('0')).toBe(false);
    expect(normalizeProxy('')).toBe(false);
    expect(normalizeProxy(null)).toBe(false);
    expect(normalizeProxy(undefined)).toBe(false);
  });
});
