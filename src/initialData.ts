import { Character, Note, Idea } from './types';
import { roleplayIdeas } from './roleplayIdeas';

export const initialCharacters: Character[] = [];

export const initialNotes: Note[] = [];

export const initialIdeas: Idea[] = [
  ...roleplayIdeas
];
