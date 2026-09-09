export interface Deck {
  id: string;
  name: string;
  createdAt: string;
}
export interface Card {
  id: string;
  deckId: string;
  front: string;
  back: string;
  tags: string;
  createdAt: string;
  updatedAt: string;
}
export interface Collection {
  decks: Deck[];
  cards: Card[];
}
export interface CardInput {
  id?: string;
  deckId: string;
  front: string;
  back: string;
  tags: string;
}
export interface ImportPreview {
  token: string;
  name: string;
  parsed: import('./csv').ParsedImport;
}
export interface TransferReport {
  message: string;
  warnings: string[];
  deckId?: string;
}
export interface SuperCardAPI {
  loadAppearance(): Promise<import('./appearance').Appearance | null>;
  saveAppearance(value: import('./appearance').Appearance): Promise<void>;
  chooseBackground(): Promise<string | null>;
  load(): Promise<Collection>;
  createDeck(name: string): Promise<Deck>;
  renameDeck(id: string, name: string): Promise<void>;
  deleteDeck(id: string): Promise<void>;
  saveCard(card: CardInput): Promise<Card>;
  deleteCard(id: string): Promise<void>;
  dataPath(): Promise<string>;
  onCloseRequested(callback: () => void): () => void;
  finishClose(): Promise<void>;
  pickImages(): Promise<string[]>;
  addImage(bytes: Uint8Array): Promise<string>;
  chooseCSV(): Promise<ImportPreview | null>;
  reparseCSV(token: string, delimiter: string): Promise<ImportPreview>;
  chooseMediaFolder(): Promise<{ token: string; name: string } | null>;
  importCSV(options: {
    token: string;
    mapping: import('./csv').Mapping;
    deckId?: string;
    deckName: string;
    mediaToken?: string;
  }): Promise<TransferReport>;
  exportDeck(id: string): Promise<TransferReport | null>;
  exportBackup(): Promise<TransferReport | null>;
  previewBackup(): Promise<{ token: string; decks: number; cards: number; images: number } | null>;
  restoreBackup(token: string): Promise<TransferReport>;
}
declare global {
  interface Window {
    supercard: SuperCardAPI;
  }
}
