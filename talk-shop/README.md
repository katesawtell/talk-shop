# Depop Voice Draft

An unpacked Chrome extension for drafting a single listing on Depop.com.

## Install

1. Extract the ZIP.
2. In desktop Chrome, open `chrome://extensions`.
3. Enable **Developer mode**, choose **Load unpacked**, and select the extracted `talk-shop` folder containing `manifest.json`.
4. Sign in to Depop, open **Sell now** or a single draft, and click **talk-shop** in Chrome’s Extensions menu.

## Make a listing

1. Choose **Start dictation**. If Chrome asks for microphone access on Depop, allow it.
2. Say something like “Black denim jacket, brand Levi’s, size medium, category jackets, color black, condition good, price 35, notes small mark on the left cuff.” Saying the field names helps the extension identify the values.
3. The extension asks aloud for missing item, category, brand, size, condition and color details. Wait for each question to finish and then answer. Say “skip” if a field doesn't apply. Price and notes are optional. You can also type any field directly.
4. Edit the description preview if needed and choose **Fill Depop draft**. The extension reports which fields it attempted to fill successfully and which need manual entry. Review all dropdowns, photos, shipping and the description before posting in Depop.

Dropdown values are matched by their visible labels. For category hierarchies, try typing the Depop labels separated by slashes, such as `Parent category / Subcategory`. If a picker is unsupported, select its value manually. Existing description and price entries are preserved when they differ from the requested values. The extension does not post or save the listing for you.

Chrome's speech service can process audio remotely. This extension has no separate server and keeps the panel values in memory until you close it or reload. Dictation uses US English. If the microphone or recognition is unavailable, type the details and use the same draft workflow.

## Source

- `details.js` extracts labeled speech and builds the description.
- `form.js` matches visible listing controls and fills values.
- `panel.js` runs the voice conversation and editable preview.
- `background.js` opens the panel when you click the extension on Depop.

The listing adapter is based on visible HTML labels and accessible controls. Depop's signed-in editor and microphone flow require a live Chrome check.
