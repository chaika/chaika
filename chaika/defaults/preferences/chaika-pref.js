pref("extensions.chaika.logger.level", 2);
pref('extensions.chaika.releasenotes_showed', '1.5.7');

// general
pref("extensions.chaika.http_proxy_mode", 0);
pref("extensions.chaika.http_proxy_value", "localhost:8080");
pref("extensions.chaika.tab_load_in_foreground", false);
pref("extensions.chaika.appoint_data_dir", false);
pref("extensions.chaika.data_dir", "");

// local server
pref("extensions.chaika.server.port", 8823);
pref("extensions.chaika.server.port.retry", true);
pref("extensions.chaika.server.port.randomization", false);

// history
pref("extensions.chaika.history_expire_days", 60);
pref("extensions.chaika.historymenu.board_max", 6);
pref("extensions.chaika.historymenu.thread_max", 6);

// replacement manager
pref('extensions.chaika.replace.warn_when_delete', true);

// thread redirector
pref("extensions.chaika.browser.redirector.enabled", true);
pref("extensions.chaika.browser.redirector.throw_bookmarks", false);
pref("extensions.chaika.browser.redirector.replace_view_limit", true);
pref('extensions.chaika.browser.redirector.ivur.behavior', 0);

// chaika menu
pref('extensions.chaika.browser.browsermenu.open_in_new_tab', false);
pref('extensions.chaika.browser.browsermenu.disregard_url_limit', false);
pref('extensions.chaika.browser.browsermenu.remove_limit_when_copy', false);
pref('extensions.chaika.browser.browsermenu.confirm_add_abone', true);
pref('extensions.chaika.browser.browsermenu.reload_when_skin_changed', false);
pref('extensions.chaika.browser.browsermenu.find_2ch_in_sidebar', false);

// toolbar button
pref('extensions.chaika.browser.toolbarbutton.installed', false);
pref('extensions.chaika.browser.toolbarbutton.show_only_on_bbs', false);

// context menu
pref('extensions.chaika.contextmenu.enabled', true);
pref('extensions.chaika.contextmenu.show_only_on_bbs', true);
pref('extensions.chaika.contextmenu.always_show_open_link', true);
pref('extensions.chaika.contextmenu.flattened', false);
pref("extensions.chaika.contextmenu.abone.enabled", true);
pref("extensions.chaika.contextmenu.copy.enabled", true);
pref("extensions.chaika.contextmenu.search.enabled", true);
pref("extensions.chaika.contextmenu.history.enabled", true);
pref("extensions.chaika.contextmenu.skin.enabled", true);
pref("extensions.chaika.contextmenu.skin-sep.enabled", true);
pref("extensions.chaika.contextmenu.write.enabled", true);
pref("extensions.chaika.contextmenu.delete-log.enabled", true);
pref("extensions.chaika.contextmenu.thread-sep.enabled", true);
pref("extensions.chaika.contextmenu.view-in-chaika.enabled", true);
pref("extensions.chaika.contextmenu.view-in-browser.enabled", true);
pref("extensions.chaika.contextmenu.view-in-sep.enabled", true);
pref("extensions.chaika.contextmenu.open-link-in-chaika.enabled", true);
pref("extensions.chaika.contextmenu.open-link-in-browser.enabled", true);
pref("extensions.chaika.contextmenu.open-link-in-sep.enabled", true);
pref("extensions.chaika.contextmenu.change-limit-all.enabled", true);
pref("extensions.chaika.contextmenu.change-limit-l50.enabled", true);
pref("extensions.chaika.contextmenu.go-to-board.enabled", true);
pref("extensions.chaika.contextmenu.find-next-thread.enabled", true);
pref("extensions.chaika.contextmenu.thread-utils-sep.enabled", true);
pref("extensions.chaika.contextmenu.register-selection-as-aa.enabled", true);
pref("extensions.chaika.contextmenu.open-replacement-manager.enabled", true);
pref("extensions.chaika.contextmenu.extra-utils-sep.enabled", true);
pref("extensions.chaika.contextmenu.toggle-sidebar.enabled", true);
pref("extensions.chaika.contextmenu.sidebar-sep.enabled", true);
pref("extensions.chaika.contextmenu.open-settings.enabled", true);

