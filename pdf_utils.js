// pdf_utils.js

function formatPercentages(percentages) {
  return (
    `E / I : ${percentages.E}% / ${percentages.I}%\n` +
    `S / N : ${percentages.S}% / ${percentages.N}%\n` +
    `T / F : ${percentages.T}% / ${percentages.F}%\n` +
    `J / P : ${percentages.J}% / ${percentages.P}%`
  );
}

module.exports = { formatPercentages };
