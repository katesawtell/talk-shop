globalThis.talkShopCategories ??= (() => {
  const sitemap = `
PASTE YOUR ENTIRE CATEGORY SITEMAP HERE
`;

  const departments = {
    mens: ["Men’s", "men", "menswear"],
    womens: ["Women’s", "women", "womenswear"],
    kids: ["Children’s", "children", "kids", "kidswear"],
    "everything-else": ["Everything else"]
  };

  const entries = [...sitemap.matchAll(
    /\[([^\]\n]+)\]\(https:\/\/www\.depop\.com\/category\/([^\s)]+)\)/g
  )].map(([, text, urlPath]) => {
    const id = urlPath.replace(/\/$/, "");
    const lastSlash = id.lastIndexOf("/");
    const parent = lastSlash < 0 ? "" : id.slice(0, lastSlash);
    const original = text.replace(/\*\*/g, "").trim();
    const short = original.replace(/^(?:women|men|kids)['’]s?\s+/i, "");
    const label = short.charAt(0).toUpperCase() + short.slice(1);

    return {
      id,
      parent,
      label: departments[id]?.[0] ?? label,
      formLabel: parent ? label : original,
      answers: [original, label, ...(departments[id] ?? [])]
    };
  });

  const departmentOrder = Object.keys(departments);

  function options(parent = "") {
    const children = entries.filter((entry) => entry.parent === parent);
    if (parent) return children;
    return children.sort(
      (a, b) => departmentOrder.indexOf(a.id) - departmentOrder.indexOf(b.id)
    );
  }

  function normalize(text) {
    return text.toLowerCase()
      .replace(/['’]/g, "")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  }

  function match(choices, spoken) {
    const text = normalize(spoken).replace(/^(?:its|it is)\s+/, "");
    const matches = choices.filter((choice) =>
      choice.answers.some((answer) => normalize(answer) === text)
    );
    return matches.length === 1 ? matches[0] : null;
  }

  return { options, match };
})();