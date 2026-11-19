(() => {
  const panelId = 'depop-voice-draft-extension';
  const existing = document.getElementById(panelId);
  if (existing) {
    existing.shadowRoot.querySelector('#start').focus();
    return;
  }
  const { fields, parse, answer, skipped, describe } = globalThis.depopVoiceDetails;
  const host = document.createElement('div');
  host.id = panelId;
  const ui = host.attachShadow({ mode: 'open' });
  ui.innerHTML = `
    <style>
      :host { all: initial; position: fixed; z-index: 2147483647; right: 14px; top: 14px;
        width: min(390px, calc(100vw - 28px)); color: #25231f; font: 14px/1.45 system-ui, sans-serif; }
      * { box-sizing: border-box; }
      section { max-height: calc(100vh - 28px); overflow: auto; background: #faf8f3; padding: 18px;
        border: 1px solid #bcb5a8; border-radius: 14px; box-shadow: 0 8px 30px #0003; }
      header, .actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      header { justify-content: space-between; }
      h2 { margin: 0; font-size: 20px; }
      p { margin: 9px 0; }
      #status { background: #eee8dc; border-radius: 6px; padding: 9px; }
      #fields { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 12px 0; }
      label { display: block; font-weight: 600; }
      input, textarea { display: block; width: 100%; border: 1px solid #a39b8f; border-radius: 5px;
        background: white; color: #25231f; font: inherit; font-weight: 400; padding: 6px 8px; }
      textarea { resize: vertical; margin-bottom: 10px; }
      button { font: inherit; font-weight: 600; cursor: pointer; border: 1px solid #73695b;
        color: inherit; background: white; border-radius: 6px; padding: 5px 9px; }
      #start, #fill { background: #25231f; color: white; }
      button:disabled { opacity: .5; cursor: default; }
      [hidden] { display: none !important; }
    </style>
    <section aria-label="Talk Shop Draft">
      <header><h2>Depop Voice Draft</h2><button id="close" type="button" aria-label="Close">✕</button></header>
      <p>Say “black denim jacket, brand Levi’s, size medium, category jackets.” You can also type the details below.</p>
      <p id="status" role="status" aria-live="polite">Ready to draft a listing.</p>
      <div class="actions">
        <button id="start" type="button">Start dictation</button>
        <button id="guide" type="button">Ask for missing details</button>
        <button id="again" type="button" hidden>Answer aloud</button>
        <button id="skip" type="button" hidden>Skip question</button>
        <button id="stop" type="button" hidden>Stop voice</button>
      </div>
      <div id="fields"></div>
      <label for="draft">Description preview</label>
      <textarea id="draft" rows="5" placeholder="Your description will appear here."></textarea>
      <div class="actions">
        <button id="fill" type="button">Fill Depop draft</button>
        <button id="copy" type="button">Copy description</button>
      </div>
    </section>`;
  const get = (id) => ui.getElementById(id);
  const status = (message) => { get('status').textContent = message; };
  for (const [key, [label]] of Object.entries(fields)) {
    const wrapper = document.createElement('label');
    wrapper.textContent = label;
    const input = document.createElement('input');
    input.id = key;
    input.autocomplete = 'off';
    wrapper.append(input);
    get('fields').append(wrapper);
  }
  const values = () => Object.fromEntries(Object.keys(fields).map((key) => [key, get(key).value.trim()]));
  let edited = false;
  function updateDraft() {
    if (!edited) get('draft').value = describe(values());
  }
  get('fields').addEventListener('input', updateDraft);
  get('draft').addEventListener('input', () => { edited = Boolean(get('draft').value); });

  const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
  let pending = null;
  let recognition = null;
  let promptVersion = 0;
  let working = false;
  const omitted = new Set();

    const categoryData = globalThis.talkShopCategories;
  const choiceList = new Intl.ListFormat('en-US', { type: 'disjunction' });
  let categoryPath = [];

  function categoryOptions() {
    return categoryData.options(categoryPath.at(-1)?.id);
  }

  function followUp(key, spoken = false) {
    if (key !== 'category') return fields[key][1];

    const choices = categoryOptions();
    if (!choices.length) return fields.category[1];

    const question = [
      'Which department fits your item?',
      'Which category?',
      'Which type?'
    ][Math.min(categoryPath.length, 2)];

    const labels = choices.map((choice) => choice.label);
    if (spoken && labels.length > 5) {
      return `${question} Some options are ${choiceList.format(labels.slice(0, 5))}. See the panel for all choices.`;
    }
    return `${question} ${choiceList.format(labels)}.`;
  }

  function sync() {
    const busy = Boolean(recognition);
    get('start').disabled = busy || working;
    get('guide').disabled = busy || working;
    get('again').hidden = !pending || busy;
    get('skip').hidden = !pending || pending === 'intro';
    get('stop').hidden = !pending;
    get('fill').disabled = busy || working;
  }
  function stop() {
    promptVersion++;
    pending = null;
    categoryPath = [];
    if (recognition) {
      const active = recognition;
      recognition = null;
      active.abort();
    }
    window.speechSynthesis?.cancel();
    sync();
  }
  function next() {
    pending = Object.keys(fields).find((key) => fields[key][1] && !get(key).value.trim() && !omitted.has(key)) ?? null;
    sync();
    if (!pending) {
      status('Review your details and description, then choose Fill Depop draft.');
      return;
    }
    const question = followUp(pending, true);
    status(followUp(pending) + ' Say “skip” to leave it blank.');
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      listen();
      return;
    }
    const version = ++promptVersion;
    const utterance = new SpeechSynthesisUtterance(question);
    utterance.lang = 'en-US';
    const afterPrompt = () => {
      if (version === promptVersion && pending && host.isConnected) listen();
    };
    utterance.onend = afterPrompt;
    utterance.onerror = afterPrompt;
    window.speechSynthesis.speak(utterance);
  }
  function listen() {
    if (!pending || recognition) return;
    if (!Speech) {
      status('Speech recognition is unavailable. Try desktop Chrome or type the details below.');
      return;
    }
    const key = pending;
    const active = new Speech();
    active.lang = 'en-US';
    let transcript = '';
    let fault = '';
    recognition = active;
    sync();
   status(key === 'intro'
      ? 'Listening for item details…'
      : followUp(key) + ' Listening…');
    active.onresult = (event) => {
      transcript = [...event.results].map((result) => result[0].transcript).join(' ').trim();
    };
    active.onerror = (event) => { fault = event.error; };
    active.onend = () => {
      if (recognition !== active) return;
      recognition = null;
      sync();
      if (fault || !transcript) {
        status(['not-allowed', 'service-not-allowed', 'audio-capture'].includes(fault)
          ? 'Chrome could not access speech recognition. Check microphone permissions for Depop or type below.'
          : 'No speech was captured. Choose Answer aloud to retry or type below.');
        return;
      }
      if (key === 'intro') {
        for (const [name, value] of Object.entries(parse(transcript))) {
          if (skipped(value)) omitted.add(name);
          else get(name).value = value;
        }
      } else {
        
        const value = answer(transcript, key);

        if (skipped(value)) {
          omitted.add(key);
          if (key === 'category') categoryPath = [];
        } else if (key === 'category' && categoryOptions().length) {
          // Keep a category the seller typed while the mic was open.
          if (get('category').value.trim()) {
            categoryPath = [];
          } else {
            const choice = categoryData.match(categoryOptions(), value);

            if (!choice) {
              status(`I heard “${value}”. ${followUp(key)} Choose Answer aloud to retry.`);
              return;
            }

            categoryPath.push(choice);
            if (!categoryData.options(choice.id).length) {
              get('category').value = categoryPath
                .map((entry) => entry.formLabel)
                .join(' > ');
              categoryPath = [];
            }
          }
        } else if (value) {
          get(key).value = value;
        }
      }
      updateDraft();
      next();
    };
    try {
      active.start();
    } catch {
      recognition = null;
      sync();
      status('Chrome could not start listening. Choose Answer aloud to retry or type below.');
    }
  }
  get('start').onclick = () => {
    stop();
    omitted.clear();
    pending = 'intro';
    listen();
    sync();
  };
  get('guide').onclick = () => { stop(); omitted.clear(); next(); };
  get('again').onclick = () => { promptVersion++; window.speechSynthesis?.cancel(); listen(); };
  get('skip').onclick = () => {
    if (!pending) return;
    omitted.add(pending);
    stop();
    next();
  };
  get('stop').onclick = () => { stop(); status('Voice paused. You can edit the details below.'); };
  get('close').onclick = () => { stop(); host.remove(); };
  get('copy').onclick = async () => {
    const text = get('draft').value;
    if (!text.trim()) return status('Add item details to create a description.');
    try {
      await navigator.clipboard.writeText(text);
      status('Description copied.');
    } catch {
      get('draft').focus();
      get('draft').select();
      status('Description selected. Use your keyboard to copy it.');
    }
  };
  get('fill').onclick = async () => {
    stop();
    const draft = get('draft').value.trim();
    if (!draft) return status('Add item details to create a description first.');
    working = true;
    sync();
    status('Filling your Depop draft…');
    try {
      const result = await globalThis.depopVoiceForm.fill(values(), draft, () => host.isConnected);
      if (result.missingForm) return status('Open a single Depop listing editor with a visible description field, then try again.');
      const names = (keys) => keys.map((key) => fields[key]?.[0] ?? 'Description').join(', ');
      const messages = [];
      if (result.applied.length) messages.push('Filled ' + names(result.applied) + '.');
      if (result.manual.length) messages.push('Review or enter ' + names(result.manual) + ' manually.');
      if (result.interrupted) messages.push('The listing editor changed during autofill.');
      status(messages.join(' ') || 'Review your listing before posting.');
    } catch (error) {
      console.warn('Talk Shop Draft could not finish filling', error);
      status('Autofill stopped. Review Depop for any fields already filled.');
    } finally {
      working = false;
      sync();
    }
  };
  document.body.append(host);
  sync();
})();
