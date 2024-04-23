'use strict';

/**
 * This file holds all options that are implemented with the options API. This
 * API can be used to modify comments or run functions on page load. To add a
 * new option, create an object with the following fields and add it to
 * optionArray.
 *
 * The value of the option must be truthy in order for processHeader and
 * processComment to be run. onLoad is called for every option when the page is
 * first loaded, and is passed the current value, so checking that the option is
 * set is required.
 *
 * The order when processing a comment is:
 *   - processHeader
 *   - processComment
 */

const templateOption = {
  /**
   * (Required)
   * The key for this option. Must be unique, and will be how the option is
   * stored in local storage and accessed from the popup.
   */
  key: "template-key",

  /**
   * (Required)
   * The default value for the option. This will be the value of the option the
   * first time the user loads the extension.
   */
  default: true,

  /**
   * (Optional)
   * This will be called any time the option changes value.
   * @param {*} newValue - the new value of the option
   */
  onValueChange: (newValue) => {},

  /**
   * (Optional)
   * Runs whenever a page is first loaded, even if the value of the option is
   * falsy. Useful for applying custom CSS styling.
   * @param {*} currentValue - the current value of the option
   */
  onLoad: (currentValue) => {},

  /**
   * (Optional)
   * Applied to the header DOM element of each comment. The element itself
   * should be modified directly, as any return value is discarded. This only
   * runs if the current value of the option is truthy.
   * @param commentData - the current comment data as JSON
   * @param {Element} headerElem - the DOM element of the header
   */
  processHeader: (commentData, headerElem) => {},

  /**
   * (Optional)
   * Applied to the comment DOM element of each comment. The element itself
   * should be modified directly, as any return value is discarded. This only
   * runs if the current value of the option is truthy.
   * @param commentData - the current comment data as JSON
   * @param {Element} commentElem - the DOM element of the comment
   */
  processComment: (commentData, commentElem) => {}
};

// Only used to hold state. The actual work of adding HTML elements will be done
// in the parseCommentText option below.
const applyCommentStylingOption = {
  key: 'applyCommentStyling',
  default: true
};

