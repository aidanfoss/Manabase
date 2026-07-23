import { describe, it, expect } from 'vitest';
import { parseImportInput } from '../../frontend/src/utils/csvImporter.js';

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
      card_condition: 'NM',
      card_language: 'EN'
    });
    expect(result[1]).toEqual({
      card_name: 'Emeria, the Sky Ruin',
      quantity: 1,
      set_code: '',
      collector_number: '',
      is_foil: false,
      card_condition: 'NM',
      card_language: 'EN'
    });
    expect(result[2]).toEqual({
      card_name: "Minamo, School at Water's Edge",
      quantity: 2,
      set_code: '',
      collector_number: '',
      is_foil: false,
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
    expect(result[1].card_name).toBe('Emeria, the Sky Ruin');
    expect(result[1].quantity).toBe(1);
  });

  it('should parse unheadered CSV format lines with numbers correctly', () => {
    const input = `Sol Ring, 4, LEA
"Eiganjo, Seat of the Empire", 1, NEO, 268`;

    const result = parseImportInput(input);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      card_name: 'Sol Ring',
      quantity: 4,
      set_code: 'LEA'
    });
    expect(result[1]).toMatchObject({
      card_name: 'Eiganjo, Seat of the Empire',
      quantity: 1,
      set_code: 'NEO',
      collector_number: '268'
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
      card_condition: 'NM',
      card_language: 'EN'
    });
    expect(result[1]).toEqual({
      card_name: 'Brainstorm',
      quantity: 4,
      set_code: 'EMA',
      collector_number: '42',
      is_foil: false,
      card_condition: 'NM',
      card_language: 'EN'
    });
  });
});
