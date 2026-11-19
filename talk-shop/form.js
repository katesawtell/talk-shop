globalThis.depopVoiceForm ??= (() => {
  const selectors = 'input, textarea, select, button, [role="combobox"], [contenteditable="true"]';
  const names = {
    description: /^(item |product )?description(\b|$)/,
    category: /^(product |item )?(sub[ -]?)?categor(y|ies)(\b|$)|^what are you selling\??$/,
    brand: /^(select |choose |search )?(a )?brand\b/,
    size: /^(select |choose )?(a )?size\b/,
    condition: /^(select |choose )?(an? )?condition\b/,
    color: /^(select |choose )?(a )?(primary )?colou?rs?\b/,
    price: /^(item |listing )?price\b/
  };
  const normalize = (value) => value?.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim() ?? '';
  const visible = (element) => element.getClientRects().length > 0 &&
    getComputedStyle(element).visibility === 'visible';
  const usable = (element) => visible(element) && !element.disabled &&
    !element.readOnly && !(element.tagName === 'BUTTON' && element.form && element.type === 'submit') &&
    element.getAttribute('aria-disabled') !== 'true';
  const all = (root, selector) => [...root.querySelectorAll(selector)].filter(usable);
  function labels(element) {
    const ids = element.getAttribute('aria-labelledby')?.split(/\s+/) ?? [];
    return [
      ...[...(element.labels ?? [])].map((label) => label.textContent),
      ...ids.map((id) => document.getElementById(id)?.textContent),
      ...['aria-label', 'placeholder', 'name', 'id', 'data-testid'].map((attribute) => element.getAttribute(attribute)),
      element.tagName === 'BUTTON' ? element.textContent : ''
    ].map(normalize).filter(Boolean);
  }
  const isText = (element) => element.matches('textarea, input:not([type]), input[type="text"], input[type="number"], input[type="search"], [contenteditable="true"]');
  const isPicker = (element) => element.matches('select, [role="combobox"], button[aria-haspopup], button[aria-expanded], button[aria-controls]') ||
    (element.tagName === 'BUTTON' && !['submit', 'reset'].includes(element.getAttribute('type')) &&
      /^\s*(select|choose)\b/i.test(element.textContent));
  function controls(root, key) {
    return all(root, selectors).filter((element) => {
      if (key === 'description' && !element.matches('textarea,[contenteditable="true"]')) return false;
      if (key === 'price' && !isText(element)) return false;
      if (!['description', 'price'].includes(key) && !isPicker(element) && !(key === 'brand' && isText(element))) return false;
      const direct = labels(element);
      if (direct.some((name) => names[key].test(name))) return true;
      if (direct.length && Object.entries(names).some(([other, pattern]) =>
        other !== key && direct.some((name) => pattern.test(name)))) return false;
      let container = element.parentElement;
      for (let level = 0; container && container !== root && level < 3; level++, container = container.parentElement) {
        if (all(container, selectors).length !== 1) break;
        const local = [...container.querySelectorAll('label, legend, [role="heading"], h2, h3, h4, span, p')]
          .filter((node) => !element.contains(node) && !node.contains(element));
        if (local.some((node) => names[key].test(normalize(node.textContent)) && normalize(node.textContent).split(' ').length <= 5)) return true;
      }
      return false;
    });
  }
  function write(element, value) {
    if (element.isContentEditable) {
      element.textContent = value;
    } else {
      const prototype = Object.getPrototypeOf(element);
      Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
    }
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }
  const aliases = {
    xs: 'extra small', s: 'small', m: 'medium', l: 'large', xl: 'extra large', xxl: 'extra extra large',
    'extra small': 'xs', small: 's', medium: 'm', large: 'l', 'extra large': 'xl',
    'extra extra large': 'xxl', gray: 'grey', grey: 'gray'
  };
  function matches(options, value, allowAliases) {
    const wanted = normalize(value);
    if (!wanted) return;
    const labelsFor = (option) => normalize(option.label || option.textContent);
    const exact = options.filter((option) => labelsFor(option) === wanted);
    if (exact.length) return exact.length === 1 ? exact[0] : undefined;
    const equivalent = allowAliases && aliases[wanted];
    const alternatives = equivalent ? options.filter((option) => labelsFor(option) === equivalent) : [];
    if (alternatives.length === 1) return alternatives[0];
  }
  const pause = () => new Promise((resolve) => setTimeout(resolve, 100));
  async function choose(element, value, key) {
    if (element.tagName === 'SELECT') {
      const option = matches([...element.options].filter((item) =>
        item.value && !item.disabled && !item.closest('optgroup[disabled]')), value, key !== 'category' && key !== 'brand');
      if (!option) return false;
      write(element, option.value);
      return element.value === option.value;
    }
    const selector = '[role="option"], [role="menuitemradio"], [role="menuitem"], [role="treeitem"], [role="radio"]';
    const previouslyVisible = new Set(all(document, selector));
    const expanded = element.getAttribute('aria-expanded') === 'true';
    if (!expanded) element.click();
    if (key === 'brand' && isText(element)) write(element, value);
    for (let attempt = 0; attempt < 12; attempt++) {
      const ids = (element.getAttribute('aria-controls') || element.getAttribute('aria-owns') || '').split(/\s+/);
      const owned = ids.map((id) => document.getElementById(id)).filter(Boolean);
      const options = owned.length ? owned.flatMap((node) => all(node, selector + ', button[type="button"]')) :
        all(document, selector).filter((option) => !previouslyVisible.has(option));
      const match = matches(options, value, key !== 'category' && key !== 'brand');
      if (match) {
        match.click();
        return true;
      }
      await pause();
    }
    return false;
  }
  function listing() {
    const descriptions = controls(document, 'description');
    if (descriptions.length !== 1) return null;
    const description = descriptions[0];
    return { description, root: description.form || description.closest('form, main, [role="main"]') || document };
  }
  async function fill(values, draft, current) {
    const applied = [];
    const manual = [];
    const start = listing();
    if (!start) return { applied, manual, missingForm: true };
    const safe = () => current() && start.description.isConnected && listing()?.description === start.description;
    for (const key of ['description', 'category', 'brand', 'size', 'condition', 'color', 'price']) {
      if (!safe()) return { applied, manual, interrupted: true };
      const value = key === 'description' ? draft : values[key];
      if (!value || globalThis.depopVoiceDetails.skipped(value)) continue;
      const candidates = key === 'description' ? [start.description] : controls(start.root, key);
      const firstCategory = value.split(/\s*(?:\/|>)\s*/)[0];
      const matchingSelects = key === 'category' ? candidates.filter((control) => control.tagName === 'SELECT' &&
        matches([...control.options], firstCategory, false)) : [];
      const element = candidates.length === 1 ? candidates[0] : matchingSelects.length === 1 ? matchingSelects[0] : null;
      if (element && ['description', 'price'].includes(key)) {
        const input = key === 'price' ? globalThis.depopVoiceDetails.number(value) : value;
        const existing = element.isContentEditable ? element.textContent : element.value;
        if (input && (!existing.trim() || existing === input) &&
            (!element.maxLength || element.maxLength < 0 || input.length <= element.maxLength)) {
          write(element, input);
          if ((element.isContentEditable ? element.textContent : element.value) === input) {
            applied.push(key);
            continue;
          }
        }
      } else if (element) {
        const parts = key === 'category' ? value.split(/\s*(?:\/|>)\s*/).filter(Boolean) : [value];
        let selected = parts.length > 0;
        for (let index = 0; selected && index < parts.length; index++) {
          if (!safe()) return { applied, manual, interrupted: true };
          const active = index === 0 ? element : controls(start.root, key).find((control) => control !== element &&
            (control.tagName !== 'SELECT' || [...control.options].some((option) => normalize(option.label) === normalize(parts[index])))) ||
            controls(start.root, key).find((control) => control === element);
          selected = Boolean(active && await choose(active, parts[index], key));
          if (selected) await pause();
        }
        if (selected) {
          applied.push(key);
          continue;
        }
      }
      manual.push(key);
    }
    return { applied, manual };
  }
  return { fill };
})();
