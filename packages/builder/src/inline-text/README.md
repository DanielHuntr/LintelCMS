# Styling words inside a text

Select words of a heading or paragraph, on the canvas or in the Content panel's text box,
and style just them: italic, bold, outlined, a colour, a highlight, another font or size.

- `TextStyleBar.tsx`: the buttons, shown pressed when the whole selection already has that
  style.
- `SelectedWordsBar.tsx`: the bar above the canvas while words are selected there (the
  canvas frame reports the selection in characters of the stored text).
- `MarkableTextField.tsx`: the Content panel's text box with the same bar, for keyboard use.

Styles are stored as marks next to the text (`@lintel/builder-model`'s `text-marks/`) and
drawn as `<em>` and `<span class>`.
