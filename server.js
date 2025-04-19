import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const REPLICATE_VERSION_ID = '55a41a6a19205f74a3ee0ec4186972fefe4039c8598c701a7a24afd45bcb127b';

app.post('/api/generate', async (req, res) => {
  const { prompt } = req.body;
  console.log('📨 받은 프롬프트:', prompt);

  try {
    const predictionRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        Authorization: `Token ${REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: REPLICATE_VERSION_ID,
        input: { prompt },
      }),
    });

    const prediction = await predictionRes.json();
    if (!prediction?.urls?.get || !prediction?.id) {
      return res.status(500).json({ error: '예측 ID를 받지 못했습니다.' });
    }

    const getUrl = prediction.urls.get;
    const maxWait = 55;
    let elapsed = 0;
    let statusJson;

    do {
      await new Promise((r) => setTimeout(r, 1000));
      elapsed++;

      const statusRes = await fetch(getUrl, {
        headers: { Authorization: `Token ${REPLICATE_API_TOKEN}` },
      });
      statusJson = await statusRes.json();

      if (statusJson.status === 'succeeded') break;
    } while (elapsed < maxWait && statusJson.status !== 'failed');

    if (statusJson.status === 'succeeded') {
      const image = Array.isArray(statusJson.output) ? statusJson.output[0] : statusJson.output;
      return res.json({ image });
    } else {
      return res.status(500).json({ error: '이미지 생성 실패' });
    }
  } catch (err) {
    console.error('❌ 서버 오류:', err);
    return res.status(500).json({ error: '서버 오류' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 서버 실행 중: http://localhost:${PORT}`);
});
