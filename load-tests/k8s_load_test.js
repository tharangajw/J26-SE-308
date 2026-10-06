import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 },  // Ramp up to 20 users (Baseline)
    { duration: '1m', target: 20 },   // Maintain baseline
    { duration: '15s', target: 200 }, // Spike traffic burst!
    { duration: '30s', target: 200 }, // Hold peak spike
    { duration: '20s', target: 0 },   // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete within 500ms
  },
};

export default function () {
  const res = http.get('http://localhost:3000/api/v1/orders');
  check(res, {
    'status is 200': (r) => r.status === 200,
  });
  sleep(1);
}
