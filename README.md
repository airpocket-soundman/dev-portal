# dev-portal
公開プロジェクトとGitHub Pagesを探せる開発ポータル

公開URL: https://airpocket-soundman.github.io/dev-portal/

## 仕組み
- `index.html` / `app.js` / `style.css` だけの静的ページ（ビルド不要）
- GitHub Actions（`.github/workflows/update-data.yml`、毎日 06:00 JST + 手動実行）が `scripts/build-data.mjs` を実行し、`data/repos.json` を生成してコミット
  - 公開リポジトリ一覧と GitHub Pages の有無
  - ProtoPedia 作品との対応（作品本文にリポジトリ / Pages の URL がある、またはリポジトリ README に作品 URL がある場合に自動でリンク）
  - 自動で拾えない対応は `data/protopedia-links.json` に `"リポジトリ名": [作品ID]` で手動追加
- `data/repos.json` が読めない場合はブラウザから GitHub API を直接叩く（ProtoPedia 情報なし）

## 絞り込み
- フリーワード検索（名前 / 説明 / 言語 / トピック、スペース区切りで AND）
- Pages ありのみ / ProtoPedia ありのみ / fork を隠す / archived を隠す
- 言語インデックス・頭文字インデックス・トピック（カード内のタグをクリック）
- 並び替え（更新日 / 名前 / スター / 作成日）

## ローカル確認
```
GITHUB_TOKEN=$(gh auth token) node scripts/build-data.mjs
python -m http.server 8765
```
