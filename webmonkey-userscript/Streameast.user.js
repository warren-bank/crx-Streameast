// ==UserScript==
// @name         Streameast
// @description  Watch videos in external player.
// @version      1.0.1
// @match        *://streameast.live/*
// @match        *://*.streameast.live/*
// @match        *://streameast.io/*
// @match        *://*.streameast.io/*
// @icon         https://cdn.streameast.live/fav.png
// @run-at       document-end
// @homepage     https://github.com/warren-bank/crx-Streameast/tree/webmonkey-userscript/es5
// @supportURL   https://github.com/warren-bank/crx-Streameast/issues
// @downloadURL  https://github.com/warren-bank/crx-Streameast/raw/webmonkey-userscript/es5/webmonkey-userscript/Streameast.user.js
// @updateURL    https://github.com/warren-bank/crx-Streameast/raw/webmonkey-userscript/es5/webmonkey-userscript/Streameast.user.js
// @namespace    warren-bank
// @author       Warren Bank
// @copyright    Warren Bank
// ==/UserScript==

// ----------------------------------------------------------------------------- constants

var user_options = {
  "webmonkey": {
    "post_intent_redirect_to_url":  "about:blank"
  },
  "greasemonkey": {
    "redirect_to_webcast_reloaded": true,
    "force_http":                   true,
    "force_https":                  false
  }
}

// ----------------------------------------------------------------------------- URL links to tools on Webcast Reloaded website

var get_webcast_reloaded_url = function(video_url, vtt_url, referer_url, force_http, force_https) {
  force_http  = (typeof force_http  === 'boolean') ? force_http  : user_options.greasemonkey.force_http
  force_https = (typeof force_https === 'boolean') ? force_https : user_options.greasemonkey.force_https

  var encoded_video_url, encoded_vtt_url, encoded_referer_url, webcast_reloaded_base, webcast_reloaded_url

  encoded_video_url     = encodeURIComponent(encodeURIComponent(btoa(video_url)))
  encoded_vtt_url       = vtt_url ? encodeURIComponent(encodeURIComponent(btoa(vtt_url))) : null
  referer_url           = referer_url ? referer_url : unsafeWindow.location.href
  encoded_referer_url   = encodeURIComponent(encodeURIComponent(btoa(referer_url)))

  webcast_reloaded_base = {
    "https": "https://warren-bank.github.io/crx-webcast-reloaded/external_website/index.html",
    "http":  "http://webcast-reloaded.surge.sh/index.html"
  }

  webcast_reloaded_base = (force_http)
                            ? webcast_reloaded_base.http
                            : (force_https)
                               ? webcast_reloaded_base.https
                               : (video_url.toLowerCase().indexOf('http:') === 0)
                                  ? webcast_reloaded_base.http
                                  : webcast_reloaded_base.https

  webcast_reloaded_url  = webcast_reloaded_base + '#/watch/' + encoded_video_url + (encoded_vtt_url ? ('/subtitle/' + encoded_vtt_url) : '') + '/referer/' + encoded_referer_url
  return webcast_reloaded_url
}

// ----------------------------------------------------------------------------- URL redirect

var redirect_to_url = function(url) {
  if (!url) return

  if (typeof GM_loadUrl === 'function') {
    if (typeof GM_resolveUrl === 'function')
      url = GM_resolveUrl(url, unsafeWindow.location.href) || url

    GM_loadUrl(url, 'Referer', unsafeWindow.location.href)
  }
  else {
    try {
      unsafeWindow.top.location = url
    }
    catch(e) {
      unsafeWindow.window.location = url
    }
  }
}

var process_webmonkey_post_intent_redirect_to_url = function() {
  var url = null

  if (typeof user_options.webmonkey.post_intent_redirect_to_url === 'string')
    url = user_options.webmonkey.post_intent_redirect_to_url

  if (typeof user_options.webmonkey.post_intent_redirect_to_url === 'function')
    url = user_options.webmonkey.post_intent_redirect_to_url()

  if (typeof url === 'string')
    redirect_to_url(url)
}

var process_video_url = function(video_url, video_type, vtt_url, referer_url) {
  if (!referer_url)
    referer_url = unsafeWindow.location.href

  if (typeof GM_startIntent === 'function') {
    // running in Android-WebMonkey: open Intent chooser

    var args = [
      /* action = */ 'android.intent.action.VIEW',
      /* data   = */ video_url,
      /* type   = */ video_type
    ]

    // extras:
    if (vtt_url) {
      args.push('textUrl')
      args.push(vtt_url)
    }
    if (referer_url) {
      args.push('referUrl')
      args.push(referer_url)
    }

    GM_startIntent.apply(this, args)
    process_webmonkey_post_intent_redirect_to_url()
    return true
  }
  else if (user_options.greasemonkey.redirect_to_webcast_reloaded) {
    // running in standard web browser: redirect URL to top-level tool on Webcast Reloaded website

    redirect_to_url(get_webcast_reloaded_url(video_url, vtt_url, referer_url))
    return true
  }
  else {
    return false
  }
}

var process_hls_url = function(hls_url, vtt_url, referer_url) {
  return process_video_url(/* video_url= */ hls_url, /* video_type= */ 'application/x-mpegurl', vtt_url, referer_url)
}

var process_dash_url = function(dash_url, vtt_url, referer_url) {
  return process_video_url(/* video_url= */ dash_url, /* video_type= */ 'application/dash+xml', vtt_url, referer_url)
}

// ----------------------------------------------------------------------------- clean DOM (remove modal ad-block dialog)

var update_page_DOM = function() {
  var keep = [
    unsafeWindow.document.querySelector('div.site-wrapper')
  ]

  keep = keep.filter(function(el){return !!el})
  if (!keep.length) return

  while(unsafeWindow.document.body.childNodes.length)
    unsafeWindow.document.body.removeChild(unsafeWindow.document.body.childNodes[0])

  for (var i=0; i < keep.length; i++)
    unsafeWindow.document.body.appendChild(keep[i])
}

// ----------------------------------------------------------------------------- process video

var get_hls_url = function() {
  var regex = {
    whitespace: /[\r\n\t]+/g,
    hls_url:    /['"]([^'"]+\.m3u8)['"][;]/i
  }
  var hls_url = null

  try {
    var scripts, i, script, matches

    scripts = unsafeWindow.document.querySelectorAll('script:not([src])')

    for (i=0; !hls_url && (i < scripts.length); i++) {
      script = scripts[i]
      script = script.innerText
      script = script.replace(regex.whitespace, ' ').trim()

      if (!script) continue

      matches = regex.hls_url.exec(script)
      if (!matches || !matches.length) continue

      hls_url = matches[1]
      break
    }
  }
  catch(e){}

  return hls_url
}

// ----------------------------------------------------------------------------- bootstrap

var process_page = function() {
  var hls_url = get_hls_url()

  if (hls_url) {
    process_hls_url(hls_url)
  }

  update_page_DOM()
}

process_page()

// -----------------------------------------------------------------------------
