/* Turns the live SVG into a downloadable PNG. Everything in the drawing is
   inline, so the canvas never becomes tainted and the export works offline. */

function slugify(str) {
  return String(str || 'fielding-setup')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'fielding-setup';
}

function svgToDataUrl(svg) {
  const clone = svg.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.removeAttribute('class');
  clone.removeAttribute('id');
  clone.querySelectorAll('[data-noexport]').forEach(function (node) {
    node.remove();
  });
  const markup = new XMLSerializer().serializeToString(clone);
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup);
}

function renderPngBlob(svg, scale) {
  return new Promise(function (resolve, reject) {
    const s = scale || 2;
    const img = new Image();
    img.onload = function () {
      const canvas = document.createElement('canvas');
      canvas.width = FIELD.W * s;
      canvas.height = FIELD.H * s;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#0b1a13';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(function (blob) {
        if (blob) resolve(blob);
        else reject(new Error('The browser could not create the image.'));
      }, 'image/png');
    };
    img.onerror = function () {
      reject(new Error('The browser could not draw the field.'));
    };
    img.src = svgToDataUrl(svg);
  });
}

function downloadPng(svg, title) {
  return renderPngBlob(svg, 2).then(function (blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = slugify(title) + '.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  });
}

/* Copying to the clipboard is not available in every browser; callers fall
   back to the download above. */
function copyPngToClipboard(svg) {
  if (!navigator.clipboard || !window.ClipboardItem) {
    return Promise.reject(new Error('This browser cannot copy images.'));
  }
  return renderPngBlob(svg, 2).then(function (blob) {
    return navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
  });
}
