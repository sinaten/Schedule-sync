// The coding guide for the AI: explains how every ID is built, so an AI that opens the site can read the codes.
// It is generated from the live settings (format + catalog) and also saved in the database (key ai:guide).
import { PARTS } from './ids';
import { TOKENS } from './idcat';
export const guideKey = 'ai:guide';
export const notesKey = 'ai:guide-notes';

export function buildGuide(fmt, cat) {
  const sep = fmt.sep || '-';
  const base = fmt.segs.filter((s) => s.on).map((s) => PARTS.find((p) => p.k === s.k)).filter(Boolean);
  const L = [];
  L.push('# Tracking ID guide (for the AI assistant)');
  L.push('');
  L.push('Every thing on the site (card, message, button, tab, photo...) gets an ID: a string of parts joined by "' + sep + '". Read the parts left to right.');
  L.push('');
  L.push('## 1. The first string (identifies project, creator and moment of creation)');
  L.push(base.map((p, i) => (i + 1) + '. ' + p.n + ': ' + p.h).join('\n'));
  L.push('Example: US-OH-COL-CLT86-sina-0-26-11-2134-V1 = United States, Ohio, Columbus, project CLT86, created by user sina, access level 0, year 2026, month 11, time 21:34, version 1.');
  L.push('Access: 0 all, 1 owner, 2 editor, 3 manager. Time zone: ' + fmt.tz + '.');
  L.push('');
  L.push('## 2. Parts added after the first string');
  L.push(TOKENS.map((t) => '- ' + t.n + ' (' + t.k + '): ' + t.h).join('\n'));
  L.push('- Item = type code + 4-digit number, e.g. ISS0008 = issue card number 8, AP0002 = action plan 2. Numbers never change, even if something is deleted.');
  L.push('- Message stamp = yy-mm-dd-hhmm in ' + fmt.tz + ', e.g. 26-11-20-2134 = 2026-11-20 at 21:34.');
  L.push('');
  L.push('## 3. How to read a conversation message');
  L.push('<first string>-<card>[-<action plan>]-COM-<kind>-<writer>-<yy-mm-dd-hhmm>-<number>');
  L.push('Kinds: TXT text, VOI voice, IMG photo, VID video, FIL file. A message inside an action plan has the action plan part (ACT01) before COM.');
  L.push('Example: US-OH-COL-CLT86-sina-0-26-11-2134-V1-ISS0008-ACT01-COM-VOI-ali-26-11-20-2205-04 = the 4th message, a voice note from ali, written 2026-11-20 at 22:05 in action plan 1 of issue card 8 in project CLT86.');
  L.push('');
  L.push('## 4. Types');
  for (const [g, title] of [['item', 'Items'], ['message', 'Messages'], ['button', 'Buttons'], ['bar', 'Bars and tabs']]) {
    L.push('### ' + title);
    for (const t of cat.types.filter((x) => x.group === g)) {
      const parts = t.parts.filter((x) => x.on).map((x) => x.k).join(' + ');
      L.push('- ' + t.name + (g === 'item' ? ' [code ' + t.code + ']' : t.word ? ' [' + t.word + ']' : '') + ': ' + t.desc + '. Built from: ' + parts + '.');
    }
  }
  L.push('');
  L.push('### Page codes');
  L.push(cat.pages.map((p) => '- ' + p.code + ' = ' + p.name).join('\n'));
  L.push('');
  L.push('## 5. How to answer questions with the codes');
  L.push('- "What did X say in project P on day D?": find messages whose first string contains project P, whose kind is TXT/VOI/IMG/VID/FIL, whose writer is X and whose stamp is on day D. With no date, read from the first message to the last. With a range, keep only stamps inside it. Detail narrows the search; less detail widens it.');
  L.push('- Given a card ID: read the card, its description, its action plans and every message whose ID starts with that card ID.');
  L.push('- The project is always inside the ID, so the same Revit element number in two projects never gets mixed up.');
  L.push('');
  L.push('## 6. Current status (be honest with the user)');
  L.push('- The IDs above are a design and samples only. They are NOT yet attached to real cards, messages or buttons, and there is NO search by ID yet. Until that is built, say so instead of guessing.');
  return L.join('\n');
}