// Implemented as an option, but will always be on. Adds links, and comment
// styling if the option is enabled.
const parseCommentTextOption = {
  key: 'parseCommentText',
  default: true,
  processComment: (commentData, commentElem) => {
    // Below is a beautiful regex to match URLs that may occur in text. It's
    // tricky because we want to allow characters that occur in URLs that are
    // technically reserved, while excluding characters that are likely intended
    // as punctuation. For example:
    //
    //   - "(http://example.com/)" should match "http://example.com/" without
    //      the surrounding parentheses.
    //
    //   - "http://example.com/(bla)" should match "http://example.com/(bla)"
    //      with the parentheses included in the URL.
    //
    //   - "Read http://the-manual.com!" should match "http://the-manual.com"
    //      without the exclamation mark.
    //
    // and so on. This is achieved by dividing the ASCII characters into the
    // ones that are most likely part of the URL:
    //
    //    #$%&'*+-/<=>@&_|~ (as well as letters and digits)
    //
    // And those that are likely part of the punctuation, not the URL:
    //
    //    "!()*,.:;?`  (as well as non-ASCII Unicode characters like — or “”)
    //
    // And those that are part of the URL only if they are occur in pairs:
    //
    //    () {} []
    //
    // (so "http://example.com/foo+(bar)?a[1]=2" is parsed as a single URL).
    //
    // Additionally, we want to support backslash escapes, so that
    // "http://example.com/a\ b\)c" matches as a single URL. Only non-
    // alphanumeric characters can be escaped, so that we can unescape simply by
    // dropping the slashes (\\ -> \, \; -> ;, etc.), without having to deal
    // with complex sequences like \n, \0, \040, \x10 etc.
    //
    // Putting it together, the URL regex first matches http:// or https://
    // (other protocols are intentionally not supported) and the rest of the
    // string can be divided into parts that are either:
    //
    //  - A two-character escape sequence (\ followed by a non-alphanumeric
    //    char).
    //  - A sequence of non-space characters that ends with a character that is
    //    likely part of the URL (#, _, etc.)
    //  - A balanced bracket sequence like "(bla)" or "[bla]" or "{bla}".
    //    Within, these sequences, escapes are allowed (e.g. "(bla\)bla)" or
    //    "[\ ]"). Nested bracket sequences are not parsed; that's impossible.
    //    So "[[]]" matches only the first three characters; to match all four
    //    you must write "[[\]]" (note that escaping characters unnecessarily is
    //    always allowed, so the same sequence can be safely written as
    //    "\[\[\]\]").
    const urlRegex = /(https?:\/\/(?:\\[^A-Z0-9]|[^\s(){}\[\]]*[A-Z0-9#$%&'+\-\/<=>@&_|~]|\((?:\\[^A-Z0-9]|[^\s)])*\)|\[(?:\\[^A-Z0-9]|[^\s\]])*\]|{(?:\\[^A-Z0-9]|[^\s}])*})+)/i;

    // The email regex is much simpler, since I assume it always ends with a TLD
    // that consists of alphanumeric characters or hyphens. This is not perfect,
    // but I'm not going to support esoteric features like embedded comments,
    // IP-based hosts, quoted usernames, non-Latin usernames, and so on.
    const emailRegex = /([A-Z0-9!#$%&'*+\-/=?^_`{|}~.]+@[^\s]+\.[A-Z0-9\-]*[A-Z]+)/i;

    // The regexes for asterisks and underscores match pairs of symbols with
    // certain restrictions. The first symbol of the pair should be preceeded by
    // a space, a bracket, or another of the same symbol, and the symbol after
    // it should not be a space or another asterisk. Similarly, the second of
    // the pair should not be preceeded by a space or another of the same
    // symbol. This will catch the intended use case of italicising things like
    //
    //   - *words*
    //   - _phrases of words_
    //   - **extra important things**
    //   - (_things in parens_)
    //
    // but not catching other uses such as
    //
    //   - * asterisks used as lists
    //   - multiplication 2 * 2 * 2 = 8
    const asteriskRegex = /(?<=^|\s|\(|\[|\{|\*)\*(?=[^*\s])(.*?)(?<=[^*\s])\*/;
    const underscoreRegex = /(?<=^|\s|\(|\[|\{|_)_(?=[^_\s])(.*?)(?<=[^_\s])_/;
    const blockQuoteRegex = /^\s*>\s*/;

    if (!commentData.body) return;
    // Do a quick check to skip over cases where no formatting is necessary.
    const scanRegex = optionShadow.applyCommentStyling ? /[*_>@:]/ : /[:@]/;
    if (!scanRegex.test(commentData.body)) return;

    // Split a string into parts based off the regex, and turn the matched parts
    // into tags.
    // "string *with* italics" => ["string ", <em>with</em>, " italics"]
    function splitStringByRegex(regex, matchToTagFunc, string) {
      const list = [];
      let match;
      while (regex && (match = string.match(regex))) {
        const matchLength = match[0].length;
        const matchText = match[1];

        if (match.index > 0) list.push(string.substring(0, match.index));
        list.push(matchToTagFunc(matchText));
        string = string.substring(match.index + matchLength);
      }

      if (string) list.push(string);
      return list;
    }

    function splitListByRegex(regex, matchToTagFunc, list) {
      return list.map(e => typeof e === 'string' ? splitStringByRegex(regex, matchToTagFunc, e) : e).flat();
    }

    function italicToTag(text) {
      const em = document.createElement('em');
      em.textContent = text;
      return em;
    }

    function urlToTag(url) {
      function unescapeUrl(s) {
        return s.replace(/\\([^A-Z0-9])/ig, '$1');
      }

      const a = document.createElement('a');
      a.className = 'linkified';
      a.href = unescapeUrl(url);
      a.target = '_blank';
      a.rel = 'nofollow ugc noopener';
      a.textContent = url;
      return a;
    }

    function emailToTag(email) {
      const a = document.createElement('a');
      a.className = 'linkified';
      a.href = `mailto:${email}`;
      a.textContent = email;
      return a;
    }

    const commentParagraphs = [];
    for (let paragraph of commentData.body.split(/\n+/)) {
      if (!paragraph) continue;

      const container = document.createElement('p');
      let quoteContainer = container;

      let list = [paragraph];
      list = splitListByRegex(urlRegex, urlToTag, list);
      list = splitListByRegex(emailRegex, emailToTag, list);
      if (optionShadow.applyCommentStyling) {
        list = splitListByRegex(asteriskRegex, italicToTag, list);
        list = splitListByRegex(underscoreRegex, italicToTag, list);

        // Special case for blockquotes
        let quoteIndent = 0;
        const oldFirstPart = list[0];
        if (typeof list[0] === 'string') {
          let match;
          while (match = list[0].match(blockQuoteRegex)) {
            quoteIndent++;
            list[0] = list[0].substring(match[0].length);
          }

          if (!list[0].trim().length) {
            quoteIndent = 0;
            list[0] = oldFirstPart;
          }
        }

        for (let i = 0; i < quoteIndent; i++) {
          const b = document.createElement('blockquote');
          quoteContainer.appendChild(b);
          quoteContainer = b;
        }
      }

      for (let part of list) {
        if (typeof part === 'string') {
          part = document.createTextNode(part);
        }
        quoteContainer.appendChild(part);
      }

      commentParagraphs.push(container);
    }

    const oldCommentBody = commentElem.querySelector('.comment-body');
    oldCommentBody.replaceChildren(...commentParagraphs);
  },
};

// All options should be added here.
const optionArray = [
  // templateOption,
  applyCommentStylingOption,
  parseCommentTextOption,
];

const LOG_OPTION_TAG = '[Astral Codex Eleven] [Option]';
const OPTION_KEY = "acxi-options";

class OptionApiFuncs {
  constructor(headerFuncs, commentFuncs) {
    this.headerFuncs = headerFuncs ?? [];
    this.commentFuncs = commentFuncs ?? [];
  }
}

// Stores a local copy of the current option values. It should not be modified
// directly, instead setOption below should be used.
let optionShadow = {};

async function loadSavedOptions() {
  const v = await chrome.storage.local.get(OPTION_KEY).catch((e) => {
    console.error(LOG_OPTION_TAG, e);
    return undefined;
  });
  optionShadow = v?.[OPTION_KEY] ?? {};
}

async function saveOptions() {
  await chrome.storage.local.set({[OPTION_KEY]: optionShadow}).catch((e) => {
    console.error(LOG_OPTION_TAG, e);
  });
}

async function setOption(key, value) {
  optionShadow[key] = value;
  return await saveOptions();
}

function initializeOptionValues() {
  for (const [key, option] of Object.entries(OPTIONS)) {
    if (!optionShadow.hasOwnProperty(key)) {
      optionShadow[key] = option.default;
    }

    if (typeof option.onLoad === 'function') {
      option.onLoad(optionShadow[key]);
    }
  }
  saveOptions();
}

function storageChangeHandler(changes, namespace) {
  if (namespace !== 'local' || !changes[OPTION_KEY]
      || typeof changes[OPTION_KEY].newValue !== 'object') {
    return;
  }

  for (const [key, newValue] of Object.entries(changes[OPTION_KEY].newValue)) {
    // stringify is a simple way to compare values that may be dicts, and
    // performance isn't a concern here since the function doesn't run often.
    const newValueString = JSON.stringify(newValue);
    const oldValueString = JSON.stringify(optionShadow[key]);

    if (newValueString !== oldValueString) {
      optionShadow[key] = newValue;
      OPTIONS[key]?.onValueChange?.(newValue);
    }
  }
}

function isValidOption(option) {
  if (typeof option.key !== 'string') {
    return [false, 'must contain property "key" as a string'];
  }

  if (!option.hasOwnProperty('default')) {
    return [false, 'must contain a default value'];
  }

  if (option.hasOwnProperty('onValueChange') && typeof option.onValueChange !== 'function') {
    return [false, 'onValueChange must be a function if defined'];
  }

  if (option.hasOwnProperty('onLoad') && typeof option.onLoad !== 'function') {
    return [false, 'onLoad must be a function if defined'];
  }

  if (option.hasOwnProperty('processComment') && typeof option.processComment !== 'function') {
    return [false, 'processComment must be a function if defined'];
  }

  if (option.hasOwnProperty('processHeader') && typeof option.processHeader !== 'function') {
    return [false, 'processHeader must be a function if defined'];
  }

  return [true, undefined];
}

// OPTIONS maps option keys to option objects.
const OPTIONS = Object.fromEntries(optionArray.filter((e) => {
  const [valid, reason] = isValidOption(e);
  if (!valid) {
    console.error(LOG_OPTION_TAG, 'Invalid option:', reason, e);
  }
  return valid;
}).map((e) => [e.key, e]));
