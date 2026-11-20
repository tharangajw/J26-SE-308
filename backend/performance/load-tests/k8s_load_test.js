import http from 'k6/http';
import { sleep, check } from 'k6';

// k6 load test configuration simulating progressive baseline traffic (20 VUs)
// followed by a sudden 200 VU spike burst to evaluate latency drift and autoscaling lag.
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

// Target cluster gateway endpoints for synthetic traffic distribution across services.
const services = [
  'http://localhost:3000/api/v1/orders',
  'http://localhost:3000/api/v1/users/1',
  'http://localhost:3000/api/v1/inventory/1',
  'http://localhost:3000/api/v1/payments/1',
];

// Dispatches round-robin HTTP GET requests across microservices and verifies 200 OK responses.
export default function () {
  const res = http.get(services[__VU % services.length]);
  check(res, {
    'status is 200': (r) => r.status === 200,
  });
  sleep(1);
}
