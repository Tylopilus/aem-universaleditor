/* eslint-disable import/no-cycle */
import { events } from '@dropins/tools/event-bus.js';
import {
  buildBlock,
  decorateBlocks,
  decorateButtons,
  decorateIcons,
  decorateSections,
  decorateTemplateAndTheme,
  loadBlocks,
  loadCSS,
  loadFooter,
  loadHeader,
  sampleRUM,
  waitForLCP,
  getMetadata,
  loadScript,
  toCamelCase,
  toClassName,
  readBlockConfig,
} from './aem.js';
import { getProduct, getSkuFromUrl, trackHistory } from './commerce.js';
import initializeDropins from './dropins.js';

const LCP_BLOCKS = [
  'product-list-page',
  'product-list-page-custom',
  'product-details',
  'commerce-cart',
  'commerce-checkout',
  'commerce-account',
  'commerce-login',
]; // add your LCP blocks to the list

const AUDIENCES = {
  mobile: () => window.innerWidth < 600,
  desktop: () => window.innerWidth >= 600,
  // define your custom audiences here as needed
};

/**
 * Gets all the metadata elements that are in the given scope.
 * @param {String} scope The scope/prefix for the metadata
 * @returns an array of HTMLElement nodes that match the given scope
 */
export function getAllMetadata(scope) {
  return [
    ...document.head.querySelectorAll(
      `meta[property^="${scope}:"],meta[name^="${scope}-"]`
    ),
  ].reduce((res, meta) => {
    const id = toClassName(
      meta.name
        ? meta.name.substring(scope.length + 1)
        : meta.getAttribute('property').split(':')[1]
    );
    res[id] = meta.getAttribute('content');
    return res;
  }, {});
}

// Define an execution context
const pluginContext = {
  getAllMetadata,
  getMetadata,
  loadCSS,
  loadScript,
  sampleRUM,
  toCamelCase,
  toClassName,
};

/**
 * Moves all the attributes from a given elmenet to another given element.
 * @param {Element} from the element to copy attributes from
 * @param {Element} to the element to copy attributes to
 */
export function moveAttributes(from, to, attributes) {
  if (!attributes) {
    // eslint-disable-next-line no-param-reassign
    attributes = [...from.attributes].map(({ nodeName }) => nodeName);
  }
  attributes.forEach((attr) => {
    const value = from.getAttribute(attr);
    if (value) {
      to.setAttribute(attr, value);
      from.removeAttribute(attr);
    }
  });
}

/**
 * Move instrumentation attributes from a given element to another given element.
 * @param {Element} from the element to copy attributes from
 * @param {Element} to the element to copy attributes to
 */
export function moveInstrumentation(from, to) {
  moveAttributes(
    from,
    to,
    [...from.attributes]
      .map(({ nodeName }) => nodeName)
      .filter(
        (attr) =>
          attr.startsWith('data-aue-') || attr.startsWith('data-richtext-')
      )
  );
}

/**
 * load fonts.css and set a session storage flag
 */
