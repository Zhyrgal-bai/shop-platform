export async function getProducts() {
  const res = await fetch("https://your-api-url.com/products");
  return res.json();
}