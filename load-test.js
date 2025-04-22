import http from 'http';

// Parse command line arguments
const args = process.argv.slice(2);
const parseArg = (flag, defaultValue) => {
  const index = args.indexOf(flag);
  return index !== -1 && index + 1 < args.length ? args[index + 1] : defaultValue;
};

// Configuration with command line overrides
const HOSTNAME = parseArg('--host', 'localhost');
const PORT = parseInt(parseArg('--port', '3000'), 10);
const PATH = parseArg('--path', '/webhook');
const TOTAL_REQUESTS = parseInt(parseArg('--requests', '10000'), 10);
const DELAY_MS = parseInt(parseArg('--delay', '5'), 10);
const CONCURRENCY = parseInt(parseArg('--concurrency', '1'), 10);
const VERBOSE = args.includes('--verbose');

// Options for the HTTP POST request
const options = {
  hostname: HOSTNAME,
  port: PORT,
  path: PATH,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

// Statistics tracking
const stats = {
  startTime: 0,
  endTime: 0,
  totalRequests: 0,
  completed: 0,
  statusCodes: {},
  errors: {},
  minResponseTime: Number.MAX_SAFE_INTEGER,
  maxResponseTime: 0,
  totalResponseTime: 0
};

/**
 * Sends a single HTTP POST request with the given JSON payload.
 * @param {string} payload - JSON string to send in the request body
 * @returns {Promise<{ statusCode: number, body: string, responseTime: number }>} - Resolves with response status, body and time
 */
function sendRequest(payload) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const responseTime = Date.now() - startTime;
        resolve({ 
          statusCode: res.statusCode, 
          body: data,
          responseTime
        });
      });
    });

    req.on('error', (err) => reject(err));
    req.write(payload);
    req.end();
  });
}

/**
 * Processes a single request and updates statistics
 * @param {number} id - Request identifier
 */
async function processRequest(id) {
  const payload = JSON.stringify({ id, timestamp: Date.now() });
  
  try {
    const { statusCode, responseTime } = await sendRequest(payload);
    
    // Update statistics
    stats.completed++;
    stats.statusCodes[statusCode] = (stats.statusCodes[statusCode] || 0) + 1;
    stats.minResponseTime = Math.min(stats.minResponseTime, responseTime);
    stats.maxResponseTime = Math.max(stats.maxResponseTime, responseTime);
    stats.totalResponseTime += responseTime;
    
    if (VERBOSE) {
      console.log(`Request ${id}/${TOTAL_REQUESTS} - Status: ${statusCode} (${responseTime}ms)`);
    } else if (id % 100 === 0 || id === TOTAL_REQUESTS) {
      // Progress update every 100 requests
      const percent = Math.floor((id / TOTAL_REQUESTS) * 100);
      console.log(`Progress: ${percent}% (${id}/${TOTAL_REQUESTS})`);
    }
  } catch (error) {
    const errorMessage = error.message || 'Unknown error';
    stats.errors[errorMessage] = (stats.errors[errorMessage] || 0) + 1;
    
    if (VERBOSE) {
      console.error(`Request ${id} failed: ${errorMessage}`);
    }
  }
}

/**
 * Main function to send multiple POST requests with configurable concurrency.
 */
async function main() {
  console.log(`Starting load test: ${TOTAL_REQUESTS} requests to http://${HOSTNAME}:${PORT}${PATH}`);
  console.log(`Concurrency: ${CONCURRENCY}, Delay between requests: ${DELAY_MS}ms`);
  
  stats.startTime = Date.now();
  stats.totalRequests = TOTAL_REQUESTS;
  
  // Process requests in batches based on concurrency
  for (let i = 0; i < TOTAL_REQUESTS; i += CONCURRENCY) {
    const batch = [];
    
    // Create a batch of concurrent requests
    for (let j = 0; j < CONCURRENCY && i + j < TOTAL_REQUESTS; j++) {
      const requestId = i + j + 1;
      batch.push(processRequest(requestId));
      
      // Add delay between requests in the same batch
      if (DELAY_MS > 0) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
    }
    
    // Wait for all requests in the batch to complete
    await Promise.all(batch);
  }
  
  stats.endTime = Date.now();
  printSummary();
}

/**
 * Prints a summary of the load test results
 */
function printSummary() {
  const duration = (stats.endTime - stats.startTime) / 1000;
  const avgResponseTime = stats.completed > 0 ? stats.totalResponseTime / stats.completed : 0;
  const requestsPerSecond = stats.completed / duration;
  
  console.log('\n=== Load Test Summary ===');
  console.log(`Total time: ${duration.toFixed(2)} seconds`);
  console.log(`Completed requests: ${stats.completed}/${stats.totalRequests}`);
  console.log(`Requests per second: ${requestsPerSecond.toFixed(2)}`);
  
  console.log('\nResponse times:');
  console.log(`  Min: ${stats.minResponseTime === Number.MAX_SAFE_INTEGER ? 'N/A' : stats.minResponseTime + 'ms'}`);
  console.log(`  Max: ${stats.maxResponseTime}ms`);
  console.log(`  Avg: ${avgResponseTime.toFixed(2)}ms`);
  
  console.log('\nStatus code distribution:');
  Object.entries(stats.statusCodes)
    .sort(([a], [b]) => parseInt(a) - parseInt(b))
    .forEach(([code, count]) => {
      const percent = ((count / stats.completed) * 100).toFixed(2);
      console.log(`  ${code}: ${count} (${percent}%)`);
    });
  
  if (Object.keys(stats.errors).length > 0) {
    console.log('\nErrors:');
    Object.entries(stats.errors).forEach(([error, count]) => {
      console.log(`  ${error}: ${count}`);
    });
  }
  
  console.log('\nLoad test completed.');
}

// Print usage information
if (args.includes('--help')) {
  console.log(`
Usage: node load-test.js [options]

Options:
  --host <hostname>       Server hostname (default: localhost)
  --port <port>           Server port (default: 3000)
  --path <path>           Webhook path (default: /webhook)
  --requests <number>     Total number of requests to send (default: 10000)
  --delay <ms>            Delay between requests in milliseconds (default: 5)
  --concurrency <number>  Number of concurrent requests (default: 1)
  --verbose               Show detailed output for each request
  --help                  Show this help message
  `);
  process.exit(0);
}

// Start the load test
main().catch((err) => {
  console.error('Load test encountered an error:', err);
  process.exit(1);
});