async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  try {
    if (!window.location.hostname.includes('localhost'))
      sessionStorage.setItem('fonts-loaded', 'true');
  } catch (e) {
    // do nothing
  }
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function buildAutoBlocks() {
  try {
    // TODO: add auto block, if needed
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
// eslint-disable-next-line import/prefer-default-export
export function decorateMain(main) {
  // hopefully forward compatible button decoration
  decorateButtons(main);
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateBlocks(main);
}

/**
 * Loads everything needed to get to LCP.
 * @param {Element} doc The container element
 */
async function loadEager(doc) {
  document.documentElement.lang = 'en';
  await initializeDropins();
  decorateTemplateAndTheme();

  // Instrument experimentation plugin
  if (
    getMetadata('experiment') ||
    Object.keys(getAllMetadata('campaign')).length ||
    Object.keys(getAllMetadata('audience')).length
  ) {
    // eslint-disable-next-line import/no-relative-packages
    const { loadEager: runEager } = await import(
      '../plugins/experimentation/src/index.js'
    );
    await runEager(document, { audiences: AUDIENCES }, pluginContext);
  }

  window.adobeDataLayer = window.adobeDataLayer || [];

  let pageType = 'CMS';
  if (document.body.querySelector('main .product-details')) {
    pageType = 'Product';
    const sku = getSkuFromUrl();
    window.getProductPromise = getProduct(sku);

    preloadFile(
      '/scripts/__dropins__/storefront-pdp/containers/ProductDetails.js',
      'script'
    );
    preloadFile('/scripts/__dropins__/storefront-pdp/api.js', 'script');
    preloadFile('/scripts/__dropins__/storefront-pdp/render.js', 'script');
    preloadFile('/scripts/__dropins__/storefront-pdp/runtime.js', 'script');
    preloadFile('/scripts/__dropins__/storefront-pdp/713.js', 'script');
    preloadFile('/scripts/__dropins__/storefront-pdp/275.js', 'script');
    preloadFile('/scripts/__dropins__/storefront-pdp/918.js', 'script');
    preloadFile('/scripts/__dropins__/storefront-pdp/148.js', 'script');
  } else if (document.body.querySelector('main .product-details-custom')) {
    pageType = 'Product';
    preloadFile('/scripts/preact.js', 'script');
    preloadFile('/scripts/htm.js', 'script');
    preloadFile(
      '/blocks/product-details-custom/ProductDetailsCarousel.js',
      'script'
    );
    preloadFile(
      '/blocks/product-details-custom/ProductDetailsSidebar.js',
      'script'
    );
    preloadFile(
      '/blocks/product-details-custom/ProductDetailsShimmer.js',
      'script'
    );
    preloadFile('/blocks/product-details-custom/Icon.js', 'script');

    const blockConfig = readBlockConfig(
      document.body.querySelector('main .product-details-custom')
    );
    const sku = getSkuFromUrl() || blockConfig.sku;
    window.getProductPromise = getProduct(sku);
  } else if (document.body.querySelector('main .product-list-page')) {
    pageType = 'Category';
    preloadFile('/scripts/widgets/search.js', 'script');
  } else if (document.body.querySelector('main .product-list-page-custom')) {
    // TODO Remove this bracket if not using custom PLP
    pageType = 'Category';
    const plpBlock = document.body.querySelector(
      'main .product-list-page-custom'
    );
    const { category, urlpath } = readBlockConfig(plpBlock);

    if (category && urlpath) {
      // eslint-disable-next-line import/no-unresolved, import/no-absolute-path
      const { preloadCategory } = await import(
        '/blocks/product-list-page-custom/product-list-page-custom.js'
      );
      preloadCategory({ id: category, urlPath: urlpath });
    }
  } else if (document.body.querySelector('main .commerce-cart')) {
    pageType = 'Cart';
  } else if (document.body.querySelector('main .commerce-checkout')) {
    pageType = 'Checkout';
  }

  window.adobeDataLayer.push({
    pageContext: {
      pageType,
      pageName: document.title,
      eventType: 'visibilityHidden',
      maxXOffset: 0,
      maxYOffset: 0,
      minXOffset: 0,
      minYOffset: 0,
    },
  });
  if (pageType !== 'Product') {
    window.adobeDataLayer.push((dl) => {
      dl.push({ event: 'page-view', eventInfo: { ...dl.getState() } });
    });
  }

  const main = doc.querySelector('main');
  if (main) {
    decorateMain(main);
    document.body.classList.add('appear');
    await waitForLCP(LCP_BLOCKS);
  }

  events.emit('eds/lcp', true);

  try {
    /* if desktop (proxy for fast connection) or fonts already loaded, load fonts.css */
    if (window.innerWidth >= 900 || sessionStorage.getItem('fonts-loaded')) {
      loadFonts();
    }
  } catch (e) {
    // do nothing
  }
}

function autolinkModals(element) {
  element.addEventListener('click', async (e) => {
    const origin = e.target.closest('a');

    if (origin && origin.href && origin.href.includes('/modals/')) {
      e.preventDefault();
      const { openModal } = await import(
        `${window.hlx.codeBasePath}/blocks/modal/modal.js`
      );
      openModal(origin.href);
    }
  });
}

/**
 * Loads everything that doesn't need to be delayed.
 * @param {Element} doc The container element
 */
async function loadLazy(doc) {
  autolinkModals(doc);

  const main = doc.querySelector('main');
  await loadBlocks(main);

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();

  await Promise.all([
    loadHeader(doc.querySelector('header')),
    loadFooter(doc.querySelector('footer')),
    loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`),
    loadFonts(),
  ]);

  await import('./acdl/adobe-client-data-layer.min.js');
  if (sessionStorage.getItem('acdl:debug')) {
    import('./acdl/validate.js');
  }

  trackHistory();

  sampleRUM('lazy');
  sampleRUM.observe(main.querySelectorAll('div[data-block-name]'));
  sampleRUM.observe(main.querySelectorAll('picture > img'));

  // Implement experimentation preview pill
  if (
    getMetadata('experiment') ||
    Object.keys(getAllMetadata('campaign')).length ||
    Object.keys(getAllMetadata('audience')).length
  ) {
    // eslint-disable-next-line import/no-relative-packages
    const { loadLazy: runLazy } = await import(
      '../plugins/experimentation/src/index.js'
    );
    await runLazy(document, { audiences: AUDIENCES }, pluginContext);
  }
}

/**
 * Loads everything that happens a lot later,
 * without impacting the user experience.
 */
function loadDelayed() {
  // eslint-disable-next-line import/no-cycle
  window.setTimeout(() => import('./delayed.js'), 3000);
  // load anything that can be postponed to the latest here
  import('./sidekick.js').then(({ initSidekick }) => initSidekick());
}

function createImportMap() {
  const importMap = {
    imports: {
      '@dropins/tools/': '/scripts/__dropins__/tools/',
      '@dropins/storefront-cart/': '/scripts/__dropins__/storefront-cart/',
      '@dropins/storefront-checkout/':
        '/scripts/__dropins__/storefront-checkout/',
      '@dropins/storefront-pdp/': '/scripts/__dropins__/storefront-pdp/',
      '@dropins/storefront-order-confirmation/':
        '/scripts/__dropins__/storefront-order-confirmation/',
      '@dropins/storefront-auth/': '/scripts/__dropins__/storefront-auth/',
    },
  };

  const scriptElement = document.createElement('script');
  scriptElement.type = 'importmap';
  scriptElement.textContent = JSON.stringify(importMap, null, 2); // Pretty print for readability

  document.head.appendChild(scriptElement); // Insert in the head or wherever needed
}
async function loadPage() {
  createImportMap();
  await loadEager(document);
  await loadLazy(document);
  loadDelayed();
}

loadPage();
export function getConsent() {
  return true;
}
