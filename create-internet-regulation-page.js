const http = require('http');

// Usage:
//   API_HOST=localhost API_PORT=3000 API_USERNAME=your_user API_PASSWORD=your_pass node create-internet-regulation-page.js
// Reads credentials and API location from environment variables. Do not hardcode secrets.

// Function to make HTTP requests
function makeRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          // Get cookies from response headers
          const cookies = res.headers['set-cookie'] || [];
          resolve({ statusCode: res.statusCode, body: body ? JSON.parse(body) : {}, cookies, headers: res.headers });
        } catch (e) {
          resolve({ statusCode: res.statusCode, body, cookies: [], headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function createPage() {
  try {
    console.log('Step 1: Logging in...');

    // Login
    const API_HOST = process.env.API_HOST || 'localhost';
    const API_PORT = parseInt(process.env.API_PORT || '3000', 10);
    const API_USERNAME = process.env.API_USERNAME;
    const API_PASSWORD = process.env.API_PASSWORD;

    if (!API_USERNAME || !API_PASSWORD) {
      throw new Error('Missing credentials: set API_USERNAME and API_PASSWORD environment variables.');
    }

    const loginResponse = await makeRequest({
      hostname: API_HOST,
      port: API_PORT,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    }, {
      username: API_USERNAME,
      password: API_PASSWORD
    });

    if (loginResponse.statusCode !== 200) {
      throw new Error(`Login failed with status ${loginResponse.statusCode}: ${JSON.stringify(loginResponse.body)}`);
    }

    console.log('Login successful!');

    // Extract cookies
    const cookies = loginResponse.cookies.map(c => c.split(';')[0]).join('; ');

    console.log('\nStep 2: Creating page about internet regulation...');

    // Create the page with page builder widgets
    const pageData = {
      title: 'Why the Internet Should Be Regulated Like a Utility',
      slug: 'internet-as-utility',
      content: '<p>This page demonstrates the page builder functionality with widgets.</p>',
      status: 'published',
      author: 1,
      widgets: [
        {
          type: 'heading',
          config: {
            text: 'Why the Internet Should Be Regulated Like a Utility',
            level: 'h1',
            alignment: 'center',
            color: '#1a1a1a',
            fontWeight: 'bold'
          },
          order: 0
        },
        {
          type: 'text-content',
          config: {
            content: '<p>The internet has become as essential to modern life as electricity and water. It powers our economy, connects our communities, and enables access to education, healthcare, and government services. Yet unlike other critical infrastructure, the internet remains largely unregulated, subject to the whims of private corporations and market forces.</p>',
            textAlign: 'left',
            fontSize: 18,
            lineHeight: 1.6,
            textColor: '#333333',
            backgroundColor: '#ffffff',
            padding: 20
          },
          order: 1
        },
        {
          type: 'heading',
          config: {
            text: 'The Case for Utility Regulation',
            level: 'h2',
            alignment: 'left',
            color: '#2c3e50',
            fontWeight: 'bold'
          },
          order: 2
        },
        {
          type: 'text-content',
          config: {
            content: '<h3>Universal Access</h3><p>Just as utilities ensure everyone has access to water and electricity regardless of income or location, internet access should be guaranteed as a basic right. Utility regulation can mandate universal service obligations, ensuring that rural and underserved communities receive the same quality of service as urban areas.</p><h3>Price Stability and Fairness</h3><p>Utility regulation prevents price gouging and ensures affordable rates for essential services. With the internet now essential for work, education, and civic participation, regulating it as a utility would protect consumers from arbitrary price increases and ensure fair, transparent pricing structures.</p><h3>Net Neutrality Protection</h3><p>Utility status would enshrine net neutrality principles, preventing ISPs from throttling certain services, creating fast lanes for preferred content, or discriminating against competitors. This ensures a level playing field for all internet services and protects free speech online.</p>',
            textAlign: 'left',
            fontSize: 16,
            lineHeight: 1.7,
            textColor: '#444444',
            backgroundColor: '#f8f9fa',
            padding: 25
          },
          order: 3
        },
        {
          type: 'divider',
          config: {
            thickness: 2,
            color: '#dee2e6',
            style: 'solid',
            spacing: 30
          },
          order: 4
        },
        {
          type: 'heading',
          config: {
            text: 'Benefits of Internet as a Utility',
            level: 'h2',
            alignment: 'left',
            color: '#2c3e50',
            fontWeight: 'bold'
          },
          order: 5
        },
        {
          type: 'button',
          config: {
            text: 'Learn More About Net Neutrality',
            url: 'https://www.eff.org/issues/net-neutrality',
            openInNewTab: true,
            size: 'large',
            variant: 'primary',
            alignment: 'center',
            fullWidth: false,
            backgroundColor: '#007bff',
            textColor: '#ffffff',
            borderRadius: 8,
            padding: {
              vertical: 15,
              horizontal: 30
            }
          },
          order: 6
        },
        {
          type: 'text-content',
          config: {
            content: '<ul><li><strong>Economic Growth:</strong> Universal, affordable internet access enables entrepreneurship, remote work, and digital commerce across all communities.</li><li><strong>Educational Equity:</strong> Students in all areas gain equal access to online learning resources and educational opportunities.</li><li><strong>Democratic Participation:</strong> Citizens can engage with government services, access public information, and participate in civic discourse regardless of their economic status.</li><li><strong>Innovation Protection:</strong> Startups and small businesses can compete on equal footing with established corporations, fostering innovation and competition.</li><li><strong>Consumer Protection:</strong> Regulatory oversight ensures quality standards, reliable service, and accountability for outages or service disruptions.</li></ul>',
            textAlign: 'left',
            fontSize: 16,
            lineHeight: 1.8,
            textColor: '#2d3748',
            backgroundColor: '#ffffff',
            padding: 20
          },
          order: 7
        },
        {
          type: 'spacer',
          config: {
            height: 40
          },
          order: 8
        },
        {
          type: 'heading',
          config: {
            text: 'Addressing Common Concerns',
            level: 'h2',
            alignment: 'left',
            color: '#2c3e50',
            fontWeight: 'bold'
          },
          order: 9
        },
        {
          type: 'accordion',
          config: {
            items: [
              {
                id: '1',
                title: 'Won\'t regulation stifle innovation?',
                content: 'History shows that utility regulation doesn\'t prevent innovation. The telephone system saw tremendous advances under utility regulation, from touch-tone dialing to caller ID. What regulation prevents is anti-competitive behavior that actually stifles innovation.'
              },
              {
                id: '2',
                title: 'Isn\'t the market working fine?',
                content: 'Many areas lack meaningful competition, with one or two ISPs holding monopolistic power. Without competition or regulation, these companies can set prices arbitrarily and provide poor service with little consequence.'
              },
              {
                id: '3',
                title: 'Will this increase costs?',
                content: 'Utility regulation typically reduces costs for consumers by preventing price gouging and ensuring efficient operation. Any regulatory costs are offset by the benefits of universal access and fair pricing.'
              }
            ],
            allowMultiple: false,
            expandedByDefault: false,
            borderColor: '#cbd5e0',
            backgroundColor: '#ffffff',
            headerColor: '#f7fafc',
            contentPadding: 16
          },
          order: 10
        },
        {
          type: 'spacer',
          config: {
            height: 30
          },
          order: 11
        },
        {
          type: 'text-content',
          config: {
            content: '<h2>Conclusion</h2><p>The internet is no longer a luxury—it\'s a necessity. By regulating it as a utility, we can ensure universal access, protect consumers, promote competition, and preserve the open internet for future generations. The time has come to recognize the internet for what it truly is: essential infrastructure that deserves the same protections and guarantees as our other vital public services.</p>',
            textAlign: 'left',
            fontSize: 16,
            lineHeight: 1.7,
            textColor: '#1a202c',
            backgroundColor: '#edf2f7',
            padding: 30
          },
          order: 12
        }
      ]
    };

    const createPageResponse = await makeRequest({
      hostname: API_HOST,
      port: API_PORT,
      path: '/api/pages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies
      }
    }, pageData);

    if (createPageResponse.statusCode === 201 || createPageResponse.statusCode === 200) {
      console.log('\n✅ Page created successfully!');
      console.log('\nPage Details:');
      console.log('- Title:', pageData.title);
      console.log('- Slug:', pageData.slug);
      console.log('- URL: http://localhost:3001/pages/' + pageData.slug);
      console.log('\n🎉 You can now view the page in your browser!');
      return pageData.slug;
    } else {
      throw new Error(`Failed to create page: ${createPageResponse.statusCode} - ${JSON.stringify(createPageResponse.body)}`);
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

createPage();
