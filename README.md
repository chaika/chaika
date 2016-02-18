# chaika

## :warning: 重要なお知らせ
chaika は e10s には対応しますが， WebExtensions に対応する予定はありません．
詳しくは，以下の記事をお読みください．

- [bbs2chreader/chaika 避難所 ★3 (レス432番)](http://jbbs.shitaraba.net/bbs/read.cgi/computer/44179/1435322223/432)
- [chaikaの開発を無期限停止します - 徒然技術日記](http://nodaguti.hatenablog.com/entry/2015/09/13/222613)
- [bbs2chreader/chaika Part49 (レス568番)](http://potato.2ch.net/test/read.cgi/software/1434991857/568)

----

2ちゃんねるなどの掲示板閲覧をより快適にするアドオンです。
他の専用ブラウザに引けを取らないだけでなく、Firefox と連携した多様な機能を提供します。

## Install

[Mozilla 公式サイト](https://addons.mozilla.org/ja/firefox/addon/chaika/)よりインストール可能です。

## For Users
### マニュアル・ヘルプ
* [オンラインヘルプ](https://github.com/chaika/chaika/wiki)
* [FAQ(よくある質問)](http://bbs2ch.osdn.jp/?page=FAQ)

### コミュニティ
* [現行スレッド](http://refind2ch.org/search?q=chaika)
* [サポート掲示板](http://jbbs.shitaraba.net/computer/44179/)
* [公式アップローダー](http://bbs2ch.osdn.jp/uploader/upload.php)
* [スキン一覧](http://bbs2ch.osdn.jp/?page=Skin%2F0.4.5)

### 関連
* [bbs2chreader 公式サイト](http://bbs2ch.osdn.jp/)

## For Developers
### プラグイン・関連アドオン・スキン開発
* [開発者の方向けオンラインマニュアル](https://github.com/chaika/chaika/wiki#%E9%96%8B%E7%99%BA%E8%80%85%E3%81%AE%E6%96%B9%E5%90%91%E3%81%91)

### chaika 本体の開発
メイン開発者として参画する、パッチを投稿する、Pull Requestを行う、オンラインヘルプを整備するなど、どのような形での参加であれ大歓迎です。

#### ライセンス
- [MPL 1.1/GPL 2.0/LGPL 2.1](https://github.com/chaika/chaika/blob/develop/chaika/license.txt)

#### テスト環境
* [開発用テスト板](http://jbbs.shitaraba.net/computer/43679/)

#### バグ一覧・ToDo
* 最新バグ一覧: [Issues](https://github.com/chaika/chaika/issues?q=is%3Aopen+is%3Aissue+-label%3Afixed)

* 更新が停止したバグ一覧など (新規投稿は上のバグ一覧にお願いします)
  * [旧旧ToDo](https://spreadsheets.google.com/pub?key=pbbe5TFNb21RVxOf7ygNJfg) : b2r 0.5系 (flysonさん作成)
  * [旧ToDo](http://d.hatena.ne.jp/nazodane/20080609/1212999112) : b2r 0.5系 (Nazoさん作成)
  * [launchpad](https://bugs.launchpad.net/bbs2ch) : b2r バグトラッカー
  * [あぼーん改善案](http://bbs2ch.osdn.jp/?page=%A4%A2%A4%DC%A1%BC%A4%F3%B2%FE%C1%B1)
  * [書きこみ改善案](http://bbs2ch.osdn.jp/?page=%BD%F1%A4%AD%B9%FE%A4%DF%B2%FE%C1%B1)
  * [bbs2chreader開発板](http://jbbs.shitaraba.net/computer/41231/): Nazoさん作成の旧開発板

#### ブランチモデル
基本規則は [ぼくが実際に運用していたGitブランチモデルについて ::ハブろぐ](http://havelog.ayumusato.com/develop/git/e513-git_branch_model.html) に準拠。

* master
  - 主にリリース版のタグ付専用として使用。直接コミットはせず、基本的にマージのみ。
* develop
  - 開発用のブランチ。
* feature
  - 大規模修正用のブランチ。
* release
  - リリース候補用のブランチ。AMOは登録に時間がかかるため、登録が完了するまではこちらでバグフィックスする。開発はdevelopブランチで継続する。
