# dev-portal
公開プロジェクトとGitHub Pagesを探せる開発ポータル

公開URL: https://airpocket-soundman.github.io/dev-portal/

## 仕組み
- `index.html` / `app.js` / `style.css` だけの静的ページ（ビルド不要）
- ブラウザから GitHub API で `airpocket-soundman` の公開リポジトリを取得し、1時間 localStorage にキャッシュ
- GitHub Pages が有効なリポジトリには `https://airpocket-soundman.github.io/<repo>/` へのリンクを表示

## 絞り込み
- フリーワード検索（名前 / 説明 / 言語 / トピック、スペース区切りで AND）
- Pages ありのみ / fork を隠す / archived を隠す
- 言語インデックス・頭文字インデックス・トピック（カード内のタグをクリック）
- 並び替え（更新日 / 名前 / スター / 作成日）

## ローカル確認
```
python -m http.server 8765
```
