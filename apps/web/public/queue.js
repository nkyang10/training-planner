/**
 * The offline queue's browser half: IndexedDB storage, form interception, and replay.
 *
 * The rules are not written twice. `packages/offline` owns them and is tested without a browser; this file is the
 * plumbing, and it deliberately contains no policy it could get wrong: it stores a submitted draft under its
 * idempotency key, it never replays while the network is down, and it never deletes a draft the server did not
 * accept. The page supplies the "saved on this device" copy from the message catalogue, so no user-facing string
 * lives here.
 */
(function () {
  "use strict";

  var DB_NAME = "training-planner-offline";
  var STORE = "drafts";
  var MAX_ATTEMPTS = 5;

  function openDatabase() {
    return new Promise(function (resolve, reject) {
      var request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = function () {
        var database = request.result;
        if (!database.objectStoreNames.contains(STORE)) database.createObjectStore(STORE, { keyPath: "key" });
      };
      request.onsuccess = function () {
        resolve(request.result);
      };
      request.onerror = function () {
        reject(request.error);
      };
    });
  }

  function withStore(mode, run) {
    return openDatabase().then(function (database) {
      return new Promise(function (resolve, reject) {
        var transaction = database.transaction(STORE, mode);
        var store = transaction.objectStore(STORE);
        var request;
        try {
          request = run(store);
        } catch (error) {
          reject(error);
          return;
        }
        transaction.oncomplete = function () {
          resolve(request ? request.result : undefined);
        };
        transaction.onerror = function () {
          reject(transaction.error);
        };
      });
    });
  }

  function allDrafts() {
    return withStore("readonly", function (store) {
      return store.getAll();
    }).then(function (drafts) {
      return (drafts || []).sort(function (a, b) {
        return a.queuedAtMs - b.queuedAtMs;
      });
    });
  }

  function putDraft(draft) {
    return withStore("readwrite", function (store) {
      return store.put(draft);
    });
  }

  function dropDraft(key) {
    return withStore("readwrite", function (store) {
      return store.delete(key);
    });
  }

  function statusOf(form) {
    return form.querySelector("[data-offline-status]");
  }

  function say(form, text) {
    var element = statusOf(form);
    if (element) element.textContent = text;
  }

  function draftOf(form) {
    var fields = {};
    new FormData(form).forEach(function (value, name) {
      fields[name] = typeof value === "string" ? value : value.name;
    });
    return {
      key: fields["idempotencyKey"] || String(Date.now()),
      day: form.getAttribute("data-day") || "",
      form: fields,
      queuedAtMs: Date.now(),
      attempts: 0,
      lastError: null,
    };
  }

  function replayOne(draft) {
    var body = new URLSearchParams();
    Object.keys(draft.form).forEach(function (name) {
      body.set(name, draft.form[name]);
    });
    body.set("source", "offline-queue");
    return fetch("/day/" + encodeURIComponent(draft.day), {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      credentials: "same-origin",
    }).then(function (response) {
      if (response.ok) return dropDraft(draft.key);
      draft.attempts = (draft.attempts || 0) + 1;
      draft.lastError = "HTTP " + response.status;
      return putDraft(draft);
    });
  }

  function replayAll() {
    if (!navigator.onLine) return Promise.resolve();
    return allDrafts().then(function (drafts) {
      return drafts.reduce(function (chain, draft) {
        return chain.then(function () {
          if ((draft.attempts || 0) >= MAX_ATTEMPTS) return undefined;
          return replayOne(draft).catch(function (error) {
            draft.attempts = (draft.attempts || 0) + 1;
            draft.lastError = String(error);
            return putDraft(draft);
          });
        });
      }, Promise.resolve());
    });
  }

  function intercept(form) {
    form.addEventListener("submit", function (event) {
      if (navigator.onLine) return;
      event.preventDefault();
      var draft = draftOf(form);
      say(form, form.getAttribute("data-saved-locally") || "");
      putDraft(draft).catch(function (error) {
        say(form, String(error));
      });
    });
  }

  function start() {
    var forms = document.querySelectorAll("form[data-offline-queue]");
    for (var index = 0; index < forms.length; index += 1) intercept(forms[index]);
    window.addEventListener("online", replayAll);
    replayAll();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
