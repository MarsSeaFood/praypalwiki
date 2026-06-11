# GitHub Pages 部署说明

## 首次上传

把本目录里的所有文件上传到 GitHub 仓库根目录，包括：

- `index.html`
- `styles.css`
- `app.js`
- `cards-data.js`
- `cards.csv`
- `scripts/build-changelog.mjs`
- `.github/workflows/deploy-pages.yml`

## 开启 GitHub Pages

进入仓库的 `Settings` -> `Pages`，把 `Source` 改成 `GitHub Actions`。

之后每次推送到 `main` 分支，GitHub Action 会自动部署网站。

## 后续维护卡牌

1. 在仓库根目录打开 `cards.csv`
2. 点编辑，或用 `Add file` -> `Upload files` 替换新的 `cards.csv`
3. 在提交信息里写本次维护说明
4. 提交后等待 Action 完成

网站会自动读取新的 `cards.csv`，并根据 Git 历史生成 `changelog.json`。
