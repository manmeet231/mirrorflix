const resp = await fetch('/api/v2/home');
const data = await resp.json();
console.log(data);