(() => {
  // Your dynamic import map creation code
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

  // Optionally, you can verify it works:
  console.log('Import map added:', scriptElement);
})();

export default {};
