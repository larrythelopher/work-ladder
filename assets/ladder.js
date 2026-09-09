// Shared across every business page (tbs/tfce/yld) — lets you pick which
// rung you're actually on from a dropdown, and greys out + strikes through
// everything before it. Not shared with the homepage (no rungs there).
//
// Persistence is per-browser (localStorage), not synced — this is a personal
// "where am I" marker, not a shared team state. Each viewer sets their own.
(function () {
  const STORAGE_PREFIX = "workladder-rung-";

  function businessKey() {
    // "/tbs/" -> "tbs". Falls back to the full path if it doesn't match the
    // expected shape, so this never throws even if a page moves.
    const match = location.pathname.match(/^\/([a-z]+)\/?$/i);
    return match ? match[1].toLowerCase() : location.pathname;
  }

  function parseRungNumber(titleText) {
    const match = titleText.trim().match(/^(\d+)\s*—/);
    return match ? parseInt(match[1], 10) : null;
  }

  function applyState(rungs, selected) {
    rungs.forEach(({ el, number }) => {
      el.classList.remove("is-done", "is-current");
      if (number < selected) el.classList.add("is-done");
      else if (number === selected) el.classList.add("is-current");
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    const cards = Array.from(document.querySelectorAll(".card.rung"));
    const rungs = cards
      .map((el) => {
        const titleEl = el.querySelector(".rung-title");
        const number = titleEl ? parseRungNumber(titleEl.textContent) : null;
        return number === null ? null : { el, number, title: titleEl.textContent.trim() };
      })
      .filter(Boolean)
      .sort((a, b) => a.number - b.number);

    if (!rungs.length) return; // nothing numbered on this page — leave it alone

    const storageKey = STORAGE_PREFIX + businessKey();
    const stored = parseInt(localStorage.getItem(storageKey), 10);
    const existingCurrent = rungs.find((r) => r.el.classList.contains("is-current"));
    let selected = !isNaN(stored) && rungs.some((r) => r.number === stored)
      ? stored
      : (existingCurrent ? existingCurrent.number : rungs[0].number);

    // Build the dropdown.
    const field = document.createElement("div");
    field.className = "rung-picker";
    const label = document.createElement("label");
    label.setAttribute("for", "rung-select");
    label.textContent = "Which step are you actually on?";
    const select = document.createElement("select");
    select.id = "rung-select";
    rungs.forEach(({ number, title }) => {
      const opt = document.createElement("option");
      opt.value = number;
      opt.textContent = title;
      select.appendChild(opt);
    });
    select.value = selected;
    field.appendChild(label);
    field.appendChild(select);

    const pageHead = document.querySelector(".page-head");
    if (pageHead) pageHead.appendChild(field);

    applyState(rungs, selected);

    select.addEventListener("change", function () {
      selected = parseInt(select.value, 10);
      localStorage.setItem(storageKey, String(selected));
      applyState(rungs, selected);
    });
  });
})();
