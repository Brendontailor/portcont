import app from './app.js';
import { env } from './config/env.js';

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 PORTCONT Backend running on http://localhost:${PORT}`);
  console.log(`   Environment: ${env.NODE_ENV}`);
});