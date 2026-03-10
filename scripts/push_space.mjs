import { readFileSync } from 'fs';

const HF_TOKEN = process.env.HF_TOKEN || '';  // set via: export HF_TOKEN=your_token
const REPO     = 'mohit7739/tinyllama-python-coder';
const BASE     = new URL('./hf_space/', import.meta.url).pathname;

async function uploadFile(filename) {
  const content = readFileSync(BASE + filename);
  const b64 = content.toString('base64');

  const res = await fetch(`https://huggingface.co/api/spaces/${REPO}/commit/main`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HF_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      summary: `Update ${filename} via push script`,
      files: [{ path: filename, encoding: 'base64', content: b64 }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || JSON.stringify(data));
  console.log(`✅ ${filename} pushed → ${data.commitUrl}`);
}

try {
  await uploadFile('app.py');
  await uploadFile('requirements.txt');
  console.log('\nSpace is rebuilding. Watch: https://huggingface.co/spaces/' + REPO);
} catch (e) {
  console.error('❌', e.message);
}
