-- Insert internet regulation page directly into database
-- This bypasses authentication rate limiting

-- First, get the user ID (assuming kevin is user 1)
-- INSERT the page
INSERT INTO pages (title, slug, content, status, author, created_at, updated_at)
VALUES (
  'Why the Internet Should Be Regulated Like a Utility',
  'internet-as-utility',
  '<p>This page demonstrates the page builder functionality with comprehensive widgets.</p>',
  'published',
  1,
  NOW(),
  NOW()
)
ON CONFLICT (slug) DO UPDATE
SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  status = EXCLUDED.status,
  updated_at = NOW();

-- Get the page ID
DO $$
DECLARE
  page_id INTEGER;
BEGIN
  SELECT id INTO page_id FROM pages WHERE slug = 'internet-as-utility';

  -- Delete existing widgets for this page
  DELETE FROM page_widgets WHERE page_id = page_id;

  -- Insert widgets for the page
  INSERT INTO page_widgets (page_id, widget_type, config, display_order, created_at, updated_at) VALUES
  -- Heading Widget
  (page_id, 'heading', '{"text":"Why the Internet Should Be Regulated Like a Utility","level":"h1","alignment":"center","color":"#1a1a1a","fontWeight":"bold"}', 0, NOW(), NOW()),

  -- Introduction Text
  (page_id, 'text-content', '{"content":"<p>The internet has become as essential to modern life as electricity and water. It powers our economy, connects our communities, and enables access to education, healthcare, and government services. Yet unlike other critical infrastructure, the internet remains largely unregulated, subject to the whims of private corporations and market forces.</p>","textAlign":"left","fontSize":18,"lineHeight":1.6,"textColor":"#333333","backgroundColor":"#ffffff","padding":20}', 1, NOW(), NOW()),

  -- Section Heading
  (page_id, 'heading', '{"text":"The Case for Utility Regulation","level":"h2","alignment":"left","color":"#2c3e50","fontWeight":"bold"}', 2, NOW(), NOW()),

  -- Main Content
  (page_id, 'text-content', '{"content":"<h3>Universal Access</h3><p>Just as utilities ensure everyone has access to water and electricity regardless of income or location, internet access should be guaranteed as a basic right. Utility regulation can mandate universal service obligations, ensuring that rural and underserved communities receive the same quality of service as urban areas.</p><h3>Price Stability and Fairness</h3><p>Utility regulation prevents price gouging and ensures affordable rates for essential services. With the internet now essential for work, education, and civic participation, regulating it as a utility would protect consumers from arbitrary price increases and ensure fair, transparent pricing structures.</p><h3>Net Neutrality Protection</h3><p>Utility status would enshrine net neutrality principles, preventing ISPs from throttling certain services, creating fast lanes for preferred content, or discriminating against competitors. This ensures a level playing field for all internet services and protects free speech online.</p>","textAlign":"left","fontSize":16,"lineHeight":1.7,"textColor":"#444444","backgroundColor":"#f8f9fa","padding":25}', 3, NOW(), NOW()),

  -- Divider
  (page_id, 'divider', '{"thickness":2,"color":"#dee2e6","style":"solid","spacing":30}', 4, NOW(), NOW()),

  -- Benefits Heading
  (page_id, 'heading', '{"text":"Benefits of Internet as a Utility","level":"h2","alignment":"left","color":"#2c3e50","fontWeight":"bold"}', 5, NOW(), NOW()),

  -- CTA Button
  (page_id, 'button', '{"text":"Learn More About Net Neutrality","url":"https://www.eff.org/issues/net-neutrality","openInNewTab":true,"size":"large","variant":"primary","alignment":"center","fullWidth":false,"backgroundColor":"#007bff","textColor":"#ffffff","borderRadius":8,"padding":{"vertical":15,"horizontal":30}}', 6, NOW(), NOW()),

  -- Benefits List
  (page_id, 'text-content', '{"content":"<ul><li><strong>Economic Growth:</strong> Universal, affordable internet access enables entrepreneurship, remote work, and digital commerce across all communities.</li><li><strong>Educational Equity:</strong> Students in all areas gain equal access to online learning resources and educational opportunities.</li><li><strong>Democratic Participation:</strong> Citizens can engage with government services, access public information, and participate in civic discourse regardless of their economic status.</li><li><strong>Innovation Protection:</strong> Startups and small businesses can compete on equal footing with established corporations, fostering innovation and competition.</li><li><strong>Consumer Protection:</strong> Regulatory oversight ensures quality standards, reliable service, and accountability for outages or service disruptions.</li></ul>","textAlign":"left","fontSize":16,"lineHeight":1.8,"textColor":"#2d3748","backgroundColor":"#ffffff","padding":20}', 7, NOW(), NOW()),

  -- Spacer
  (page_id, 'spacer', '{"height":40}', 8, NOW(), NOW()),

  -- FAQ Heading
  (page_id, 'heading', '{"text":"Addressing Common Concerns","level":"h2","alignment":"left","color":"#2c3e50","fontWeight":"bold"}', 9, NOW(), NOW()),

  -- Accordion
  (page_id, 'accordion', '{"items":[{"id":"1","title":"Won''t regulation stifle innovation?","content":"History shows that utility regulation doesn''t prevent innovation. The telephone system saw tremendous advances under utility regulation, from touch-tone dialing to caller ID. What regulation prevents is anti-competitive behavior that actually stifles innovation."},{"id":"2","title":"Isn''t the market working fine?","content":"Many areas lack meaningful competition, with one or two ISPs holding monopolistic power. Without competition or regulation, these companies can set prices arbitrarily and provide poor service with little consequence."},{"id":"3","title":"Will this increase costs?","content":"Utility regulation typically reduces costs for consumers by preventing price gouging and ensuring efficient operation. Any regulatory costs are offset by the benefits of universal access and fair pricing."}],"allowMultiple":false,"expandedByDefault":false,"borderColor":"#cbd5e0","backgroundColor":"#ffffff","headerColor":"#f7fafc","contentPadding":16}', 10, NOW(), NOW()),

  -- Spacer
  (page_id, 'spacer', '{"height":30}', 11, NOW(), NOW()),

  -- Conclusion
  (page_id, 'text-content', '{"content":"<h2>Conclusion</h2><p>The internet is no longer a luxury—it''s a necessity. By regulating it as a utility, we can ensure universal access, protect consumers, promote competition, and preserve the open internet for future generations. The time has come to recognize the internet for what it truly is: essential infrastructure that deserves the same protections and guarantees as our other vital public services.</p>","textAlign":"left","fontSize":16,"lineHeight":1.7,"textColor":"#1a202c","backgroundColor":"#edf2f7","padding":30}', 12, NOW(), NOW());

END $$;
