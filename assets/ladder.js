// Shared across every business page (tbs/tfce/yld) — lets you pick which
// rung you're actually on from a dropdown, and greys out + strikes through
// everything before it. Also turns each rung's task list into checkboxes;
// ticking off every item in your current rung auto-advances you to the next.
//
// Persistence is per-browser (localStorage), not synced — this is a personal
// "where am I" marker and personal checklist, not shared team state. Each
// viewer sets their own; nobody else sees your ticks.
(function () {
  const RUNG_PREFIX = "workladder-rung-";
  const CHECKS_PREFIX = "workladder-checks-";

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

  // A "rung" is one step number, which can be spread across more than one
  // .card.rung element (e.g. two parallel cards — Will's disparate project
  // and Sakina's — both labelled "1 — ..." and shown side by side in a
  // .rung-pair). Everything below operates on the whole group of elements
  // for a given number, not on a single card.
  function applyState(rungs, selected) {
    rungs.forEach(({ els, number }) => {
      els.forEach((el) => {
        el.classList.remove("is-done", "is-current");
        if (number < selected) el.classList.add("is-done");
        else if (number === selected) el.classList.add("is-current");
      });
    });
  }

  // Turns every real task <li> (i.e. not a .placeholder filler line) into a
  // checkbox. Items in rungs before the starting rung default to checked —
  // rungs you've already passed are assumed done until told otherwise.
  // Calls onToggle(rungNumber) whenever a box in that rung changes.
  function initChecklists(rungs, key, startingSelected, onToggle) {
    const storageKey = CHECKS_PREFIX + key;
    let stored;
    try {
      stored = JSON.parse(localStorage.getItem(storageKey) || "{}");
    } catch (e) {
      stored = {};
    }

    function persist() {
      try {
        localStorage.setItem(storageKey, JSON.stringify(stored));
      } catch (e) {
        // ignore — private browsing / storage blocked, checks just won't persist
      }
    }

    rungs.forEach(({ els, number }) => {
      let idx = 0;
      els.forEach((el) => {
        const items = Array.from(el.querySelectorAll(".rung-tasks li:not(.placeholder)"));
        items.forEach((li) => {
          const itemKey = number + "-" + idx;
          idx++;
          const hasStored = Object.prototype.hasOwnProperty.call(stored, itemKey);
          const checked = hasStored ? !!stored[itemKey] : number < startingSelected;

          const label = document.createElement("label");
          label.className = "task-check";
          const box = document.createElement("input");
          box.type = "checkbox";
          box.checked = checked;
          const span = document.createElement("span");
          span.innerHTML = li.innerHTML;

          li.innerHTML = "";
          label.appendChild(box);
          label.appendChild(span);
          li.appendChild(label);
          li.classList.toggle("checked", checked);

          box.addEventListener("change", function () {
            stored[itemKey] = box.checked;
            persist();
            li.classList.toggle("checked", box.checked);
            onToggle(number);
          });
        });
      });
    });
  }

  // Locks a task's checkbox until another task (its data-task-id, referenced
  // via data-depends on the locked item) is ticked. Cross-lane, same-rung use
  // case: e.g. Dunc's review step waits on Will's portal run-through. Forces
  // a locked box back to unchecked if its prerequisite gets un-ticked again,
  // via a synthetic "change" event so it goes through the normal persist path.
  function initDependencies(root) {
    const idToBox = new Map();
    root.querySelectorAll("[data-task-id]").forEach((li) => {
      const box = li.querySelector("input[type='checkbox']");
      if (box) idToBox.set(li.dataset.taskId, box);
    });

    root.querySelectorAll("[data-depends]").forEach((li) => {
      const box = li.querySelector("input[type='checkbox']");
      // data-depends can list several task IDs separated by spaces — ALL of
      // them have to be ticked before this one unlocks.
      const depIds = li.dataset.depends.trim().split(/\s+/);
      const depBoxes = depIds.map((id) => idToBox.get(id)).filter(Boolean);
      if (!box || !depBoxes.length) return;

      function sync() {
        const unlocked = depBoxes.every((d) => d.checked);
        box.disabled = !unlocked;
        li.classList.toggle("locked", !unlocked);
        if (!unlocked && box.checked) {
          box.checked = false;
          box.dispatchEvent(new Event("change"));
        }
      }

      sync();
      depBoxes.forEach((d) => d.addEventListener("change", sync));
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    const cards = Array.from(document.querySelectorAll(".card.rung"));

    // Group cards by rung number — usually one card per number, but a
    // .rung-pair can put two (or more) side by side under the same number,
    // e.g. Will's disparate project and Sakina's, running in parallel.
    const byNumber = new Map();
    cards.forEach((el) => {
      const titleEl = el.querySelector(".rung-title");
      const number = titleEl ? parseRungNumber(titleEl.textContent) : null;
      if (number === null) return;
      if (!byNumber.has(number)) {
        byNumber.set(number, { number, title: titleEl.textContent.trim(), els: [] });
      }
      byNumber.get(number).els.push(el);
    });
    const rungs = Array.from(byNumber.values()).sort((a, b) => a.number - b.number);

    if (!rungs.length) return; // nothing numbered on this page — leave it alone

    const key = businessKey();
    const rungStorageKey = RUNG_PREFIX + key;
    const stored = parseInt(localStorage.getItem(rungStorageKey), 10);
    const existingCurrent = rungs.find((r) => r.els.some((el) => el.classList.contains("is-current")));
    let selected = !isNaN(stored) && rungs.some((r) => r.number === stored)
      ? stored
      : (existingCurrent ? existingCurrent.number : rungs[0].number);
    const startingSelected = selected;

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

    function setSelected(number) {
      selected = number;
      select.value = selected;
      localStorage.setItem(rungStorageKey, String(selected));
      applyState(rungs, selected);
    }

    select.addEventListener("change", function () {
      setSelected(parseInt(select.value, 10));
    });

    initChecklists(rungs, key, startingSelected, function (rungNumber) {
      // Only auto-advance if the rung that just changed is the one you're
      // currently on — ticking boxes on a future or past rung shouldn't
      // yank you somewhere else.
      if (rungNumber !== selected) return;
      const rung = rungs.find((r) => r.number === rungNumber);
      if (!rung) return;
      // Every card sharing this rung number has to be fully ticked — e.g.
      // both Will's card and Sakina's parallel card — before it advances.
      const boxes = rung.els.reduce(
        (acc, el) => acc.concat(Array.from(el.querySelectorAll(".rung-tasks li:not(.placeholder) input[type='checkbox']"))),
        []
      );
      if (!boxes.length) return;
      const allDone = boxes.every((b) => b.checked);
      if (!allDone) return;
      const next = rungs.find((r) => r.number === rungNumber + 1);
      if (next) setSelected(next.number);
    });

    initDependencies(document);
  });
})();
