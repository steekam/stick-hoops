import type { Mode } from '../game/types';
import { practice } from './solo/practice';
import { levels } from './solo/levels';
import { timed } from './solo/timed';
import { streak } from './solo/streak';

/** Every playable mode, as the menu lists them. Track B adds the duo entries. */
export interface ModeEntry {
  id: string;
  name: string;
  group: 'solo' | 'duo';
  /** One line for the menu. */
  blurb: string;
  make: () => Mode;
}

export const MODES: ModeEntry[] = [
  { id: 'practice', name: 'Practice', group: 'solo', blurb: 'Full aim guide, no pressure.', make: practice },
  { id: 'levels', name: 'Levels', group: 'solo', blurb: 'Ten courts: walls, wind, a moving hoop.', make: () => levels() },
  { id: 'time', name: '60 Seconds', group: 'solo', blurb: 'Score as much as you can before the buzzer.', make: timed },
  { id: 'streak', name: 'Streak', group: 'solo', blurb: 'One miss ends it. The wind keeps rising.', make: streak },
];
