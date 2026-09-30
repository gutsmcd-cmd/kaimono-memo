# 買い物メモ（Kaimono Memo）

店内で片手で使える買い物リスト PWA。**無料・広告なし・ログイン不要・オフライン対応。**

## できること

- 名前をつけたリストを複数
- 品目の追加、チェック、チェック済みの消去、上下ボタンで並べ替え
- 数量は任意
- 売り場チップ（任意）：野菜・肉・魚・乳製品・調味料・その他
- 大きなチェックボックス
- 表示言語：日本語 / English

リストは IndexedDB にだけ保存されます。

## English

**Kaimono Memo** is a shopping-list PWA for use in a store, one-handed. Keep several named lists. Add items, check them off, clear the checked ones, and reorder with up/down buttons. Quantity is optional. An optional aisle chip covers vegetables, meat, fish, dairy, seasoning, and other. Checkboxes are large. Japanese by default, with an English toggle. Free, no ads, no login, offline. Lists stay in IndexedDB on this device.

## 開発 / Development

```bash
npm install
npm run dev
npm run build
npm run preview
```

Vite + vanilla TypeScript + vite-plugin-pwa（`registerType: 'autoUpdate'`, `base: './'`）。
