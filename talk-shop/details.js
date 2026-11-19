globalThis.depopVoiceDetails ??= (() => {
  const fields = {
    item: ['Item', 'What are you selling?'],
    category: ['Category', 'What category is your item?'],
    brand: ['Brand', 'What brand is your item?'],
    size: ['Size', 'What size is your item?'],
    condition: ['Condition', 'What condition is your item in?'],
    color: ['Color', 'What color is your item?'],
    price: ['Price', ''],
    notes: ['Notes', '']
  };
  const labels = 'item|category|brand|size|condition|colou?r|price|notes|flaws';
  const clean = (value) => value.trim().replace(/^[,:\s]+|[.,;\s]+$/g, '').trim();
  const skipped = (value) => /^(skip(?: it)?|unknown|not applicable|n\/a)$/i.test(value);
  const number = (value) => {
    if (!value) return '';
    const match = value.match(/^\s*\$?\s*(\d+(?:[.,]\d{1,2})?)\s*(?:dollars?|usd)?\s*$/i);
    return match ? match[1].replace(',', '.') : '';
  };
  function parse(text) {
    const matches = [...text.matchAll(new RegExp('(?:^|[\\s,;])(' + labels + ')\\b[\\s,:]*(?:is\\s+)?', 'gi'))];
    const result = {};
    const intro = clean(text.slice(0, matches[0]?.index ?? text.length));
    if (intro) result.item = intro;
    matches.forEach((match, index) => {
      const label = match[1].toLowerCase();
      const key = { colour: 'color', flaws: 'notes' }[label] ?? label;
      const value = clean(text.slice(match.index + match[0].length, matches[index + 1]?.index ?? text.length));
      if (value) result[key] = value;
    });
    return result;
  }
  function answer(text, key) {
    const prefix = { color: 'colou?r', notes: 'notes|flaws' }[key] ?? key;
    return clean(text.replace(new RegExp('^(?:' + prefix + ')\\b[\\s,:]*(?:is\\s+)?', 'i'), ''));
  }
  function describe(values) {
    const has = (key) => values[key] && !skipped(values[key]);
    const lines = [];
    if (has('item')) lines.push(values.item[0].toUpperCase() + values.item.slice(1));
    const specifics = [['brand', 'Brand'], ['size', 'Tagged size'], ['color', 'Color'], ['condition', 'Condition']]
      .filter(([key]) => has(key)).map(([key, label]) => label + ': ' + values[key]);
    if (specifics.length) lines.push(specifics.join('\n'));
    if (has('notes')) lines.push(values.notes);
    return lines.join('\n\n');
  }
  return { fields, parse, answer, skipped, number, describe };
})();