// http controller
pref("extensions.chaika.refController.enabled", true);
pref('extensions.chaika.imageViewURLReplace.enabled', false);
pref('extensions.chaika.ngfiles.enabled', false);

// account: ronin
pref("extensions.chaika.login.ronin.login_url", "https://2chv.tora3.net/futen.cgi");
pref("extensions.chaika.login.ronin.last_auth_time", 0);
pref("extensions.chaika.login.ronin.session_id", "");
pref("extensions.chaika.login.ronin.id", "");
pref("extensions.chaika.login.ronin.password", "");

// account: be
pref("extensions.chaika.login.be.login_url", "http://be.2ch.net/test/login.php");
pref("extensions.chaika.login.be.id", "");
pref("extensions.chaika.login.be.password", "");

// account: p2
pref("extensions.chaika.login.p2.login_url", "http://p2.2ch.net/p2/?b=pc");
pref("extensions.chaika.login.p2.post_url", "http://p2.2ch.net/p2/post.php?grid=ON");
pref("extensions.chaika.login.p2.csrfid_url", "http://p2.2ch.net/p2/post_form.php");
pref("extensions.chaika.login.p2.cookie_domain", ".p2.2ch.net");
pref("extensions.chaika.login.p2.id", "");
pref("extensions.chaika.login.p2.password", "");

// bbsmenu (list of boards)
pref("extensions.chaika.bbsmenu.add_chaika_boards", true);
pref("extensions.chaika.bbsmenu.open_favs_in_scratchpad", true);
pref('extensions.chaika.bbsmenu.search.default_engine_name', '00.dig.2ch.net');
pref("extensions.chaika.bbsmenu.bbsmenu_html_url", "http://kita.jikkyo.org/cbm/cbm.cgi/20.p0.m0/-all/bbsmenu.html");
pref("extensions.chaika.bbsmenu.bbsmenu_html_charset", "Shift_JIS");
pref("extensions.chaika.bbsmenu.toggle_open_container", false);
pref("extensions.chaika.bbsmenu.tree_size", "small");
pref("extensions.chaika.bbsmenu.open_single_click", true);
pref("extensions.chaika.bbsmenu.open_new_tab", false);

// board (list of threads)
pref("extensions.chaika.board.auto_update", true);
pref("extensions.chaika.board.update_interval_limit", 45);
pref("extensions.chaika.board.thread_view_limit", 50);
pref("extensions.chaika.board.tree_size", "small");
pref("extensions.chaika.board.open_single_click", true);
pref("extensions.chaika.board.open_new_tab", true);

// thread view
pref("extensions.chaika.thread_skin", "");
pref("extensions.chaika.thread_font_name", "sans-serif");
pref("extensions.chaika.thread_font_size", 16);
pref("extensions.chaika.thread_aa_font_name", "sans-serif");
pref("extensions.chaika.thread_aa_font_size", 16);
pref("extensions.chaika.thread_aa_line_space", 2);
pref("extensions.chaika.thread_show_be_icon", true);
pref("extensions.chaika.thread_fix_invalid_anchor", false);

// dat
pref("extensions.chaika.thread_get_log_from_mimizun", false);
pref("extensions.chaika.thread_alert_got_log", true);
pref("extensions.chaika.dat.self-repair.enabled", false);
pref("extensions.chaika.warn_when_delete_log", true);

// abone
pref('extensions.chaika.abone.warn_when_delete', true);
pref("extensions.chaika.thread_hide_abone", false);
pref("extensions.chaika.thread_chain_abone", false);

// post
pref("extensions.chaika.post.thread_reload", true);
pref("extensions.chaika.post.auto_finish", true);
pref("extensions.chaika.post.auto_finish_delay", 750);
pref("extensions.chaika.post.write_log.succeeded", false);
pref("extensions.chaika.post.write_log.failed", false);
pref('extensions.chaika.post.show_preview', true);
pref('extensions.chaika.post.warn_when_close', true);
pref('extensions.chaika.post.warn_fusianasan', true);
pref('extensions.chaika.post.warn_be', true);
pref('extensions.chaika.post.warn_p2', false);
pref('extensions.chaika.post.warn_mistaken_posting', true);
pref('extensions.chaika.post.emphasize_warnings', false);
pref('extensions.chaika.post.auto_be_enable', false);
pref('extensions.chaika.post.auto_be_disable', false);
pref('extensions.chaika.post.auto_p2_disable', false);
