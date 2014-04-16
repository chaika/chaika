chaika
======

Firefox に 2ちゃんねる専用ブラウザ相当の機能を追加するアドオンです。


Install
---

[Mozilla 公式サイト](https://addons.mozilla.org/ja/firefox/addon/chaika/)よりインストール可能です。


For Users
---

### マニュアル・ヘルプ
* [[オンラインヘルプ|Home]]
* [FAQ(よくある質問)](http://bbs2ch.sourceforge.jp/?page=FAQ)

### コミュニティ
* [2ch現行スレッド](http://find.2ch.net/search?q=bbs2chreader%2Fchaika&board=software&site=2ch&match=full&status=&size=10)
* [スレッド避難所](http://yy22.kakiko.com/test/read.cgi/bbs2ch/1222488320/)
* [公式アップローダー](http://bbs2ch.sourceforge.jp/uploader/upload.php)
* [スキン一覧](http://bbs2ch.sourceforge.jp/?page=Skin%2F0.4.5)

### 関連
* [bbs2chreader 公式サイト](http://bbs2ch.sourceforge.jp/)


For Developers
---

### テスト環境

* [開発用テスト板](http://yy22.kakiko.com/bbs2ch/) : バグ再現レスなどはこちらに投稿。
* [開発用テスト板2](http://jbbs.shitaraba.net/computer/43679/)

### バグ一覧・ToDo
* 最新バグ一覧: [Issues](https://github.com/chaika/chaika/issues)

* 更新が停止したバグ一覧など  
    (新規投稿は上にお願いします)
    * [旧旧ToDo](https://spreadsheets.google.com/pub?key=pbbe5TFNb21RVxOf7ygNJfg) : b2r 0.5系 (flysonさん作成)
    * [旧ToDo](http://d.hatena.ne.jp/nazodane/20080609/1212999112) : b2r 0.5系 (Nazoさん作成)
    * [launchpad](https://bugs.launchpad.net/bbs2ch) : b2r バグトラッカー
    * [あぼーん改善案](http://bbs2ch.sourceforge.jp/?page=%A4%A2%A4%DC%A1%BC%A4%F3%B2%FE%C1%B1)
    * [書きこみ改善案](http://bbs2ch.sourceforge.jp/?page=%BD%F1%A4%AD%B9%FE%A4%DF%B2%FE%C1%B1)

### branch について
基本規則は http://havelog.ayumusato.com/develop/git/e513-git_branch_model.html に準拠。

* **master**  
  主にタグ付専用として使用。直接コミットはせず、基本的にマージのみ。
* **develop**  
  開発用のブランチ。
  
  * **feature**  
    大規模修正用のブランチ。
  * **release**  
    リリース候補用のブランチ。AMOは登録に時間がかかるため、登録が完了するまではこちらでバグフィックスする。開発はdevelopブランチで継続する。
