/** @param {HTMLElement} block */
export default async function decorate(block) {
  const api = await fetch('https://main--aem-universaleditor--tylopilus.hlx.live/query-index.json').then((res) => res.json());
  block.innerHTML = `<pre>${JSON.stringify(api, null, 2)}</pre>`;
}
