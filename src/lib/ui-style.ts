export const UI_STYLES = [
  { id: "archive", name: "ARCHIVE", note: "映画資料館のような細線と明朝体" },
  { id: "pop", name: "POP", note: "丸みと面を使った、親しみやすいUI" },
] as const;

export type UiStyleId = (typeof UI_STYLES)[number]["id"];
export const DEFAULT_UI_STYLE: UiStyleId = "archive";
export const UI_STYLE_STORAGE_KEY = "skynet-ui-style";
export const isUiStyleId = (value: string | null): value is UiStyleId =>
  UI_STYLES.some((style) => style.id === value);
