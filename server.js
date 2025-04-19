// server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { format } from 'date-fns-tz';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const VERSION_ID = '55a41a6a19205f74a3ee0ec4186972fefe4039c8598c701a7a24afd45bcb127b';

const generatedToday = {}; // uid별 기록 저장

const getKoreanDateString = () => {
  const now = new Date();
  return format(now, 'yyyy-MM-dd', { timeZone: 'Asia/Seoul' });
};

app.post('/generate', (req, res) => {
  const { prompt, uid } = req.body;

  if (!uid || !prompt) {
    return res.status(400).json({ error: 'uid 또는 prompt 누락됨' });
  }

  const today = getKoreanDateString();
  const record = generatedToday[uid] || { date: today, count: 0 };

  if (record.date !== today) {
    record.date = today;
    record.count = 0;
  }

  if (record.count >= 5) {
    return res.status(403).json({
      error: '이미지를 더 생성하려면 플랜을 업그레이드 하거나 12시 이후에 다시 시도해주세요.',
    });
  }

  try {
    const predictionRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: VERSION_ID,
        input: { prompt },
      }),
    });

    const prediction = await predictionRes.json();
    if (!prediction?.urls?.get || !prediction?.id) {
      return res.status(500).json({ error: '예측 ID를 받지 못했습니다.' });
    }

    const getUrl = prediction.urls.get;
    let result = null;
    let elapsed = 0;

    while (elapsed < 55) {
      const statusRes = await fetch(getUrl, {
        headers: { Authorization: `Token ${REPLICATE_API_TOKEN}` },
      });
      const statusJson = await statusRes.json();

      if (statusJson.status === 'succeeded') {
        result = statusJson.output;
        break;
      } else if (statusJson.status === 'failed') {
        return res.status(500).json({ error: '이미지 생성 실패' });
      }

      await new Promise((r) => setTimeout(r, 1000));
      elapsed++;
    }

    if (!result || result.length === 0) {
      return res.status(500).json({ error: '이미지 응답 없음' });
    }

    // 이미지 생성 성공 -> 카운트 저장
    record.count += 1;
    generatedToday[uid] = record;

    return res.json({ image: Array.isArray(result) ? result[0] : result });
  } catch (err) {
    console.error('❌ 서버 오류:', err);
    return res.status(500).json({ error: '서버 오류 발생' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 서버 실행 중: http://localhost:${PORT}`);
});
