# Prettier と Eslint についてのメモ

## 目標：

-   html、js のコード保存時、自動で prettier が動いて整形されるようにする。
-   eslint にエラー表示をしてもらう

### 必要だった npm package

-   "eslint",
-   "eslint-config-prettier",
-   "eslint-config-standard",
-   "prettier",

### 必要な VSCode の拡張機能

-   ESLint,
-   Prettier

### vs code に必要な設定

(html, js に対する vscode 側のデフォルトフォーマット機能をオフにし、Eslint プラグイン側の format もオフにすることで、保存時に prettier が動くようになる。)

```
{
	"html.format.enable": false,
	"javascript.format.enable": false,
	"eslint.format.enable": false,
```
